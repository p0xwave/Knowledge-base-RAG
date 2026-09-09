from __future__ import annotations

import json
import shutil
import tempfile
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as package_version
from pathlib import Path
from typing import TYPE_CHECKING

from pydantic import JsonValue, TypeAdapter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.dataset.models import (
    LocalSnapshotFile,
    ModelArtifact,
    ModelRole,
    RagRuntime,
    RuntimeManifest,
    SnapshotFile,
    SnapshotPath,
    TrainingRuntime,
    VersionCreate,
    VersionView,
)
from db import DatasetVersionFile
from services import dataset_service as datasets
from services.dataset_storage import SnapshotIntegrityError, storage_io, verify_blob
from settings import settings

if TYPE_CHECKING:
    from chromadb.api.client import Client
    from lora_train.config import LoraTrainConfig
    from prompt_contract import PromptContract
    from rag.config import Settings as RagSettings

    from services.rag_service import RagService


def _packages() -> dict[str, str]:
    result: dict[str, str] = {}
    for name in (
        "chromadb",
        "sentence-transformers",
        "transformers",
        "torch",
        "peft",
        "trl",
    ):
        try:
            result[name] = package_version(name)
        except PackageNotFoundError:
            continue
    return result


def _expand_directories(
    directories: Sequence[LocalSnapshotFile],
) -> list[LocalSnapshotFile]:
    files: list[LocalSnapshotFile] = []
    for directory in directories:
        if not directory.local_path.is_dir():
            raise NotADirectoryError("Snapshot directory does not exist")
        for path in sorted(directory.local_path.rglob("*")):
            if path.is_file():
                if path.name == ".env" or path.name.startswith(".env."):
                    raise ValueError(
                        "Environment files cannot be included in automatic runtime capture"
                    )
                relative = path.relative_to(directory.local_path).as_posix()
                files.append(
                    LocalSnapshotFile(
                        path=f"{directory.path}/{relative}", local_path=path
                    )
                )
    return files


def _file_states(files: Sequence[LocalSnapshotFile]) -> list[tuple[int, int, int]]:
    result: list[tuple[int, int, int]] = []
    for file in files:
        stat = file.local_path.stat()
        result.append((stat.st_ino, stat.st_size, stat.st_mtime_ns))
    return result


async def capture_runtime_version(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    data: VersionCreate,
    directories: Sequence[LocalSnapshotFile] = (),
    *,
    index_is_quiescent: bool = False,
) -> VersionView:
    """Capture closed runtime artifacts without reading a live Chroma database."""
    if data.runtime is None:
        raise ValueError("A runtime manifest is required")
    await datasets.get_dataset(db, user_id, dataset_id)
    if data.runtime.rag is not None and not index_is_quiescent:
        raise ValueError(
            "Stop all index writers and close Chroma clients before capturing the index"
        )
    expanded = await storage_io(_expand_directories, directories)
    local_files = [*data.local_files, *expanded]
    before = await storage_io(_file_states, local_files)
    validated = VersionCreate.model_validate(
        {**data.model_dump(), "local_files": local_files}
    )
    await datasets.lock_storage(db)
    async with db.begin_nested():
        result = await datasets.create_version(db, user_id, dataset_id, validated)
        if before != await storage_io(
            _file_states, local_files
        ) or expanded != await storage_io(_expand_directories, directories):
            raise SnapshotIntegrityError("Runtime files changed during capture")
    return result


def _local_model(
    role: ModelRole, name: str
) -> tuple[ModelArtifact, LocalSnapshotFile | None]:
    path = Path(name)
    if path.is_dir():
        prefix = f"models/{role}"
        return ModelArtifact(
            role=role, name=name, weights_path=prefix
        ), LocalSnapshotFile(path=prefix, local_path=path)
    return ModelArtifact(role=role, name=name), None


async def capture_rag_version(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    config: RagSettings,
    contract: PromptContract,
    *,
    index_is_quiescent: bool = False,
) -> VersionView:
    """Capture a stopped corpus/index, local model directories and the exact prompt contract."""
    if config.top_k != contract.context_chunks:
        raise ValueError("Retrieval top_k must match the prompt contract")
    models: list[ModelArtifact] = []
    directories = [
        LocalSnapshotFile(path="documents", local_path=Path(config.dataset_path)),
        LocalSnapshotFile(path="index", local_path=Path(config.chroma_path)),
    ]
    specifications: list[tuple[ModelRole, str, str | None]] = [
        ("embedding", config.embedding_model, config.embedding_revision),
        ("reranker", config.rerank_model, config.rerank_revision),
        ("generator", config.llm_model_generation, None),
    ]
    for role, name, revision in specifications:
        model, directory = await storage_io(_local_model, role, name)
        model = model.model_copy(update={"revision": revision})
        models.append(model)
        if directory is not None:
            directories.append(directory)
    runtime = RuntimeManifest(
        models=models,
        rag=RagRuntime(
            index_path="index",
            collection=config.chroma_collection,
            prompt_path="config/prompt.json",
            parameters={
                "top_k": config.top_k,
                "chunk_size": config.chunk_size,
                "chunk_overlap": config.chunk_overlap,
                "llm_timeout": config.llm_timeout,
                "llm_temperature": config.llm_temperature,
                "llm_max_output_tokens": config.llm_max_output_tokens,
            },
        ),
        packages=await storage_io(_packages),
    )
    data = VersionCreate(
        runtime=runtime,
        files=[
            SnapshotFile(
                path="config/prompt.json",
                content=json.dumps(
                    contract.to_dict(), ensure_ascii=False, sort_keys=True
                ).encode(),
            )
        ],
    )
    return await capture_runtime_version(
        db,
        user_id,
        dataset_id,
        data,
        directories,
        index_is_quiescent=index_is_quiescent,
    )


async def capture_training_version(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    config: LoraTrainConfig,
) -> VersionView:
    """Capture train/validation data, training settings, local base weights and a finished adapter."""
    model, directory = await storage_io(_local_model, "base", config.model.name)
    models = [model]
    directories = [directory] if directory is not None else []
    adapter = config.training.output_dir / "final"
    if await storage_io(adapter.is_dir):
        models.append(
            ModelArtifact(
                role="adapter", name=adapter.name, weights_path="models/adapter"
            )
        )
        directories.append(LocalSnapshotFile(path="models/adapter", local_path=adapter))
    model = model.model_copy(update={"revision": config.model.revision})
    models[0] = model
    parameters = TypeAdapter(dict[str, JsonValue]).validate_python(
        TypeAdapter(type(config)).dump_python(config, mode="json")
    )
    runtime = RuntimeManifest(
        models=models,
        packages=await storage_io(_packages),
        training=TrainingRuntime(
            train_path="data/train.jsonl",
            validation_path="data/validation.jsonl",
            prompt_path="config/prompt.json",
            parameters=parameters,
        ),
    )
    data = VersionCreate(
        runtime=runtime,
        files=[
            SnapshotFile(
                path="config/prompt.json",
                content=json.dumps(
                    config.data.contract.to_dict(), ensure_ascii=False, sort_keys=True
                ).encode(),
            )
        ],
        local_files=[
            LocalSnapshotFile(
                path="data/train.jsonl", local_path=config.data.train_jsonl
            ),
            LocalSnapshotFile(
                path="data/validation.jsonl", local_path=config.data.val_jsonl
            ),
        ],
    )
    return await capture_runtime_version(db, user_id, dataset_id, data, directories)


@dataclass
class RestoredVersion:
    directory: Path
    version: VersionView
    _client: Client | None = field(default=None, init=False, repr=False)

    def training_config(self, output_directory: Path) -> LoraTrainConfig:
        from lora_train.config import LoraTrainConfig
        from prompt_contract import PromptContract

        runtime = self.version.runtime
        if runtime is None or runtime.training is None:
            raise ValueError("Version has no training runtime")
        config = TypeAdapter(LoraTrainConfig).validate_python(
            runtime.training.parameters
        )
        if config.model.trust_remote_code:
            raise ValueError("Snapshot execution does not allow remote model code")
        base = next(model for model in runtime.models if model.role == "base")
        config.model.name = (
            str(self.directory / base.weights_path) if base.weights_path else base.name
        )
        config.model.revision = None if base.weights_path else base.revision
        config.data.train_jsonl = self.directory / runtime.training.train_path
        config.data.val_jsonl = self.directory / runtime.training.validation_path
        config.data.contract = PromptContract.load(
            self.directory / runtime.training.prompt_path
        )
        config.training.output_dir = output_directory
        return config

    def rag_service(self, connection: RagSettings) -> RagService:
        from prompt_contract import PromptContract
        from rag.config import Settings as RagSettings

        from services.rag_service import RagService

        runtime = self.version.runtime
        if runtime is None or runtime.rag is None:
            raise ValueError("Version has no RAG runtime")
        expected = runtime.packages.get("chromadb")
        if expected is None or expected != package_version("chromadb"):
            raise ValueError(
                "Use the captured Chroma version to avoid an implicit index migration"
            )
        parameters = connection.model_dump()
        parameters.update(runtime.rag.parameters)
        parameters["chroma_path"] = str(self.directory / runtime.rag.index_path)
        parameters["chroma_collection"] = runtime.rag.collection
        fields = {
            "embedding": "embedding_model",
            "reranker": "rerank_model",
            "generator": "llm_model_generation",
        }
        for model in runtime.models:
            if model.role in fields:
                parameters[fields[model.role]] = (
                    str(self.directory / model.weights_path)
                    if model.weights_path and model.role != "generator"
                    else model.name
                )
            if model.role in {"embedding", "reranker"}:
                revision_field = (
                    "embedding_revision"
                    if model.role == "embedding"
                    else "rerank_revision"
                )
                parameters[revision_field] = (
                    None if model.weights_path else model.revision
                )
        contract = PromptContract.load(self.directory / runtime.rag.prompt_path)
        config = RagSettings.model_validate(parameters)
        if config.top_k != contract.context_chunks:
            raise ValueError(
                "Snapshot retrieval top_k does not match the captured prompt contract"
            )
        import chromadb
        from chromadb.api.client import Client

        if self._client is None:
            client = chromadb.PersistentClient(path=config.chroma_path)
            if not isinstance(client, Client):
                raise TypeError("Snapshot restoration requires a local Chroma client")
            self._client = client
        collection = self._client.get_collection(name=config.chroma_collection)
        return RagService(config, prompt_contract=contract, collection=collection)

    def close(self) -> None:
        """Stop only this temporary Chroma system; the pinned client has no public close API."""
        if self._client is not None:
            self._client._system.stop()
            self._client._identifier_to_system.pop(self._client._identifier, None)
            self._client = None


def _restore_files(directory: Path, files: Sequence[DatasetVersionFile]) -> None:
    for file in files:
        SnapshotPath(path=file.path)
        source = verify_blob(file.sha256, file.size_bytes)
        target = directory / file.path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


@asynccontextmanager
async def materialize_version(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    version_id: int,
) -> AsyncIterator[RestoredVersion]:
    """Restore verified files to a disposable working copy; immutable blobs are never hard-linked."""
    if db.in_transaction():
        raise ValueError("Materialization requires a fresh transaction")
    await storage_io(settings.DATASET_STORAGE_PATH.mkdir, parents=True, exist_ok=True)
    temporary = await storage_io(
        tempfile.TemporaryDirectory,
        prefix="runtime-",
        dir=settings.DATASET_STORAGE_PATH,
    )
    restored: RestoredVersion | None = None
    try:
        async with db.begin():
            await datasets.lock_storage(db)
            version = await datasets.get_version(db, user_id, dataset_id, version_id)
            files = list(
                await db.scalars(
                    select(DatasetVersionFile).where(
                        DatasetVersionFile.version_id == version_id
                    )
                )
            )
            await storage_io(_restore_files, Path(temporary.name), files)
        restored = RestoredVersion(Path(temporary.name), version)
        yield restored
    finally:
        try:
            if restored is not None:
                await storage_io(restored.close)
        finally:
            await storage_io(temporary.cleanup)

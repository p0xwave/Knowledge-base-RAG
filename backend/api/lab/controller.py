import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.dataset.models import (
    ModelArtifact,
    RuntimeManifest,
    SnapshotFile,
    TrainingRuntime,
    VersionCreate,
    VersionView,
)
from db import Dataset, DatasetVersion, DatasetVersionFile, LabRun, LabWorker, User
from services import dataset_service as datasets
from services.lab_data import MAX_UPLOAD_BYTES, parse_upload
from settings import settings

from .models import Catalog, LabVersionView, SynthesisRequest, TrainingRequest


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def active_owner(db: AsyncSession, user_id: int, *, lock: bool = False) -> User:
    query = select(User).where(User.id == user_id, User.is_active.is_(True))
    if lock:
        query = query.with_for_update()
    user = await db.scalar(query)
    if user is None:
        raise HTTPException(401, "Аккаунт недоступен.")
    return user


async def version_by_id(db: AsyncSession, user_id: int, version_id: int) -> VersionView:
    version = await db.scalar(
        select(DatasetVersion)
        .join(Dataset)
        .where(DatasetVersion.id == version_id, Dataset.user_id == user_id)
    )
    if version is None:
        raise HTTPException(404, "Версия датасета не найдена.")
    return VersionView.model_validate(version)


async def version_view(
    db: AsyncSession, user_id: int, version: VersionView
) -> LabVersionView:
    dataset = await datasets.get_dataset(db, user_id, version.dataset_id)
    files = list(
        await db.scalars(
            select(DatasetVersionFile)
            .where(DatasetVersionFile.version_id == version.id)
            .order_by(DatasetVersionFile.path)
        )
    )
    paths = [file.path for file in files]
    kind = "snapshot"
    if version.runtime and version.runtime.training:
        kind = "training"
    elif "lab/synthesis.json" in paths:
        kind = "synthesis"
    elif paths and all(Path(path).suffix.lower() in {".txt", ".md"} for path in paths):
        kind = "source"
    return LabVersionView(
        id=str(version.id),
        family_id=str(dataset.id),
        version=version.number,
        name=dataset.name,
        filenames=paths,
        file_ids={file.path: file.id for file in files},
        sha256=version.sha256,
        size_bytes=version.size_bytes,
        created_at=version.created_at.astimezone(timezone.utc),
        kind=kind,
        base_version_id=version.base_version_id,
        can_synthesize=kind == "source"
        and len(files) <= 100
        and version.size_bytes <= MAX_UPLOAD_BYTES,
    )


async def source_chunks(
    db: AsyncSession, user_id: int, version: VersionView
) -> list[dict]:
    view = await version_view(db, user_id, version)
    if not view.can_synthesize:
        raise HTTPException(
            422, "Нужна версия с TXT/Markdown: до 100 файлов, до 10 МБ."
        )
    files = list(
        await db.scalars(
            select(DatasetVersionFile)
            .where(DatasetVersionFile.version_id == version.id)
            .order_by(DatasetVersionFile.path)
        )
    )
    chunks = []
    for file in files:
        snapshot = await datasets.read_version_file(
            db, user_id, version.dataset_id, version.id, file.id
        )
        try:
            _, parts, _ = parse_upload(file.path, snapshot.content)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        chunks.extend(parts)
    if len({chunk["text"] for chunk in chunks}) < 2:
        raise HTTPException(
            422, "Нужны хотя бы два разных фрагмента для train/validation."
        )
    return chunks


async def run_by_id(
    db: AsyncSession, user_id: int, run_id: str, *, lock: bool = False
) -> LabRun:
    query = select(LabRun).where(LabRun.id == run_id, LabRun.user_id == user_id)
    if lock:
        query = query.with_for_update()
    run = await db.scalar(query)
    if run is None:
        raise HTTPException(404, "Прогон не найден.")
    return run


async def catalog(db: AsyncSession) -> Catalog:
    workers = await db.scalars(
        select(LabWorker).where(LabWorker.heartbeat_at > now() - timedelta(seconds=120))
    )
    kinds = {kind for worker in workers for kind in worker.kinds}
    return Catalog(
        teacher_models=settings.LAB_TEACHER_MODELS,
        training_models=settings.LAB_TRAINING_MODELS,
        synthesis_configured=bool(settings.LAB_TEACHER_API_URL),
        synthesis_worker_online="synthesis" in kinds,
        max_upload_bytes=MAX_UPLOAD_BYTES,
    )


async def enqueue(
    db: AsyncSession,
    user_id: int,
    version: VersionView,
    request: SynthesisRequest | TrainingRequest,
    parent: LabRun | None = None,
) -> LabRun:
    # All writers taking both locks use storage -> owner, matching snapshot publication.
    await datasets.lock_storage(db)
    await active_owner(db, user_id, lock=True)
    kind = "training" if parent else "synthesis"
    allowed = settings.LAB_TRAINING_MODELS if parent else settings.LAB_TEACHER_MODELS
    if request.model not in allowed:
        raise HTTPException(422, "Модель отсутствует в разрешённом списке.")
    if not parent and not settings.LAB_TEACHER_API_URL:
        raise HTTPException(409, "Администратор должен подключить модель-генератор.")
    if parent and (parent.kind != "synthesis" or parent.status != "completed"):
        raise HTTPException(409, "Для обучения нужна завершённая версия синтетики.")
    if not parent:
        await source_chunks(db, user_id, version)
    pending = await db.scalar(
        select(func.count())
        .select_from(LabRun)
        .where(LabRun.user_id == user_id, LabRun.status.in_(["queued", "running"]))
    )
    if pending and pending >= 10:
        raise HTTPException(409, "Допускается не более 10 незавершённых задач.")
    number = await db.scalar(
        select(func.max(LabRun.version)).where(
            LabRun.dataset_id == version.dataset_id, LabRun.kind == kind
        )
    )
    config = request.model_dump(exclude={"model"})
    config.update(
        {
            "format_version": 2,
            "input_version_id": version.id,
            "input_sha256": version.sha256,
            "source_version_id": (
                parent.config["source_version_id"] if parent else version.id
            ),
        }
    )
    run = LabRun(
        id=str(uuid4()),
        user_id=user_id,
        dataset_id=version.dataset_id,
        input_version_id=version.id,
        parent_run_id=parent.id if parent else None,
        kind=kind,
        version=(number or 0) + 1,
        model=request.model,
        config=config,
        metrics={},
        status="planned" if parent else "queued",
        created_at=now(),
    )
    db.add(run)
    await db.flush()
    if isinstance(request, TrainingRequest):
        run.output_version_id = (
            await training_snapshot(db, user_id, version, request, run)
        ).id
    await db.commit()
    await db.refresh(run)
    return run


async def training_snapshot(
    db: AsyncSession,
    user_id: int,
    version: VersionView,
    request: TrainingRequest,
    run: LabRun,
) -> VersionView:
    # Matches the PR34 TrainingRuntime contract. No model loading or GPU imports.
    parameters = {
        "model": {
            "name": request.model,
            "use_qlora": request.use_qlora,
            "trust_remote_code": False,
        },
        "lora": {
            "r": request.lora_r,
            "alpha": request.lora_r * 2,
            "target_modules": "all-linear",
        },
        "data": {"train_jsonl": "train.jsonl", "val_jsonl": "val.jsonl"},
        "training": {
            "output_dir": "runs/planned",
            "seed": request.seed,
            "num_train_epochs": request.epochs,
            "learning_rate": request.learning_rate,
            "report_to": "none",
        },
    }
    runtime = RuntimeManifest(
        models=[ModelArtifact(role="base", name=request.model)],
        training=TrainingRuntime(
            train_path="train.jsonl",
            validation_path="val.jsonl",
            prompt_path="prompt_contract.json",
            parameters=parameters,
        ),
    )
    manifest = {
        "status": "planned",
        "run_id": run.id,
        "synthesis_run_id": run.parent_run_id,
        "input_version_id": version.id,
        "input_sha256": version.sha256,
        "runtime": runtime.model_dump(mode="json"),
        "note": "Training has not run. Remote model revision is not pinned; pin before execution.",
    }
    return await datasets.create_version(
        db,
        user_id,
        version.dataset_id,
        VersionCreate(
            base_version_id=version.id,
            runtime=runtime,
            label=f"LoRA · {request.model} · #{run.version}",
            files=[
                SnapshotFile(
                    path="lab/training.json",
                    content=json.dumps(manifest, ensure_ascii=False, indent=2).encode(),
                )
            ],
        ),
    )

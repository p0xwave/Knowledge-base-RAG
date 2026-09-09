from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    field_validator,
    model_validator,
)

Name = Annotated[str, Field(min_length=1, max_length=255)]
Description = Annotated[str, Field(max_length=4000)]


class DatasetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Name
    description: Description = ""


class DatasetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Name | None = None
    description: Description | None = None

    @model_validator(mode="after")
    def reject_null_fields(self) -> Self:
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError(
                "Use an empty description to clear it; null is not allowed"
            )
        return self


class VersionMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    label: Annotated[str, Field(max_length=255)] = ""
    description: Description = ""


class VersionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    label: Annotated[str, Field(max_length=255)] | None = None
    description: Description | None = None

    @model_validator(mode="after")
    def reject_null_fields(self) -> Self:
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError(
                "Use an empty string to clear metadata; null is not allowed"
            )
        return self


class SnapshotPath(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    path: Annotated[str, Field(min_length=1, max_length=1000)]

    @field_validator("path")
    @classmethod
    def validate_path(cls, value: str) -> str:
        path = PurePosixPath(value)
        if (
            path.is_absolute()
            or any(part in {"", ".", ".."} for part in value.split("/"))
            or any(ord(char) < 32 or ord(char) == 127 for char in value)
            or "\\" in value
            or ":" in value
        ):
            raise ValueError("File path must be a safe relative POSIX path")
        return value


class SnapshotFile(SnapshotPath):
    content: bytes


class LocalSnapshotFile(SnapshotPath):
    local_path: Path


ModelRole = Literal["embedding", "reranker", "generator", "base", "adapter"]


class ModelArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    role: ModelRole
    name: Annotated[str, Field(min_length=1, max_length=1000)]
    revision: Annotated[str, Field(min_length=1, max_length=255)] | None = None
    weights_path: str | None = None

    @field_validator("weights_path")
    @classmethod
    def validate_weights_path(cls, value: str | None) -> str | None:
        if value is not None:
            SnapshotPath(path=value)
        return value


class RuntimeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    parameters: dict[str, JsonValue] = Field(default_factory=dict)
    prompt_path: str

    @field_validator("parameters")
    @classmethod
    def reject_secrets(cls, values: dict[str, JsonValue]) -> dict[str, JsonValue]:
        pending: list[JsonValue] = [values]
        while pending:
            item = pending.pop()
            if isinstance(item, dict):
                for key, value in item.items():
                    normalized = key.lower().replace("_", "").replace("-", "")
                    if any(
                        marker in normalized
                        for marker in (
                            "apikey",
                            "password",
                            "secret",
                            "authorization",
                            "credential",
                            "accesstoken",
                        )
                    ) or normalized in {"token", "headers"}:
                        raise ValueError(
                            "Runtime configuration must not contain credentials"
                        )
                    pending.append(value)
            elif isinstance(item, list):
                pending.extend(item)
        return values

    @field_validator("prompt_path")
    @classmethod
    def validate_prompt_path(cls, value: str) -> str:
        return SnapshotPath(path=value).path


class RagRuntime(RuntimeConfig):
    index_path: str
    collection: Annotated[str, Field(min_length=1)]
    strategy: Literal["basic", "rerank", "query_transform"] = "query_transform"

    @field_validator("parameters")
    @classmethod
    def validate_parameters(cls, values: dict[str, JsonValue]) -> dict[str, JsonValue]:
        allowed = {
            "top_k",
            "chunk_size",
            "chunk_overlap",
            "llm_timeout",
            "llm_temperature",
            "llm_max_output_tokens",
        }
        if values.keys() - allowed:
            raise ValueError("Unsupported RAG runtime parameter")
        return values

    @field_validator("index_path")
    @classmethod
    def validate_index_path(cls, value: str) -> str:
        return SnapshotPath(path=value).path


class TrainingRuntime(RuntimeConfig):
    train_path: str
    validation_path: str

    @field_validator("train_path", "validation_path")
    @classmethod
    def validate_data_path(cls, value: str) -> str:
        return SnapshotPath(path=value).path


class RuntimeManifest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: Literal[1] = 1
    models: list[ModelArtifact] = Field(default_factory=list)
    rag: RagRuntime | None = None
    training: TrainingRuntime | None = None
    packages: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_roles(self) -> Self:
        roles = [model.role for model in self.models]
        if len(roles) != len(set(roles)):
            raise ValueError("Model roles must be unique")
        if self.rag is not None and not {"embedding", "reranker", "generator"}.issubset(
            roles
        ):
            raise ValueError(
                "RAG requires embedding, reranker and generator model descriptors"
            )
        if self.training is not None and "base" not in roles:
            raise ValueError("Training requires a base model descriptor")
        return self

    def validate_files(self, paths: set[str]) -> None:
        for model in self.models:
            if model.weights_path and not any(
                path.startswith(f"{model.weights_path}/") for path in paths
            ):
                raise ValueError("Model weight directory is missing from the snapshot")
        required: list[str] = []
        if self.rag is not None:
            required.extend(
                [f"{self.rag.index_path}/chroma.sqlite3", self.rag.prompt_path]
            )
        if self.training is not None:
            required.extend(
                [
                    self.training.train_path,
                    self.training.validation_path,
                    self.training.prompt_path,
                ]
            )
        if not set(required).issubset(paths):
            raise ValueError("Runtime artifacts are missing from the snapshot")


class VersionCreate(VersionMetadata):
    files: list[SnapshotFile] = Field(default_factory=list)
    local_files: list[LocalSnapshotFile] = Field(default_factory=list)
    source_ids: list[Annotated[int, Field(gt=0)]] = Field(default_factory=list)
    base_version_id: Annotated[int, Field(gt=0)] | None = None
    removed_paths: list[str] = Field(default_factory=list)
    runtime: RuntimeManifest | None = None

    @model_validator(mode="after")
    def validate_selection(self) -> Self:
        if len(self.source_ids) != len(set(self.source_ids)):
            raise ValueError("Source IDs must be unique")
        paths = [file.path for file in [*self.files, *self.local_files]]
        if len(paths) != len(set(paths)):
            raise ValueError("File paths must be unique")
        for path in self.removed_paths:
            SnapshotPath(path=path)
        if self.removed_paths and self.base_version_id is None:
            raise ValueError("Removing files requires a base version")
        return self


class DatasetView(DatasetCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime

    updated_at: datetime


class VersionView(VersionMetadata):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    number: int
    base_version_id: int | None
    runtime: RuntimeManifest | None
    sha256: str
    file_count: int
    size_bytes: int
    created_at: datetime


class VersionFileView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path: str
    sha256: str
    size_bytes: int
    source_id: int | None


class Page[T](BaseModel):
    items: list[T]
    total: int
    offset: int
    limit: int

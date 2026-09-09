from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LabVersionView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    family_id: str
    version: int
    name: str
    filenames: list[str]
    file_ids: dict[str, int] = Field(default_factory=dict)
    sha256: str
    size_bytes: int
    kind: Literal["source", "synthesis", "training", "snapshot"]
    base_version_id: int | None
    can_synthesize: bool
    created_at: datetime


class SynthesisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1, max_length=255)
    seed: int = Field(default=42, ge=0, le=2**31 - 1)
    max_chunks: int = Field(default=100, ge=2, le=2000)
    n_qa_per_chunk: int = Field(default=3, ge=1, le=10)
    context_chunks: int = Field(default=3, ge=1, le=10)
    val_fraction: float = Field(default=0.2, ge=0.05, le=0.4)
    teacher_temperature: float = Field(default=0.7, ge=0, le=2)


class TrainingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1, max_length=255)
    seed: int = Field(default=42, ge=0, le=2**31 - 1)
    epochs: float = Field(default=2, ge=0.1, le=20)
    learning_rate: float = Field(default=0.0002, ge=0.000001, le=0.01)
    lora_r: Literal[8, 16, 32, 64] = 16
    use_qlora: bool = True


class RunView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    dataset_id: int
    input_version_id: int | None
    output_version_id: int | None
    parent_run_id: str | None
    kind: Literal["synthesis", "training"]
    version: int
    model: str
    status: Literal["queued", "running", "completed", "failed", "cancelled", "planned"]
    config: dict
    metrics: dict[str, float | int | str]
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class Catalog(BaseModel):
    teacher_models: list[str]
    training_models: list[str]
    synthesis_configured: bool
    synthesis_worker_online: bool
    training_mode: Literal["planned"] = "planned"
    max_upload_bytes: int


class Overview(BaseModel):
    datasets: list[LabVersionView]
    runs: list[RunView]

from datetime import timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.routing import APIRoute
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.dataset.models import DatasetCreate, SnapshotFile, VersionCreate, VersionView
from auth import get_current_user_id
from db import Dataset, DatasetVersion, DatasetVersionFile, LabRun, get_db
from services import dataset_service as datasets
from services.lab_data import MAX_UPLOAD_BYTES, parse_upload

from . import controller as ctl
from .models import (
    Catalog,
    LabVersionView,
    Overview,
    RunView,
    SynthesisRequest,
    TrainingRequest,
)


class BoundedLabRoute(APIRoute):
    """Bound the multipart stream before Starlette can spool arbitrary files."""

    def get_route_handler(self):
        handler = super().get_route_handler()

        async def bounded(request: Request):
            received = 0
            # Includes multipart boundaries/headers for up to 100 documents.
            limit = MAX_UPLOAD_BYTES + 1024 * 1024

            async def receive():
                nonlocal received
                message = await request.receive()
                if message["type"] == "http.request":
                    received += len(message.get("body", b""))
                    if received > limit:
                        raise HTTPException(
                            413, "Размер запроса превышает лимит загрузки."
                        )
                return message

            return await handler(Request(request.scope, receive))

        return bounded


router = APIRouter(prefix="/api/lab", tags=["Dataset Lab"], route_class=BoundedLabRoute)


async def owner(
    user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
) -> int:
    await ctl.active_owner(db, user_id)
    return user_id


@router.get("/catalog", response_model=Catalog)
async def get_catalog(
    _user_id: int = Depends(owner), db: AsyncSession = Depends(get_db)
):
    return await ctl.catalog(db)


@router.get("", response_model=Overview)
async def overview(user_id: int = Depends(owner), db: AsyncSession = Depends(get_db)):
    collections = list(
        await db.scalars(
            select(Dataset)
            .where(Dataset.user_id == user_id)
            .order_by(Dataset.id.desc())
        )
    )
    views = []
    for collection in collections:
        versions = list(
            await db.scalars(
                select(DatasetVersion)
                .where(DatasetVersion.dataset_id == collection.id)
                .order_by(DatasetVersion.number.desc())
            )
        )
        for version in versions:
            views.append(
                await ctl.version_view(db, user_id, VersionView.model_validate(version))
            )
        if not versions:
            views.append(
                LabVersionView(
                    id=f"dataset:{collection.id}",
                    family_id=str(collection.id),
                    version=0,
                    name=collection.name,
                    filenames=[],
                    sha256="",
                    size_bytes=0,
                    created_at=collection.created_at.astimezone(timezone.utc),
                    kind="snapshot",
                    base_version_id=None,
                    can_synthesize=False,
                )
            )
    runs = list(
        await db.scalars(
            select(LabRun)
            .where(LabRun.user_id == user_id)
            .order_by(LabRun.created_at.desc())
        )
    )
    return {"datasets": views, "runs": runs}


@router.post("/datasets", response_model=LabVersionView, status_code=201)
async def upload_dataset(
    files: list[UploadFile] = File(...),
    name: str = Form(..., min_length=1, max_length=120),
    dataset_id: int | None = Form(None),
    user_id: int = Depends(owner),
    db: AsyncSession = Depends(get_db),
):
    name = name.strip()
    if not name:
        raise HTTPException(422, "Укажите название датасета.")
    if not 1 <= len(files) <= 100:
        raise HTTPException(422, "Выберите от 1 до 100 документов.")
    snapshots = []
    names = set()
    size = 0
    for file in files:
        filename = Path((file.filename or "dataset").replace("\\", "/")).name[:255]
        if filename in names:
            raise HTTPException(422, "Имена документов должны быть уникальны.")
        names.add(filename)
        data = await file.read(MAX_UPLOAD_BYTES - size + 1)
        size += len(data)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Общий размер документов больше 10 МБ.")
        try:
            parse_upload(filename, data)
            snapshots.append(SnapshotFile(path=filename, content=data))
        except ValueError as exc:
            raise HTTPException(
                422,
                "Нужен корректный непустой TXT/Markdown в UTF-8 с безопасным именем.",
            ) from exc
    if dataset_id is None:
        dataset_id = (
            await datasets.create_dataset(db, user_id, DatasetCreate(name=name))
        ).id
    else:
        await datasets.get_dataset(db, user_id, dataset_id)
    version = await datasets.create_version(
        db,
        user_id,
        dataset_id,
        VersionCreate(files=snapshots, label="Исходные документы"),
    )
    result = await ctl.version_view(db, user_id, version)
    await db.commit()
    return result


@router.post(
    "/versions/{version_id}/synthesis", response_model=RunView, status_code=202
)
async def synthesize(
    version_id: int,
    request: SynthesisRequest,
    user_id: int = Depends(owner),
    db: AsyncSession = Depends(get_db),
):
    await datasets.lock_storage(db)
    version = await ctl.version_by_id(db, user_id, version_id)
    return await ctl.enqueue(db, user_id, version, request)


@router.post("/runs/{run_id}/training", response_model=RunView, status_code=202)
async def train(
    run_id: str,
    request: TrainingRequest,
    user_id: int = Depends(owner),
    db: AsyncSession = Depends(get_db),
):
    await datasets.lock_storage(db)
    parent = await ctl.run_by_id(db, user_id, run_id)
    if parent.output_version_id is None:
        raise HTTPException(409, "Снимок синтетики отсутствует или удалён.")
    version = await ctl.version_by_id(db, user_id, parent.output_version_id)
    return await ctl.enqueue(db, user_id, version, request, parent)


@router.post("/runs/{run_id}/cancel", response_model=RunView)
async def cancel(
    run_id: str, user_id: int = Depends(owner), db: AsyncSession = Depends(get_db)
):
    run = await ctl.run_by_id(db, user_id, run_id, lock=True)
    if run.status not in {"queued", "planned"}:
        raise HTTPException(409, "Отменить можно только план или задачу в очереди.")
    run.status, run.finished_at = "cancelled", ctl.now()
    await db.commit()
    await db.refresh(run)
    return run


@router.get(
    "/runs/{run_id}/download/{artifact}",
    response_class=Response,
    responses={
        200: {
            "content": {
                "application/octet-stream": {
                    "schema": {"type": "string", "format": "binary"}
                }
            }
        }
    },
)
async def download(
    run_id: str,
    artifact: Literal["train", "val", "manifest"],
    user_id: int = Depends(owner),
    db: AsyncSession = Depends(get_db),
):
    run = await ctl.run_by_id(db, user_id, run_id)
    if run.output_version_id is None:
        raise HTTPException(404, "Снимок результата отсутствует или удалён.")
    filename = {
        "train": "train.jsonl",
        "val": "val.jsonl",
        "manifest": (
            "lab/training.json" if run.kind == "training" else "lab/synthesis.json"
        ),
    }[artifact]
    file_id = await db.scalar(
        select(DatasetVersionFile.id).where(
            DatasetVersionFile.version_id == run.output_version_id,
            DatasetVersionFile.path == filename,
        )
    )
    if file_id is None:
        raise HTTPException(404, "Артефакт не найден.")
    _, path = await datasets.get_version_file_path(
        db, user_id, run.dataset_id, run.output_version_id, file_id
    )
    return FileResponse(
        path,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{run.kind}-{run.version}-{Path(filename).name}"'
        },
    )

from pathlib import PurePosixPath
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse, Response
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from api.common import ErrorMessage
from auth import get_current_user_id
from db import get_db
from services import dataset_service as service

from .models import (
    DatasetCreate,
    DatasetUpdate,
    DatasetView,
    Page,
    RuntimeManifest,
    VersionCreate,
    VersionFileView,
    VersionUpdate,
    VersionView,
)

Session = Annotated[AsyncSession, Depends(get_db, scope="request")]
Owner = Annotated[int, Depends(get_current_user_id)]
PositiveId = Annotated[int, Path(gt=0)]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]

router = APIRouter(
    prefix="/api/dataset",
    tags=["Dataset"],
    responses={
        401: {"model": ErrorMessage, "description": "Invalid credentials"},
        403: {"model": ErrorMessage, "description": "Missing credentials"},
        404: {
            "model": ErrorMessage,
            "description": "Resource not found or not owned by the caller",
        },
    },
)


def _version_metadata(
    label: Annotated[str, Form(max_length=255)] = "",
    description: Annotated[str, Form(max_length=4000)] = "",
    source_ids: list[int] = Form(default_factory=list),
    base_version_id: Annotated[int | None, Form(gt=0)] = None,
    removed_paths: list[str] = Form(default_factory=list),
    runtime: Annotated[
        str | None,
        Form(
            description="RuntimeManifest JSON, with model references and RAG/training settings"
        ),
    ] = None,
) -> VersionCreate:
    try:
        return VersionCreate(
            label=label,
            description=description,
            source_ids=source_ids,
            base_version_id=base_version_id,
            removed_paths=removed_paths,
            runtime=RuntimeManifest.model_validate_json(runtime) if runtime else None,
        )
    except ValidationError as error:
        raise HTTPException(
            422, error.errors(include_input=False, include_context=False)
        ) from error


@router.post("", status_code=201, summary="Create a dataset")
async def create_dataset(
    data: DatasetCreate, db: Session, user_id: Owner
) -> DatasetView:
    result = await service.create_dataset(db, user_id, data)
    await db.commit()
    return result


@router.get("", summary="List owned datasets")
async def list_datasets(
    db: Session, user_id: Owner, offset: Offset = 0, limit: Limit = 20
) -> Page[DatasetView]:
    return await service.list_datasets(db, user_id, offset, limit)


@router.get("/{dataset_id}", summary="Get a dataset")
async def get_dataset(
    dataset_id: PositiveId, db: Session, user_id: Owner
) -> DatasetView:
    return await service.get_dataset(db, user_id, dataset_id)


@router.patch("/{dataset_id}", summary="Update dataset metadata")
async def update_dataset(
    dataset_id: PositiveId, data: DatasetUpdate, db: Session, user_id: Owner
) -> DatasetView:
    result = await service.update_dataset(db, user_id, dataset_id, data)
    await db.commit()
    return result


@router.delete(
    "/{dataset_id}", status_code=204, summary="Delete a dataset and all its snapshots"
)
async def delete_dataset(dataset_id: PositiveId, db: Session, user_id: Owner) -> None:
    await service.delete_dataset(db, user_id, dataset_id)
    await db.commit()
    await service.collect_garbage(db)
    await db.commit()


@router.post(
    "/{dataset_id}/versions",
    status_code=201,
    summary="Create an immutable dataset snapshot",
    description="Upload files and/or repeat source_ids form fields for existing owned documents. "
    "Uploaded filenames are relative snapshot paths. Sources use sources/{id}/{name}. "
    "Use base_version_id to inherit files without uploading them; uploads replace matching paths. "
    "removed_paths excludes files from the new version. Unchanged content is stored once.",
    responses={
        413: {
            "model": ErrorMessage,
            "description": "Snapshot size or file count limit exceeded",
        }
    },
)
async def create_version(
    dataset_id: PositiveId,
    db: Session,
    user_id: Owner,
    metadata: Annotated[VersionCreate, Depends(_version_metadata)],
    files: list[UploadFile] = File(default_factory=list),
) -> VersionView:
    result = await service.create_version(db, user_id, dataset_id, metadata, files)
    await db.commit()
    return result


@router.get("/{dataset_id}/versions", summary="List dataset versions, newest first")
async def list_versions(
    dataset_id: PositiveId,
    db: Session,
    user_id: Owner,
    offset: Offset = 0,
    limit: Limit = 20,
) -> Page[VersionView]:
    return await service.list_versions(db, user_id, dataset_id, offset, limit)


@router.get(
    "/{dataset_id}/versions/{version_id}", summary="Get version metadata and checksum"
)
async def get_version(
    dataset_id: PositiveId, version_id: PositiveId, db: Session, user_id: Owner
) -> VersionView:
    return await service.get_version(db, user_id, dataset_id, version_id)


@router.patch(
    "/{dataset_id}/versions/{version_id}",
    summary="Update version label and description only",
)
async def update_version(
    dataset_id: PositiveId,
    version_id: PositiveId,
    data: VersionUpdate,
    db: Session,
    user_id: Owner,
) -> VersionView:
    result = await service.update_version(db, user_id, dataset_id, version_id, data)
    await db.commit()
    return result


@router.delete(
    "/{dataset_id}/versions/{version_id}",
    status_code=204,
    summary="Delete a snapshot permanently",
)
async def delete_version(
    dataset_id: PositiveId, version_id: PositiveId, db: Session, user_id: Owner
) -> None:
    await service.delete_version(db, user_id, dataset_id, version_id)
    await db.commit()
    await service.collect_garbage(db)
    await db.commit()


@router.get(
    "/{dataset_id}/versions/{version_id}/files",
    summary="List snapshot files without their contents",
)
async def list_version_files(
    dataset_id: PositiveId,
    version_id: PositiveId,
    db: Session,
    user_id: Owner,
    offset: Offset = 0,
    limit: Limit = 20,
) -> Page[VersionFileView]:
    return await service.list_version_files(
        db, user_id, dataset_id, version_id, offset, limit
    )


@router.get(
    "/{dataset_id}/versions/{version_id}/files/{file_id}/download",
    summary="Download the original snapshot bytes",
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
async def download_version_file(
    dataset_id: PositiveId,
    version_id: PositiveId,
    file_id: PositiveId,
    db: Session,
    user_id: Owner,
) -> FileResponse:
    file, path = await service.get_version_file_path(
        db, user_id, dataset_id, version_id, file_id
    )
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=PurePosixPath(file.path).name,
        headers={"X-Content-Type-Options": "nosniff"},
    )

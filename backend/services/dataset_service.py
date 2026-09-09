import hashlib
import io
import json
from collections.abc import AsyncIterator, Sequence
from pathlib import Path

from fastapi import HTTPException, UploadFile
from pydantic import BaseModel, ValidationError
from sqlalchemy import Select, delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.dataset.models import (
    DatasetCreate,
    DatasetUpdate,
    DatasetView,
    Page,
    RuntimeManifest,
    SnapshotFile,
    SnapshotPath,
    VersionCreate,
    VersionFileView,
    VersionUpdate,
    VersionView,
)
from db import (
    Dataset,
    DatasetStorageLock,
    DatasetVersion,
    DatasetVersionFile,
    Source,
    User,
)
from services import dataset_storage as storage
from settings import settings


async def _dataset(db: AsyncSession, user_id: int, dataset_id: int) -> Dataset:
    dataset = await db.scalar(
        select(Dataset)
        .join(User, User.id == Dataset.user_id)
        .where(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id,
            User.is_active.is_(True),
        )
    )
    if dataset is None:
        raise HTTPException(404, "Dataset not found")
    return dataset


async def _version(
    db: AsyncSession, user_id: int, dataset_id: int, version_id: int
) -> DatasetVersion:
    await _dataset(db, user_id, dataset_id)
    version = await db.scalar(
        select(DatasetVersion).where(
            DatasetVersion.id == version_id, DatasetVersion.dataset_id == dataset_id
        )
    )
    if version is None:
        raise HTTPException(404, "Dataset version not found")
    return version


async def _active_user(db: AsyncSession, user_id: int) -> None:
    if (
        await db.scalar(
            select(User.id).where(User.id == user_id, User.is_active.is_(True))
        )
        is None
    ):
        raise HTTPException(404, "User not found")


async def _page[Row, View: BaseModel](
    db: AsyncSession,
    statement: Select[tuple[Row]],
    view: type[View],
    offset: int,
    limit: int,
) -> Page[View]:
    if offset < 0 or not 1 <= limit <= 100:
        raise HTTPException(
            422, "Offset must be nonnegative and limit must be between 1 and 100"
        )
    total = await db.scalar(
        select(func.count()).select_from(statement.order_by(None).subquery())
    )
    rows = await db.scalars(statement.offset(offset).limit(limit))
    return Page[View](
        items=[view.model_validate(row) for row in rows],
        total=total or 0,
        offset=offset,
        limit=limit,
    )


async def create_dataset(
    db: AsyncSession, user_id: int, data: DatasetCreate
) -> DatasetView:
    await _active_user(db, user_id)
    dataset = Dataset(user_id=user_id, name=data.name, description=data.description)
    db.add(dataset)
    await db.flush()
    return DatasetView.model_validate(dataset)


async def list_datasets(
    db: AsyncSession, user_id: int, offset: int = 0, limit: int = 20
) -> Page[DatasetView]:
    await _active_user(db, user_id)
    return await _page(
        db,
        select(Dataset).where(Dataset.user_id == user_id).order_by(Dataset.id.desc()),
        DatasetView,
        offset,
        limit,
    )


async def get_dataset(db: AsyncSession, user_id: int, dataset_id: int) -> DatasetView:
    return DatasetView.model_validate(await _dataset(db, user_id, dataset_id))


async def update_dataset(
    db: AsyncSession, user_id: int, dataset_id: int, data: DatasetUpdate
) -> DatasetView:
    dataset = await _dataset(db, user_id, dataset_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(dataset, key, value)
    await db.flush()
    return DatasetView.model_validate(dataset)


async def delete_dataset(db: AsyncSession, user_id: int, dataset_id: int) -> None:
    await lock_storage(db)
    await _dataset(db, user_id, dataset_id)
    await db.execute(
        delete(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
    )


async def lock_storage(db: AsyncSession) -> None:
    """Serialize publishers, collectors and readers until their transaction ends."""
    await db.execute(
        text(
            "INSERT INTO dataset_storage_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING"
        )
    )
    await db.execute(
        update(DatasetStorageLock).where(DatasetStorageLock.id == 1).values(id=1)
    )


async def collect_garbage(db: AsyncSession) -> int:
    """Delete only unreferenced blobs; call after committing deletions, then commit to unlock."""
    if db.in_transaction():
        raise ValueError(
            "Garbage collection requires a fresh transaction after commit or rollback"
        )
    await lock_storage(db)
    referenced = set(await db.scalars(select(DatasetVersionFile.sha256).distinct()))
    return await storage.storage_io(storage.remove_unreferenced, referenced)


def _add_file(
    files: dict[str, VersionFileView],
    path: str,
    stored: storage.StoredFile,
    source_id: int | None = None,
) -> None:
    SnapshotPath(path=path)
    files[path] = VersionFileView(
        id=0,
        path=path,
        sha256=stored.sha256,
        size_bytes=stored.size_bytes,
        source_id=source_id,
    )
    if len(files) > settings.DATASET_VERSION_MAX_FILES:
        raise HTTPException(413, "Too many files in a dataset version")
    if (
        sum(file.size_bytes for file in files.values())
        > settings.DATASET_VERSION_MAX_BYTES
    ):
        raise HTTPException(413, "Dataset version exceeds the size limit")


async def _source_files(
    db: AsyncSession, user_id: int, source_ids: list[int]
) -> AsyncIterator[tuple[SnapshotFile, int]]:
    for source_id in sorted(source_ids):
        source = await db.scalar(
            select(Source)
            .where(Source.id == source_id, Source.user_id == user_id)
            .with_for_update(read=True)
        )
        if source is None:
            raise HTTPException(404, "Source not found")
        yield SnapshotFile(
            path=f"sources/{source.id}/{source.name}",
            content=source.content.encode("utf-8"),
        ), source.id


async def create_version(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    data: VersionCreate,
    uploads: Sequence[UploadFile] = (),
) -> VersionView:
    """Create an immutable snapshot; the caller commits or rolls back the transaction."""
    await _dataset(db, user_id, dataset_id)
    if (
        len(data.files) + len(data.local_files) + len(data.source_ids) + len(uploads)
        > settings.DATASET_VERSION_MAX_FILES
    ):
        raise HTTPException(413, "Too many files in a dataset version")
    await lock_storage(db)
    files: dict[str, VersionFileView] = {}
    runtime = data.runtime
    if data.base_version_id is not None:
        base = await _version(db, user_id, dataset_id, data.base_version_id)
        if runtime is None and base.runtime is not None:
            runtime = RuntimeManifest.model_validate(base.runtime)
        inherited = await db.scalars(
            select(DatasetVersionFile).where(
                DatasetVersionFile.version_id == data.base_version_id
            )
        )
        files = {file.path: VersionFileView.model_validate(file) for file in inherited}
    for path in data.removed_paths:
        if files.pop(path, None) is None:
            raise HTTPException(422, "Removed path is not present in the base version")
    try:
        paths = [file.path for file in [*data.files, *data.local_files]] + [
            file.filename or "" for file in uploads
        ]
        if len(paths) != len(set(paths)):
            raise HTTPException(
                422, "File paths must be unique across uploads and sources"
            )
        for path in paths:
            SnapshotPath(path=path)
        for file in data.files:
            stored = await storage.storage_io(
                storage.put_stream, io.BytesIO(file.content)
            )
            _add_file(files, file.path, stored)
        async for source, source_id in _source_files(db, user_id, data.source_ids):
            if source.path in paths:
                raise HTTPException(
                    422, "File paths must be unique across uploads and sources"
                )
            stored = await storage.storage_io(
                storage.put_stream, io.BytesIO(source.content)
            )
            _add_file(files, source.path, stored, source_id)
        for local in data.local_files:
            stored = await storage.storage_io(storage.put_path, local.local_path)
            _add_file(files, local.path, stored)
        for upload in uploads:
            stored = await storage.storage_io(storage.put_stream, upload.file)
            _add_file(files, upload.filename or "", stored)
    except storage.SnapshotTooLargeError as error:
        raise HTTPException(413, str(error)) from error
    except ValidationError as error:
        raise HTTPException(422, "Invalid snapshot path") from error
    if not files:
        raise HTTPException(422, "Select at least one file or source")
    if (
        len(files) > settings.DATASET_VERSION_MAX_FILES
        or sum(file.size_bytes for file in files.values())
        > settings.DATASET_VERSION_MAX_BYTES
    ):
        raise HTTPException(413, "Version exceeds configured limits")
    paths = set(files)
    if any(
        "/".join(path.split("/")[:index]) in paths
        for path in paths
        for index in range(1, len(path.split("/")))
    ):
        raise HTTPException(
            422, "A snapshot path cannot be both a file and a directory"
        )
    if runtime is not None:
        try:
            runtime.validate_files(set(files))
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
    snapshots = [
        DatasetVersionFile(
            path=file.path,
            sha256=file.sha256,
            size_bytes=file.size_bytes,
            source_id=file.source_id,
        )
        for file in sorted(files.values(), key=lambda file: file.path)
    ]
    manifest = json.dumps(
        {
            "files": [(file.path, file.sha256, file.size_bytes) for file in snapshots],
            "runtime": runtime.model_dump(mode="json") if runtime else None,
        },
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    number = await db.scalar(
        update(Dataset)
        .where(Dataset.id == dataset_id, Dataset.user_id == user_id)
        .values(next_version=Dataset.next_version + 1)
        .returning(Dataset.next_version - 1)
    )
    if number is None:
        raise HTTPException(404, "Dataset not found")
    version = DatasetVersion(
        dataset_id=dataset_id,
        number=number,
        label=data.label,
        description=data.description,
        sha256=hashlib.sha256(manifest).hexdigest(),
        file_count=len(snapshots),
        size_bytes=sum(file.size_bytes for file in snapshots),
        base_version_id=data.base_version_id,
        runtime=runtime.model_dump(mode="json") if runtime else None,
    )
    db.add(version)
    await db.flush()
    for snapshot in snapshots:
        snapshot.version_id = version.id
    db.add_all(snapshots)
    await db.flush()
    return VersionView.model_validate(version)


async def list_versions(
    db: AsyncSession, user_id: int, dataset_id: int, offset: int = 0, limit: int = 20
) -> Page[VersionView]:
    await _dataset(db, user_id, dataset_id)
    return await _page(
        db,
        select(DatasetVersion)
        .where(DatasetVersion.dataset_id == dataset_id)
        .order_by(DatasetVersion.number.desc()),
        VersionView,
        offset,
        limit,
    )


async def get_version(
    db: AsyncSession, user_id: int, dataset_id: int, version_id: int
) -> VersionView:
    return VersionView.model_validate(
        await _version(db, user_id, dataset_id, version_id)
    )


async def update_version(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    version_id: int,
    data: VersionUpdate,
) -> VersionView:
    version = await _version(db, user_id, dataset_id, version_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(version, key, value)
    await db.flush()
    return VersionView.model_validate(version)


async def delete_version(
    db: AsyncSession, user_id: int, dataset_id: int, version_id: int
) -> None:
    await lock_storage(db)
    await _version(db, user_id, dataset_id, version_id)
    await db.execute(
        delete(DatasetVersion).where(
            DatasetVersion.id == version_id,
            DatasetVersion.dataset_id == dataset_id,
        )
    )


async def list_version_files(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    version_id: int,
    offset: int = 0,
    limit: int = 20,
) -> Page[VersionFileView]:
    await _version(db, user_id, dataset_id, version_id)
    return await _page(
        db,
        select(DatasetVersionFile)
        .where(DatasetVersionFile.version_id == version_id)
        .order_by(DatasetVersionFile.path),
        VersionFileView,
        offset,
        limit,
    )


async def read_version_file(
    db: AsyncSession, user_id: int, dataset_id: int, version_id: int, file_id: int
) -> SnapshotFile:
    file, path = await get_version_file_path(
        db, user_id, dataset_id, version_id, file_id
    )
    content = await storage.storage_io(path.read_bytes)
    return SnapshotFile(path=file.path, content=content)


async def get_version_file_path(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    version_id: int,
    file_id: int,
) -> tuple[VersionFileView, Path]:
    """Keep the transaction open until the consumer has finished reading the file."""
    await lock_storage(db)
    await _version(db, user_id, dataset_id, version_id)
    file = await db.scalar(
        select(DatasetVersionFile).where(
            DatasetVersionFile.id == file_id,
            DatasetVersionFile.version_id == version_id,
        )
    )
    if file is None:
        raise HTTPException(404, "Dataset version file not found")
    path = await storage.storage_io(storage.verify_blob, file.sha256, file.size_bytes)
    return VersionFileView.model_validate(file), path

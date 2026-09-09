import asyncio
import hashlib
import os
import re
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from settings import settings


class SnapshotTooLargeError(ValueError):
    pass


class SnapshotIntegrityError(ValueError):
    pass


@dataclass(frozen=True)
class StoredFile:
    sha256: str
    size_bytes: int


async def storage_io[**P, T](
    function: Callable[P, T], *args: P.args, **kwargs: P.kwargs
) -> T:
    """Finish filesystem work before cancellation releases the transaction lock."""
    task = asyncio.create_task(asyncio.to_thread(function, *args, **kwargs))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        await task
        raise


def blob_path(sha256: str) -> Path:
    if re.fullmatch(r"[0-9a-f]{64}", sha256) is None:
        raise ValueError("Invalid blob digest")
    return settings.DATASET_STORAGE_PATH / "blobs" / sha256[:2] / sha256


def _digest(stream: BinaryIO, limit: int | None = None) -> StoredFile:
    digest = hashlib.sha256()
    size = 0
    while chunk := stream.read(settings.DATASET_FILE_CHUNK_BYTES):
        size += len(chunk)
        if limit is not None and size > limit:
            raise SnapshotTooLargeError("File exceeds the version size limit")
        digest.update(chunk)
    return StoredFile(digest.hexdigest(), size)


def put_stream(stream: BinaryIO) -> StoredFile:
    """Publish immutable bytes atomically; caller holds the database storage lock until commit."""
    stream.seek(0)
    stored = _digest(stream, settings.DATASET_VERSION_MAX_BYTES)
    destination = blob_path(stored.sha256)
    if destination.exists():
        verify_blob(stored.sha256, stored.size_bytes)
        return stored
    destination.parent.mkdir(parents=True, exist_ok=True)
    stream.seek(0)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=destination.parent, prefix=".pending-", delete=False
        ) as output:
            temporary = Path(output.name)
            copied = hashlib.sha256()
            size = 0
            while chunk := stream.read(settings.DATASET_FILE_CHUNK_BYTES):
                size += len(chunk)
                if size > stored.size_bytes:
                    raise SnapshotIntegrityError(
                        "Input changed while taking a snapshot"
                    )
                copied.update(chunk)
                output.write(chunk)
            if copied.hexdigest() != stored.sha256 or size != stored.size_bytes:
                raise SnapshotIntegrityError("Input changed while taking a snapshot")
            output.flush()
            os.fsync(output.fileno())
        try:
            os.link(temporary, destination)
        except FileExistsError:
            if destination.stat().st_size != stored.size_bytes:
                raise SnapshotIntegrityError(
                    "Stored blob size does not match its digest"
                ) from None
        directory_fd = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return stored


def put_path(path: Path) -> StoredFile:
    if not path.is_file():
        raise FileNotFoundError("Snapshot input is not a regular file")
    with path.open("rb") as stream:
        return put_stream(stream)


def verify_blob(sha256: str, size_bytes: int) -> Path:
    path = blob_path(sha256)
    with path.open("rb") as stream:
        actual = _digest(stream)
    if actual.sha256 != sha256 or actual.size_bytes != size_bytes:
        raise SnapshotIntegrityError("Snapshot blob failed its integrity check")
    return path


def remove_unreferenced(referenced: set[str]) -> int:
    """Collect orphan blobs while holding the database storage lock."""
    root = settings.DATASET_STORAGE_PATH / "blobs"
    removed = 0
    for path in root.glob("*/*"):
        if path.name.startswith(".pending-") or (
            re.fullmatch(r"[0-9a-f]{64}", path.name) is not None
            and path.name not in referenced
        ):
            path.unlink()
            removed += 1
    return removed

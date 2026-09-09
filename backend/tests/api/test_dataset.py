import hashlib
import secrets
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.dataset.models import DatasetCreate, SnapshotFile, VersionCreate
from api.dataset.router import router
from auth import create_access_token
from db import DatasetVersion, DatasetVersionFile, Source, User, get_db
from services import dataset_service as service
from services import dataset_storage as storage
from settings import settings


@pytest.fixture
async def dataset_db(
    db_session: AsyncSession, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> AsyncSession:
    monkeypatch.setattr(settings, "DATASET_STORAGE_PATH", tmp_path / "snapshots")
    await db_session.execute(text("PRAGMA foreign_keys=ON"))
    unused_hash = secrets.token_hex(16)
    db_session.add_all(
        [
            User(
                id=1,
                email="owner@example.test",
                username="owner",
                password_hash=unused_hash,
            ),
            User(
                id=2,
                email="other@example.test",
                username="other",
                password_hash=unused_hash,
            ),
        ]
    )
    await db_session.flush()
    db_session.add_all(
        [
            Source(
                id=1,
                user_id=1,
                name="guide.md",
                source_type="md",
                content="original",
                size_bytes=8,
            ),
            Source(
                id=2,
                user_id=2,
                name="private.md",
                source_type="md",
                content="private",
                size_bytes=7,
            ),
        ]
    )
    await db_session.commit()
    return db_session


@pytest.fixture
async def dataset_client(dataset_db: AsyncSession) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.include_router(router)

    async def override_db() -> AsyncIterator[AsyncSession]:
        try:
            yield dataset_db
        finally:
            await dataset_db.rollback()

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {create_access_token({'user_id': 1})}"},
    ) as client:
        yield client


@pytest.fixture
async def dataset_id(dataset_db: AsyncSession) -> int:
    dataset = await service.create_dataset(
        dataset_db, 1, DatasetCreate(name="Knowledge")
    )
    await dataset_db.commit()
    return dataset.id


async def test_dataset_crud(dataset_client: AsyncClient) -> None:
    response = await dataset_client.post("/api/dataset", json={"name": "  Corpus  "})
    assert response.status_code == 201
    dataset = response.json()
    assert dataset["name"] == "Corpus"
    path = f"/api/dataset/{dataset['id']}"
    response = await dataset_client.get(path)
    assert response.json() == dataset
    response = await dataset_client.patch(
        path, json={"description": "For training", "name": "Renamed"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"
    response = await dataset_client.get("/api/dataset", params={"limit": 1})
    assert response.json()["total"] == 1
    assert len(response.json()["items"]) == 1
    assert (await dataset_client.get("/api/dataset", params={"offset": 1})).json()[
        "items"
    ] == []
    assert (await dataset_client.delete(path)).status_code == 204
    assert (await dataset_client.get(path)).status_code == 404


async def test_snapshot_survives_source_changes_and_deletion(
    dataset_client: AsyncClient,
    dataset_db: AsyncSession,
    dataset_id: int,
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    binary = b"\x00\xff\n"
    response = await dataset_client.post(
        path,
        data={"source_ids": "1", "label": "baseline"},
        files=[("files", ("train/data.bin", binary, "application/octet-stream"))],
    )
    assert response.status_code == 201, response.text
    version = response.json()
    assert version["number"] == 1
    assert version["file_count"] == 2
    assert version["size_bytes"] == 11
    files_path = f"{path}/{version['id']}/files"
    file_list = (await dataset_client.get(files_path)).json()["items"]
    assert {file["path"] for file in file_list} == {
        "sources/1/guide.md",
        "train/data.bin",
    }
    assert all("content" not in file for file in file_list)
    source = await dataset_db.get(Source, 1)
    assert source is not None
    source.content = "changed"
    await dataset_db.commit()
    for file in file_list:
        downloaded = await dataset_client.get(f"{files_path}/{file['id']}/download")
        expected = b"original" if file["source_id"] else binary
        assert downloaded.content == expected
        assert hashlib.sha256(downloaded.content).hexdigest() == file["sha256"]
        assert downloaded.headers["content-type"] == "application/octet-stream"
    source = await dataset_db.get(Source, 1)
    assert source is not None
    await dataset_db.delete(source)
    await dataset_db.commit()
    source_file = next(file for file in file_list if file["source_id"])
    response = await dataset_client.get(f"{files_path}/{source_file['id']}/download")
    assert response.content == b"original"


async def test_versions_crud_and_stable_hash(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    files = [("files", ("a.txt", b"a")), ("files", ("b.jsonl", b'{"a":1}\n'))]
    first = (await dataset_client.post(path, files=files)).json()
    second = (await dataset_client.post(path, files=list(reversed(files)))).json()
    assert first["sha256"] == second["sha256"]
    assert (first["number"], second["number"]) == (1, 2)
    response = await dataset_client.get(path, params={"limit": 1})
    assert response.json()["total"] == 2
    assert response.json()["items"][0]["id"] == second["id"]
    version_path = f"{path}/{first['id']}"
    assert (await dataset_client.get(version_path)).json() == first
    response = await dataset_client.patch(
        version_path, json={"label": "Reviewed", "description": "Ready"}
    )
    assert response.status_code == 200
    assert response.json()["label"] == "Reviewed"
    assert response.json()["sha256"] == first["sha256"]
    assert (
        await dataset_client.patch(version_path, json={"files": []})
    ).status_code == 422
    assert (await dataset_client.delete(f"{path}/{second['id']}")).status_code == 204
    third = (await dataset_client.post(path, files=files)).json()
    assert third["number"] == 3
    changed = (
        await dataset_client.post(path, files={"files": ("a.txt", b"changed")})
    ).json()
    assert changed["sha256"] != first["sha256"]


async def test_delete_cascades_only_snapshots(
    dataset_client: AsyncClient,
    dataset_db: AsyncSession,
    dataset_id: int,
) -> None:
    path = f"/api/dataset/{dataset_id}"
    response = await dataset_client.post(f"{path}/versions", data={"source_ids": "1"})
    assert response.status_code == 201, response.text
    version_id = response.json()["id"]
    assert (
        await dataset_client.delete(f"{path}/versions/{version_id}")
    ).status_code == 204
    assert (
        await dataset_db.scalar(select(func.count()).select_from(DatasetVersionFile))
        == 0
    )
    assert (
        await dataset_client.get(f"{path}/versions/{version_id}")
    ).status_code == 404
    await dataset_client.post(f"{path}/versions", data={"source_ids": "1"})
    assert (await dataset_client.delete(path)).status_code == 204
    assert (
        await dataset_db.scalar(select(func.count()).select_from(DatasetVersion)) == 0
    )
    assert (
        await dataset_db.scalar(select(func.count()).select_from(DatasetVersionFile))
        == 0
    )
    assert await dataset_db.get(Source, 1) is not None


@pytest.mark.parametrize(
    "method,suffix,body",
    [
        ("GET", "", None),
        ("PATCH", "", {"name": "stolen"}),
        ("DELETE", "", None),
        ("GET", "/versions", None),
        ("POST", "/versions", None),
        ("GET", "/versions/{version}", None),
        ("PATCH", "/versions/{version}", {"label": "stolen"}),
        ("DELETE", "/versions/{version}", None),
        ("GET", "/versions/{version}/files", None),
        ("GET", "/versions/{version}/files/{file}/download", None),
    ],
)
async def test_foreign_owner_cannot_access(
    dataset_client: AsyncClient,
    dataset_id: int,
    method: str,
    suffix: str,
    body: dict[str, str] | None,
) -> None:
    path = f"/api/dataset/{dataset_id}"
    version = (
        await dataset_client.post(f"{path}/versions", data={"source_ids": "1"})
    ).json()
    file = (await dataset_client.get(f"{path}/versions/{version['id']}/files")).json()[
        "items"
    ][0]
    dataset_client.headers["Authorization"] = (
        f"Bearer {create_access_token({'user_id': 2})}"
    )
    response = await dataset_client.request(
        method,
        path + suffix.format(version=version["id"], file=file["id"]),
        json=body,
    )
    assert response.status_code == 404, response.text
    assert (await dataset_client.get("/api/dataset")).json()["total"] == 0


async def test_source_ownership_and_atomic_failure(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    for source_ids in ([1, 2], [1, 999]):
        response = await dataset_client.post(path, data={"source_ids": source_ids})
        assert response.status_code == 404
    assert (await dataset_client.get(path)).json()["total"] == 0
    response = await dataset_client.post(path, data={"source_ids": "1"})
    assert response.json()["number"] == 1


async def test_wrong_dataset_and_version_ids(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    second_id = (
        await dataset_client.post("/api/dataset", json={"name": "Second"})
    ).json()["id"]
    path = f"/api/dataset/{dataset_id}/versions"
    version_id = (await dataset_client.post(path, data={"source_ids": "1"})).json()[
        "id"
    ]
    second_version = (await dataset_client.post(path, data={"source_ids": "1"})).json()[
        "id"
    ]
    file_id = (await dataset_client.get(f"{path}/{version_id}/files")).json()["items"][
        0
    ]["id"]
    assert (
        await dataset_client.get(f"/api/dataset/{second_id}/versions/{version_id}")
    ).status_code == 404
    assert (
        await dataset_client.get(f"{path}/{second_version}/files/{file_id}/download")
    ).status_code == 404


@pytest.mark.parametrize(
    "path",
    [
        "../secret",
        "/absolute/a",
        "a/../b",
        "a//b",
        "a/./b",
        "C:/file",
        "a\\b",
        "a\x00b",
    ],
)
def test_reject_unsafe_paths(path: str) -> None:
    with pytest.raises(ValidationError):
        SnapshotFile(path=path, content=b"data")


async def test_reject_invalid_input(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    for body in ({"name": " "}, {"name": "x", "user_id": 2}):
        assert (await dataset_client.post("/api/dataset", json=body)).status_code == 422
    path = f"/api/dataset/{dataset_id}"
    assert (await dataset_client.patch(path, json={"name": None})).status_code == 422
    assert (
        await dataset_client.get("/api/dataset", params={"limit": 101})
    ).status_code == 422
    path += "/versions"
    assert (await dataset_client.post(path)).status_code == 422
    assert (
        await dataset_client.post(path, data={"source_ids": [1, 1]})
    ).status_code == 422
    assert (
        await dataset_client.post(path, data={"source_ids": [-1]})
    ).status_code == 422
    assert (
        await dataset_client.post(path, files={"files": ("../secret", b"x")})
    ).status_code == 422
    response = await dataset_client.post(
        path, files=[("files", ("a", b"x")), ("files", ("a", b"y"))]
    )
    assert response.status_code == 422
    response = await dataset_client.post(
        path, data={"source_ids": "1"}, files={"files": ("sources/1/guide.md", b"x")}
    )
    assert response.status_code == 422


async def test_size_and_count_limits(
    dataset_client: AsyncClient,
    dataset_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    monkeypatch.setattr(settings, "DATASET_VERSION_MAX_BYTES", 8)
    assert (
        await dataset_client.post(path, files={"files": ("a", b"123456789")})
    ).status_code == 413
    response = await dataset_client.post(
        path, data={"source_ids": "1"}, files={"files": ("a", b"x")}
    )
    assert response.status_code == 413
    assert (
        await dataset_client.post(path, data={"source_ids": "1"})
    ).status_code == 201
    monkeypatch.setattr(settings, "DATASET_VERSION_MAX_FILES", 1)
    response = await dataset_client.post(
        path, files=[("files", ("a", b"")), ("files", ("b", b""))]
    )
    assert response.status_code == 413


async def test_authentication(
    dataset_client: AsyncClient, dataset_db: AsyncSession
) -> None:
    dataset_client.headers.pop("Authorization")
    assert (await dataset_client.get("/api/dataset")).status_code in {401, 403}
    dataset_client.headers["Authorization"] = "Bearer invalid"
    assert (await dataset_client.get("/api/dataset")).status_code == 401
    owner = await dataset_db.get(User, 1)
    assert owner is not None
    owner.is_active = False
    await dataset_db.commit()
    dataset_client.headers["Authorization"] = (
        f"Bearer {create_access_token({'user_id': 1})}"
    )
    assert (await dataset_client.get("/api/dataset")).status_code == 404


async def test_unicode_and_empty_file(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    response = await dataset_client.post(
        path, files={"files": ("данные/пустой.txt", b"")}
    )
    assert response.status_code == 201
    version = response.json()
    assert version["size_bytes"] == 0
    files_path = f"{path}/{version['id']}/files"
    file = (await dataset_client.get(files_path)).json()["items"][0]
    response = await dataset_client.get(f"{files_path}/{file['id']}/download")
    assert response.status_code == 200
    assert response.content == b""
    assert "filename*=utf-8''" in response.headers["content-disposition"].lower()
    response = await dataset_client.patch(
        f"{path}/{version['id']}", json={"label": None}
    )
    assert response.status_code == 422
    assert (
        await dataset_client.get(f"{files_path}/999999/download")
    ).status_code == 404


async def test_python_api_and_rollback(
    dataset_db: AsyncSession, dataset_id: int
) -> None:
    version = await service.create_version(
        dataset_db,
        1,
        dataset_id,
        VersionCreate(
            files=[SnapshotFile(path="train.jsonl", content=b'{"question":"q"}\n')],
        ),
    )
    files = await service.list_version_files(dataset_db, 1, dataset_id, version.id)
    file = await service.read_version_file(
        dataset_db, 1, dataset_id, version.id, files.items[0].id
    )
    assert file.content == b'{"question":"q"}\n'
    await dataset_db.rollback()
    assert (await service.list_versions(dataset_db, 1, dataset_id)).total == 0
    with pytest.raises(HTTPException) as error:
        await service.create_version(
            dataset_db, 2, dataset_id, VersionCreate(source_ids=[2])
        )
    assert error.value.status_code == 404


async def test_dedup_and_deleting_base_version(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    first = (
        await dataset_client.post(
            path, files=[("files", ("a", b"shared")), ("files", ("b", b"old"))]
        )
    ).json()
    second = (
        await dataset_client.post(
            path, data={"base_version_id": first["id"]}, files={"files": ("b", b"new")}
        )
    ).json()
    assert second["file_count"] == 2
    assert len(list((settings.DATASET_STORAGE_PATH / "blobs").glob("*/*"))) == 3
    files = (await dataset_client.get(f"{path}/{second['id']}/files")).json()["items"]
    assert (await dataset_client.delete(f"{path}/{first['id']}")).status_code == 204
    assert len(list((settings.DATASET_STORAGE_PATH / "blobs").glob("*/*"))) == 2
    for file in files:
        response = await dataset_client.get(
            f"{path}/{second['id']}/files/{file['id']}/download"
        )
        assert response.content == (b"shared" if file["path"] == "a" else b"new")
    assert (await dataset_client.delete(f"{path}/{second['id']}")).status_code == 204
    assert list((settings.DATASET_STORAGE_PATH / "blobs").glob("*/*")) == []


async def test_dedup_across_owners(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    first_path = f"/api/dataset/{dataset_id}"
    await dataset_client.post(
        f"{first_path}/versions", files={"files": ("a", b"shared")}
    )
    dataset_client.headers["Authorization"] = (
        f"Bearer {create_access_token({'user_id': 2})}"
    )
    second_id = (
        await dataset_client.post("/api/dataset", json={"name": "Second"})
    ).json()["id"]
    second_path = f"/api/dataset/{second_id}"
    second = (
        await dataset_client.post(
            f"{second_path}/versions", files={"files": ("different-name", b"shared")}
        )
    ).json()
    assert len(list((settings.DATASET_STORAGE_PATH / "blobs").glob("*/*"))) == 1
    dataset_client.headers["Authorization"] = (
        f"Bearer {create_access_token({'user_id': 1})}"
    )
    await dataset_client.delete(first_path)
    dataset_client.headers["Authorization"] = (
        f"Bearer {create_access_token({'user_id': 2})}"
    )
    files_path = f"{second_path}/versions/{second['id']}/files"
    file = (await dataset_client.get(files_path)).json()["items"][0]
    assert (
        await dataset_client.get(f"{files_path}/{file['id']}/download")
    ).content == b"shared"


async def test_removed_files_and_foreign_base(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    first = (
        await dataset_client.post(
            path, files=[("files", ("a", b"a")), ("files", ("b", b"b"))]
        )
    ).json()
    second = await dataset_client.post(
        path, data={"base_version_id": first["id"], "removed_paths": "b"}
    )
    assert second.status_code == 201
    assert second.json()["file_count"] == 1
    assert (
        await dataset_client.post(
            path, data={"base_version_id": first["id"], "removed_paths": "missing"}
        )
    ).status_code == 422
    other = (await dataset_client.post("/api/dataset", json={"name": "Other"})).json()[
        "id"
    ]
    assert (
        await dataset_client.post(
            f"/api/dataset/{other}/versions", data={"base_version_id": first["id"]}
        )
    ).status_code == 404


async def test_gc_refuses_uncommitted_deletion(
    dataset_db: AsyncSession, dataset_id: int
) -> None:
    version = await service.create_version(
        dataset_db,
        1,
        dataset_id,
        VersionCreate(files=[SnapshotFile(path="a", content=b"safe")]),
    )
    await dataset_db.commit()
    await service.delete_version(dataset_db, 1, dataset_id, version.id)
    with pytest.raises(ValueError, match="fresh transaction"):
        await service.collect_garbage(dataset_db)
    await dataset_db.rollback()
    assert await service.collect_garbage(dataset_db) == 0
    await dataset_db.commit()
    files = await service.list_version_files(dataset_db, 1, dataset_id, version.id)
    assert (
        await service.read_version_file(
            dataset_db, 1, dataset_id, version.id, files.items[0].id
        )
    ).content == b"safe"


async def test_gc_removes_rolled_back_blobs(
    dataset_db: AsyncSession, dataset_id: int
) -> None:
    await service.create_version(
        dataset_db,
        1,
        dataset_id,
        VersionCreate(files=[SnapshotFile(path="a", content=b"orphan")]),
    )
    await dataset_db.rollback()
    assert await service.collect_garbage(dataset_db) == 1
    await dataset_db.commit()


async def test_unchanged_upload_does_not_rewrite_blob(
    dataset_client: AsyncClient, dataset_id: int
) -> None:
    path = f"/api/dataset/{dataset_id}/versions"
    await dataset_client.post(path, files={"files": ("a", b"stable")})
    blob = storage.blob_path(hashlib.sha256(b"stable").hexdigest())
    before = blob.stat()
    await dataset_client.post(path, files={"files": ("a", b"stable")})
    assert blob.stat().st_ino == before.st_ino
    assert blob.stat().st_mtime_ns == before.st_mtime_ns


async def test_training_snapshot_restores_independent_files(
    dataset_db: AsyncSession,
    dataset_id: int,
    tmp_path: Path,
) -> None:
    from lora_train.config import (
        DataConfig,
        LoraTrainConfig,
        ModelConfig,
        TrainingConfig,
    )

    from services.dataset_runtime import capture_training_version, materialize_version

    train = tmp_path / "train.jsonl"
    validation = tmp_path / "val.jsonl"
    model = tmp_path / "base"
    model.mkdir()
    (model / "weights.bin").write_bytes(b"weights")
    train.write_bytes(b"training")
    validation.write_bytes(b"validation")
    config = LoraTrainConfig(
        model=ModelConfig(name=str(model)),
        data=DataConfig(train_jsonl=train, val_jsonl=validation),
        training=TrainingConfig(
            output_dir=tmp_path / "output", report_to="none", seed=17
        ),
    )
    version = await capture_training_version(dataset_db, 1, dataset_id, config)
    await dataset_db.commit()
    train.write_bytes(b"changed")
    async with materialize_version(dataset_db, 1, dataset_id, version.id) as restored:
        restored_config = restored.training_config(tmp_path / "new-output")
        assert restored_config.data.train_jsonl.read_bytes() == b"training"
        assert (
            Path(restored_config.model.name) / "weights.bin"
        ).read_bytes() == b"weights"
        assert restored_config.training.seed == 17
        assert (
            restored_config.data.contract.fingerprint()
            == config.data.contract.fingerprint()
        )
        restored_config.data.train_jsonl.write_bytes(b"working copy changes")
        working_directory = restored.directory
    assert not working_directory.exists()
    async with materialize_version(dataset_db, 1, dataset_id, version.id) as restored:
        assert (
            restored.training_config(tmp_path / "again").data.train_jsonl.read_bytes()
            == b"training"
        )


async def test_corrupted_blob_is_rejected(
    dataset_db: AsyncSession, dataset_id: int
) -> None:
    data = VersionCreate(files=[SnapshotFile(path="a", content=b"safe")])
    version = await service.create_version(dataset_db, 1, dataset_id, data)
    await dataset_db.commit()
    storage.blob_path(hashlib.sha256(b"safe").hexdigest()).write_bytes(b"evil")
    with pytest.raises(storage.SnapshotIntegrityError):
        await service.create_version(dataset_db, 1, dataset_id, data)
    await dataset_db.rollback()
    from services.dataset_runtime import materialize_version

    with pytest.raises(storage.SnapshotIntegrityError):
        async with materialize_version(dataset_db, 1, dataset_id, version.id):
            pytest.fail("Corrupt snapshot was materialized")
    assert list(settings.DATASET_STORAGE_PATH.glob("runtime-*")) == []


async def test_inherited_limits_and_path_conflicts(
    dataset_db: AsyncSession,
    dataset_id: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    version = await service.create_version(
        dataset_db,
        1,
        dataset_id,
        VersionCreate(files=[SnapshotFile(path="a", content=b"original")]),
    )
    await dataset_db.commit()
    monkeypatch.setattr(settings, "DATASET_VERSION_MAX_BYTES", 1)
    with pytest.raises(HTTPException) as error:
        await service.create_version(
            dataset_db, 1, dataset_id, VersionCreate(base_version_id=version.id)
        )
    assert error.value.status_code == 413
    await dataset_db.rollback()
    monkeypatch.setattr(settings, "DATASET_VERSION_MAX_BYTES", 100)
    with pytest.raises(HTTPException) as error:
        await service.create_version(
            dataset_db,
            1,
            dataset_id,
            VersionCreate(
                base_version_id=version.id,
                files=[SnapshotFile(path="a/b", content=b"x")],
            ),
        )
    assert error.value.status_code == 422


@pytest.mark.parametrize(
    "parameters",
    [
        {"llm_api_url": "https://example.test"},
        {"llm_api_key": "placeholder"},
        {"nested": {"password": "placeholder"}},
    ],
)
def test_runtime_rejects_connection_overrides(
    parameters: dict[str, str | dict[str, str]],
) -> None:
    from api.dataset.models import RagRuntime

    with pytest.raises(ValidationError):
        RagRuntime.model_validate(
            {
                "index_path": "index",
                "collection": "docs",
                "prompt_path": "prompt.json",
                "parameters": parameters,
            }
        )


async def test_storage_cancellation_waits_for_worker() -> None:
    import asyncio
    import threading

    started = threading.Event()
    finish = threading.Event()
    completed = threading.Event()

    def worker() -> None:
        started.set()
        if not finish.wait(timeout=5):
            raise TimeoutError("Test worker was not released")
        completed.set()

    task = asyncio.create_task(storage.storage_io(worker))
    try:
        assert await asyncio.to_thread(started.wait, 5)
        task.cancel()
        await asyncio.sleep(0)
        assert not task.done()
    finally:
        finish.set()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert completed.is_set()


async def test_closed_chroma_snapshot_restores_vectors_and_prompt(
    dataset_db: AsyncSession,
    dataset_id: int,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import subprocess
    import sys
    from unittest.mock import Mock

    import numpy as np
    from prompt_contract import GROUNDED_CONTRACT
    from rag.config import Settings as RagSettings

    from services import rag_service
    from services.dataset_runtime import capture_rag_version, materialize_version

    index = tmp_path / "index"
    documents = tmp_path / "documents"
    documents.mkdir()
    (documents / "guide.txt").write_text("frozen document")
    script = """
import sys
import chromadb
from chromadb.config import Settings
client = chromadb.PersistentClient(path=sys.argv[1], settings=Settings(anonymized_telemetry=False))
collection = client.create_collection("snapshot-test")
collection.add(ids=["one"], documents=["frozen document"], embeddings=[[1., 0.]], metadatas=[{"source": "guide.txt"}])
"""
    await storage.storage_io(
        subprocess.run,
        [sys.executable, "-c", script, str(index)],
        check=True,
        capture_output=True,
        timeout=30,
    )
    config = RagSettings(
        device="cpu",
        dataset_path=str(documents),
        chroma_path=str(index),
        chroma_collection="snapshot-test",
        top_k=1,
        embedding_model="test-embedding",
        embedding_revision="pinned",
        rerank_model="test-reranker",
        llm_model_generation="test-generator",
        llm_temperature=0.3,
        llm_max_output_tokens=123,
    )
    contract = GROUNDED_CONTRACT.with_context_chunks(1)
    with pytest.raises(ValueError, match="Stop all index writers"):
        await capture_rag_version(dataset_db, 1, dataset_id, config, contract)
    await dataset_db.rollback()
    version = await capture_rag_version(
        dataset_db, 1, dataset_id, config, contract, index_is_quiescent=True
    )
    await dataset_db.commit()
    embedder = Mock()
    embedder.encode.return_value = np.array([[1.0, 0.0]])
    monkeypatch.setattr(rag_service, "create_embed_model", Mock(return_value=embedder))
    monkeypatch.setattr(rag_service, "create_reranker", Mock())
    monkeypatch.setattr(rag_service, "create_chat_model", Mock())
    answer = Mock(return_value="snapshot answer")
    monkeypatch.setattr(rag_service, "answer", answer)
    async with materialize_version(dataset_db, 1, dataset_id, version.id) as restored:
        rag = await storage.storage_io(restored.rag_service, config)
        response = await storage.storage_io(
            rag.answer_question, "question", strategy="basic"
        )
        assert response.chunks[0].text == "frozen document"
        assert response.answer == "snapshot answer"
        assert (
            answer.call_args.kwargs["contract"].fingerprint() == contract.fingerprint()
        )
        assert rag.settings.embedding_revision == "pinned"
        assert rag.settings.llm_temperature == 0.3
        assert rag.settings.llm_max_output_tokens == 123
    assert not restored.directory.exists()


async def test_runtime_capture_rolls_back_changed_inputs(
    dataset_db: AsyncSession,
    dataset_id: int,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.dataset.models import LocalSnapshotFile, RuntimeManifest
    from services import dataset_runtime

    local = tmp_path / "artifact"
    local.write_bytes(b"original")
    original_states = dataset_runtime._file_states
    calls = 0

    def changed_states(files: list[LocalSnapshotFile]) -> list[tuple[int, int, int]]:
        nonlocal calls
        calls += 1
        states = original_states(files)
        return states if calls == 1 else [(0, 0, 0)]

    monkeypatch.setattr(dataset_runtime, "_file_states", changed_states)
    with pytest.raises(storage.SnapshotIntegrityError, match="changed during capture"):
        await dataset_runtime.capture_runtime_version(
            dataset_db,
            1,
            dataset_id,
            VersionCreate(
                runtime=RuntimeManifest(),
                local_files=[LocalSnapshotFile(path="artifact", local_path=local)],
            ),
        )
    await dataset_db.commit()
    assert (await service.list_versions(dataset_db, 1, dataset_id)).total == 0
    await dataset_db.rollback()
    assert await service.collect_garbage(dataset_db) == 1
    await dataset_db.commit()


async def test_runtime_capture_rejects_environment_files(
    dataset_db: AsyncSession,
    dataset_id: int,
    tmp_path: Path,
) -> None:
    from api.dataset.models import LocalSnapshotFile, RuntimeManifest
    from services.dataset_runtime import capture_runtime_version

    directory = tmp_path / "models"
    directory.mkdir()
    (directory / ".env").write_text("placeholder")
    with pytest.raises(ValueError, match="Environment files"):
        await capture_runtime_version(
            dataset_db,
            1,
            dataset_id,
            VersionCreate(runtime=RuntimeManifest()),
            [LocalSnapshotFile(path="models", local_path=directory)],
        )


def test_model_factories_forward_snapshot_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import Mock

    from rag import factory
    from rag.config import Settings as RagSettings

    embed, rerank, chat = Mock(), Mock(), Mock()
    monkeypatch.setattr(factory, "SentenceTransformer", embed)
    monkeypatch.setattr(factory, "CrossEncoder", rerank)
    monkeypatch.setattr(factory, "ChatModel", chat)
    config = RagSettings(
        device="cpu",
        embedding_revision="embed-sha",
        rerank_revision="rerank-sha",
        llm_temperature=0.7,
        llm_max_output_tokens=77,
    )
    factory.create_embed_model(config)
    factory.create_reranker(config)
    factory.create_chat_model(config)
    assert embed.call_args.kwargs["revision"] == "embed-sha"
    assert rerank.call_args.kwargs["revision"] == "rerank-sha"
    assert chat.call_args.kwargs["temperature"] == 0.7
    assert chat.call_args.kwargs["max_output_tokens"] == 77

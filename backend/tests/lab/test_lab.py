import asyncio
import json
from datetime import timedelta

import pytest

from api.lab.controller import now
from db import LabRun
from services import lab_worker
from services.lab_data import MAX_UPLOAD_BYTES, parse_upload
from settings import settings

pytestmark = pytest.mark.asyncio


async def upload(client, **fields):
    return await client.post(
        "/api/lab/datasets",
        data={"name": "Документы", **fields},
        files=[
            ("files", ("a.md", "Первый независимый контекст.", "text/markdown")),
            ("files", ("b.txt", "Второй независимый контекст.", "text/plain")),
        ],
    )


async def synth(client, dataset_id, **fields):
    return await client.post(
        f"/api/lab/versions/{dataset_id}/synthesis",
        json={"model": settings.LAB_TEACHER_MODELS[0], **fields},
    )


async def test_versions_ownership_auth_and_validation(lab):
    (owner, foreign, inactive), _ = lab
    response = await upload(owner)
    assert response.status_code == 201, response.text
    first = response.json()
    assert first["version"] == 1 and first["kind"] == "source"
    assert "content" not in first and "chunks" not in first
    second = (await upload(owner, dataset_id=first["family_id"])).json()
    assert second["version"] == 2 and second["family_id"] == first["family_id"]
    assert second["id"] != first["id"] and second["sha256"] == first["sha256"]
    assert (await upload(foreign, dataset_id=first["family_id"])).status_code == 404
    assert (await synth(foreign, first["id"])).status_code == 404
    assert (await foreign.get("/api/lab")).json() == {"datasets": [], "runs": []}
    assert (await inactive.get("/api/lab")).status_code == 401
    assert (
        await owner.get("/api/lab", headers={"Authorization": "Bearer invalid"})
    ).status_code == 401
    assert (await synth(owner, first["id"], model="unlisted/model")).status_code == 422
    assert (await synth(owner, first["id"], seed=-1)).status_code == 422
    assert (
        await synth(owner, first["id"], teacher_api_url="http://untrusted.invalid")
    ).status_code == 422


async def test_upload_errors_and_filename_paths(lab):
    (owner, _, _), _ = lab
    for filename, data in [
        ("bad.pdf", b"binary"),
        ("empty.txt", b"  "),
        ("binary.txt", b"\xff"),
        ("null.md", b"a\x00b"),
    ]:
        result = await owner.post(
            "/api/lab/datasets",
            data={"name": "test"},
            files={"files": (filename, data)},
        )
        assert result.status_code == 422
    large = await owner.post(
        "/api/lab/datasets",
        data={"name": "test"},
        files={"files": ("large.txt", b"a" * (MAX_UPLOAD_BYTES + 1))},
    )
    assert large.status_code == 413
    oversized_request = await owner.post(
        "/api/lab/datasets",
        data={"name": "test"},
        files={"files": ("oversized.txt", b"a" * (MAX_UPLOAD_BYTES + 1024 * 1024 + 1))},
    )
    assert oversized_request.status_code == 413
    result = await owner.post(
        "/api/lab/datasets",
        data={"name": "test"},
        files={"files": ("../../escape.md", b"safe text")},
    )
    assert result.json()["filenames"] == ["escape.md"]
    duplicates = await owner.post(
        "/api/lab/datasets",
        data={"name": "test"},
        files=[("files", ("a.txt", b"first")), ("files", ("a.txt", b"second"))],
    )
    assert duplicates.status_code == 422


async def test_synthesis_training_plan_cancel_and_download(lab, monkeypatch):
    (owner, foreign, _), factory = lab
    dataset = (await upload(owner)).json()
    run = (await synth(owner, dataset["id"])).json()
    again = (await synth(owner, dataset["id"])).json()
    assert run["version"] == 1 and again["version"] == 2
    payload = {"model": settings.LAB_TRAINING_MODELS[0]}
    assert (
        await owner.post(f"/api/lab/runs/{run['id']}/training", json=payload)
    ).status_code == 409
    assert (await foreign.post(f"/api/lab/runs/{run['id']}/cancel")).status_code == 404
    assert (await owner.post(f"/api/lab/runs/{again['id']}/cancel")).json()[
        "status"
    ] == "cancelled"
    assert (await owner.post(f"/api/lab/runs/{again['id']}/cancel")).status_code == 409
    assert (
        await owner.get(f"/api/lab/runs/{run['id']}/download/train")
    ).status_code == 404
    await complete_synthesis(factory, monkeypatch)
    response = await owner.get(f"/api/lab/runs/{run['id']}/download/train")
    assert response.status_code == 200 and b'"answer"' in response.content
    assert (
        await foreign.get(f"/api/lab/runs/{run['id']}/download/train")
    ).status_code == 404
    plan = (
        await owner.post(f"/api/lab/runs/{run['id']}/training", json=payload)
    ).json()
    assert plan["status"] == "planned" and plan["metrics"] == {}
    assert plan["parent_run_id"] == run["id"]
    manifest = (await owner.get(f"/api/lab/runs/{plan['id']}/download/manifest")).json()
    assert manifest["synthesis_run_id"] == run["id"] and manifest["status"] == "planned"
    assert (
        await owner.post(f"/api/lab/runs/{plan['id']}/training", json=payload)
    ).status_code == 409


async def test_worker_claim_failure_stale_and_plan_exclusion(lab, monkeypatch):
    (owner, _, _), factory = lab
    monkeypatch.setattr(lab_worker, "sessions", factory)
    dataset = (await upload(owner)).json()
    first = (await synth(owner, dataset["id"])).json()
    claimed = await lab_worker.claim()
    assert claimed.id == first["id"]
    assert await lab_worker.claim() is None
    async with factory() as db:
        row = await db.get(LabRun, first["id"])
        row.heartbeat_at = now() - timedelta(minutes=6)
        await db.commit()
    await lab_worker.claim()
    assert (await owner.get("/api/lab")).json()["runs"][0]["status"] == "failed"
    second = (await synth(owner, dataset["id"])).json()
    claimed = await lab_worker.claim()

    def fail(*_args):
        raise RuntimeError("sensitive external message should not reach users")

    monkeypatch.setattr(lab_worker, "generate", fail)
    await lab_worker.execute("test-worker", claimed)
    async with factory() as db:
        row = await db.get(LabRun, second["id"])
        assert row.status == "failed" and "sensitive" not in row.error


async def test_concurrent_versions_and_claims_postgres(lab, monkeypatch):
    (owner, _, _), factory = lab
    if factory.kw["bind"].dialect.name != "postgresql":
        pytest.skip("Row locking requires real PostgreSQL")
    dataset = (await upload(owner)).json()
    created = await asyncio.gather(*(synth(owner, dataset["id"]) for _ in range(4)))
    assert all(r.status_code == 202 for r in created)
    assert sorted(r.json()["version"] for r in created) == [1, 2, 3, 4]
    monkeypatch.setattr(lab_worker, "sessions", factory)
    claimed = await asyncio.gather(*(lab_worker.claim() for _ in range(4)))
    assert len({job.id for job in claimed}) == 4
    assert await lab_worker.claim() is None


async def complete_synthesis(factory, monkeypatch):
    from dataset_synth import pipeline
    from dataset_synth.teacher import QAPair

    class FakeTeacher:
        def __init__(self, cfg):
            assert cfg.strict_errors and cfg.split_by_context

        def generate(self, text):
            return [QAPair(question=f"Как описывается {text}?", answer=text)]

    monkeypatch.setattr(lab_worker, "sessions", factory)
    monkeypatch.setattr(pipeline, "Teacher", FakeTeacher)
    job = await lab_worker.claim()
    assert job is not None
    await lab_worker.execute("test-worker", job)
    async with factory() as db:
        result = await db.get(LabRun, job.id)
        assert result.status == "completed", result.error
        return result


async def test_generation_uses_snapshots_and_training_restores(
    lab, monkeypatch, tmp_path
):
    from services.dataset_runtime import materialize_version

    (owner, _, _), factory = lab
    source = (await upload(owner)).json()
    await synth(owner, source["id"])
    run = await complete_synthesis(factory, monkeypatch)
    assert run.metrics["train"] == 1 and run.metrics["val"] == 1
    manifest = (await owner.get(f"/api/lab/runs/{run.id}/download/manifest")).json()
    assert "teacher_api_key" not in json.dumps(manifest)
    train = (await owner.get(f"/api/lab/runs/{run.id}/download/train")).json()
    val = (await owner.get(f"/api/lab/runs/{run.id}/download/val")).json()
    assert {c["text"] for c in train["chunks"]}.isdisjoint(
        c["text"] for c in val["chunks"]
    )
    path = f"/api/dataset/{source['family_id']}"
    versions = (await owner.get(f"{path}/versions")).json()["items"]
    assert len(versions) == 2 and versions[0]["base_version_id"] == int(source["id"])
    plan = (
        await owner.post(
            f"/api/lab/runs/{run.id}/training",
            json={"model": settings.LAB_TRAINING_MODELS[0], "lora_r": 32, "seed": 77},
        )
    ).json()
    assert plan["status"] == "planned" and not plan["metrics"]
    async with factory() as db:
        async with materialize_version(
            db, 1, int(source["family_id"]), plan["output_version_id"]
        ) as restored:
            config = restored.training_config(tmp_path / "future-training")
            assert config.lora.r == 32 and config.training.seed == 77
            assert (
                config.training.report_to == "none"
                and not config.model.trust_remote_code
            )
            assert config.data.train_jsonl.is_file() and config.data.val_jsonl.is_file()
            assert (
                config.data.contract.fingerprint()
                == run.metrics["contract_fingerprint"]
            )
    # Removing source or synthesis versions must not destroy inherited training files.
    assert (await owner.delete(f"{path}/versions/{source['id']}")).status_code == 204
    assert (
        await owner.delete(f"{path}/versions/{run.output_version_id}")
    ).status_code == 204
    assert (
        await owner.get(f"/api/lab/runs/{plan['id']}/download/train")
    ).status_code == 200
    assert (
        await owner.post(
            f"/api/lab/runs/{run.id}/training",
            json={"model": settings.LAB_TRAINING_MODELS[0]},
        )
    ).status_code == 409
    overview = (await owner.get("/api/lab")).json()
    assert overview["datasets"][0]["kind"] == "training"
    assert overview["runs"][1]["input_version_id"] is None
    assert (await owner.delete(path)).status_code == 204
    assert (await owner.get("/api/lab")).json() == {"datasets": [], "runs": []}


async def test_import_chunking():
    _, chunks, count = parse_upload("test.txt", ("а" * 6001).encode())
    assert count == 3 and len(chunks[0]["text"]) == 3000


async def test_heartbeat_failure_waits_for_inflight_generation(lab, monkeypatch):
    import threading

    (owner, _, _), factory = lab
    monkeypatch.setattr(lab_worker, "sessions", factory)
    dataset = (await upload(owner)).json()
    await synth(owner, dataset["id"])
    job = await lab_worker.claim()
    started, finish = threading.Event(), threading.Event()

    def generate(*_args):
        started.set()
        finish.wait(timeout=2)
        return {"train": 1, "val": 1}

    async def failed_heartbeat(*_args):
        raise RuntimeError("Connection lost")

    monkeypatch.setattr(lab_worker, "generate", generate)
    monkeypatch.setattr(lab_worker, "heartbeat", failed_heartbeat)
    execution = asyncio.create_task(lab_worker.execute("worker", job))
    try:
        assert await asyncio.to_thread(started.wait, 1)
        assert not execution.done()
    finally:
        finish.set()
        await execution
    async with factory() as db:
        run = await db.get(LabRun, job.id)
        assert run.status == "failed"


async def test_existing_pr_datasets_are_visible_and_reusable(lab):
    (owner, foreign, _), _ = lab
    dataset = (
        await owner.post("/api/dataset", json={"name": "Created by PR API"})
    ).json()
    view = (await owner.get("/api/lab")).json()["datasets"][0]
    assert view["family_id"] == str(dataset["id"]) and view["version"] == 0
    version = (
        await owner.post(
            f"/api/dataset/{dataset['id']}/versions",
            files=[
                ("files", ("a.md", b"first context")),
                ("files", ("b.txt", b"second context")),
            ],
        )
    ).json()
    assert (await synth(owner, version["id"])).status_code == 202
    assert (await synth(foreign, version["id"])).status_code == 404
    view = (await owner.get("/api/lab")).json()["datasets"][0]
    assert view["sha256"] == version["sha256"] and view["can_synthesize"]


async def test_deleted_queued_input_fails_without_teacher(lab, monkeypatch):
    (owner, _, _), factory = lab
    source = (await upload(owner)).json()
    await synth(owner, source["id"])
    await owner.delete(f"/api/dataset/{source['family_id']}/versions/{source['id']}")
    monkeypatch.setattr(lab_worker, "sessions", factory)

    def unexpected(*_args):
        pytest.fail("Teacher must not run without an input snapshot")

    monkeypatch.setattr(lab_worker, "generate", unexpected)
    run = await lab_worker.claim()
    await lab_worker.execute("worker", run)
    result = (await owner.get("/api/lab")).json()["runs"][0]
    assert result["status"] == "failed" and result["input_version_id"] is None

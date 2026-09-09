"""Isolated lab tests: no RAG, teacher, existing database, or mutable corpus."""

import os
import secrets

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.update(
    {
        "POSTGRES_USER": "test",
        "POSTGRES_PASSWORD": "unused",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_DATABASE": "lab_test",
        "JWT_SECRET_KEY": secrets.token_hex(32),
    }
)

from api.dataset.router import router as dataset_router
from api.lab.router import router
from auth import create_access_token
from db import Base, User, get_db
from settings import settings


@pytest.fixture
async def lab(tmp_path, monkeypatch):
    database_url = os.environ.get(
        "LAB_TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:"
    )
    if database_url != "sqlite+aiosqlite:///:memory:" and not database_url.endswith(
        "/lab_test"
    ):
        raise ValueError("Tests may only use the disposable lab_test database")
    engine = create_async_engine(database_url)
    if engine.dialect.name == "sqlite":

        @event.listens_for(engine.sync_engine, "connect")
        def foreign_keys(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add_all(
            [
                User(
                    id=i,
                    email=f"user{i}@example.test",
                    username=f"User {i}",
                    password_hash=secrets.token_hex(32),
                    is_active=i != 3,
                )
                for i in (1, 2, 3)
            ]
        )
        await session.commit()
    app = FastAPI()
    app.include_router(router)
    app.include_router(dataset_router)

    async def get_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = get_session
    monkeypatch.setattr(settings, "LAB_TEACHER_API_URL", "http://teacher.invalid/v1")
    monkeypatch.setattr(settings, "DATASET_STORAGE_PATH", tmp_path / "snapshots")
    clients = []
    for i in (1, 2, 3):
        token = create_access_token({"user_id": i})
        clients.append(
            AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                headers={"Authorization": f"Bearer {token}"},
            )
        )
    yield clients, factory
    for client in clients:
        await client.aclose()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()

import asyncio
import os
from typing import AsyncGenerator

import bcrypt as bcrypt_lib
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

os.environ["POSTGRES_USER"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"
os.environ["POSTGRES_HOST"] = "localhost"
os.environ["POSTGRES_DATABASE"] = "test"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

from db import Base, get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    async_session_factory = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_factory() as session:  # type: ignore[attr-defined]
        yield session


@pytest.fixture(scope="function")
async def client(db_session):
    from httpx import ASGITransport

    from app import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sync_client(db_session):
    from app import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def create_user(db_session):
    async def _create_user(email: str, password: str, username: str = "testuser"):
        password_hash = bcrypt_lib.hashpw(
            password.encode(), bcrypt_lib.gensalt()
        ).decode()

        query = text("""
            INSERT INTO users (email, username, password_hash, is_active, created_at, updated_at)
            VALUES (:email, :username, :password_hash, :is_active, datetime('now'), datetime('now'))
            RETURNING id, email, username, is_active
        """)

        result = await db_session.execute(
            query,
            {
                "email": email,
                "username": username,
                "password_hash": password_hash,
                "is_active": True,
            },
        )
        await db_session.commit()

        user = result.fetchone()
        return {
            "id": user[0],
            "email": user[1],
            "username": user[2],
            "is_active": bool(user[3]),
        }

    return _create_user

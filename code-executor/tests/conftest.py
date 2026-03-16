"""Pytest configuration for code-executor tests."""

import pytest
from app import app
from httpx import ASGITransport, AsyncClient


@pytest.fixture(scope="function")
async def client():
    """Async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

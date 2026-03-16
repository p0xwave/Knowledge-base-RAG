import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_endpoint_disabled(client: AsyncClient):
    response = await client.post(
        "/api/user/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "username": "testuser",
        },
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_auth_success(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")

    response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )

    assert response.status_code == 200
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_auth_wrong_password(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")

    response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "wrongpassword"},
    )

    assert response.status_code == 401
    assert "password" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_user_not_found(client: AsyncClient):
    response = await client.post(
        "/api/user/auth",
        json={"email": "nonexistent@example.com", "password": "password123"},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")

    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.get(
        "/api/user/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert "user_id" in data


@pytest.mark.asyncio
async def test_get_current_user_unauthorized(client: AsyncClient):
    response = await client.get("/api/user/me")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_user_email(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")

    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.put(
        "/api/user",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": "newemail@example.com"},
    )

    assert response.status_code == 204

    me_response = await client.get(
        "/api/user/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me_response.json()["email"] == "newemail@example.com"


@pytest.mark.asyncio
async def test_update_user_password(client: AsyncClient, create_user):
    await create_user("test@example.com", "oldpassword", "testuser")

    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "oldpassword"}
    )
    token = auth_response.json()["access_token"]

    response = await client.put(
        "/api/user",
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": "oldpassword", "new_password": "newpassword123"},
    )

    assert response.status_code == 204

    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "newpassword123"},
    )
    assert auth_response.status_code == 200


@pytest.mark.asyncio
async def test_update_user_wrong_old_password(client: AsyncClient, create_user):
    await create_user("test@example.com", "oldpassword", "testuser")

    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "oldpassword"}
    )
    token = auth_response.json()["access_token"]

    response = await client.put(
        "/api/user",
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": "wrongoldpassword", "new_password": "newpassword123"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")

    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.delete(
        "/api/user", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 204

    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    assert auth_response.status_code == 403

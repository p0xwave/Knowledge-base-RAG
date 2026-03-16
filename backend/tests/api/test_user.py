"""Тесты для User API.

ВАЖНО: Endpoint /api/user/register отключен для безопасности.
Пользователи создаются напрямую в БД через fixture create_user().
"""

import pytest
from httpx import AsyncClient

# ============================================================================
# Тесты регистрации (endpoint ОТКЛЮЧЕН)
# ============================================================================


@pytest.mark.asyncio
async def test_register_endpoint_disabled(client: AsyncClient):
    """Тест что endpoint /register отключен."""
    response = await client.post(
        "/api/user/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "username": "testuser"
        }
    )

    # Endpoint не существует (закомментирован в router.py)
    assert response.status_code == 404


# ============================================================================
# Тесты аутентификации
# ============================================================================


@pytest.mark.asyncio
async def test_auth_success(client: AsyncClient, create_user):
    """Тест успешной аутентификации."""
    # Создание пользователя напрямую в БД
    await create_user("test@example.com", "password123", "testuser")

    # Аутентификация
    response = await client.post(
        "/api/user/auth",
        json={
            "email": "test@example.com",
            "password": "password123"
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_auth_wrong_password(client: AsyncClient, create_user):
    """Тест аутентификации с неверным паролем."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")

    # Попытка входа с неверным паролем
    response = await client.post(
        "/api/user/auth",
        json={
            "email": "test@example.com",
            "password": "wrongpassword"
        }
    )

    assert response.status_code == 401
    assert "password" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_user_not_found(client: AsyncClient):
    """Тест аутентификации несуществующего пользователя."""
    response = await client.post(
        "/api/user/auth",
        json={
            "email": "nonexistent@example.com",
            "password": "password123"
        }
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============================================================================
# Тесты получения данных пользователя
# ============================================================================


@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient, create_user):
    """Тест получения данных текущего пользователя."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")

    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={
            "email": "test@example.com",
            "password": "password123"
        }
    )
    token = auth_response.json()["access_token"]

    # Получение данных пользователя
    response = await client.get(
        "/api/user/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert "user_id" in data


@pytest.mark.asyncio
async def test_get_current_user_unauthorized(client: AsyncClient):
    """Тест получения данных без токена."""
    response = await client.get("/api/user/me")

    assert response.status_code == 401  # Unauthorized (no token)


# ============================================================================
# Тесты обновления данных пользователя
# ============================================================================


@pytest.mark.asyncio
async def test_update_user_email(client: AsyncClient, create_user):
    """Тест обновления email пользователя."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")

    # Аутентификация
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    # Обновление email
    response = await client.put(
        "/api/user",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": "newemail@example.com"}
    )

    assert response.status_code == 204

    # Проверка обновления
    me_response = await client.get(
        "/api/user/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_response.json()["email"] == "newemail@example.com"


@pytest.mark.asyncio
async def test_update_user_password(client: AsyncClient, create_user):
    """Тест обновления пароля пользователя."""
    # Создание пользователя
    await create_user("test@example.com", "oldpassword", "testuser")

    # Аутентификация
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "oldpassword"}
    )
    token = auth_response.json()["access_token"]

    # Обновление пароля
    response = await client.put(
        "/api/user",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "old_password": "oldpassword",
            "new_password": "newpassword123"
        }
    )

    assert response.status_code == 204

    # Проверка нового пароля
    auth_response = await client.post(
        "/api/user/auth",
        json={
            "email": "test@example.com",
            "password": "newpassword123"
        }
    )
    assert auth_response.status_code == 200


@pytest.mark.asyncio
async def test_update_user_wrong_old_password(client: AsyncClient, create_user):
    """Тест обновления пароля с неверным старым паролем."""
    # Создание пользователя
    await create_user("test@example.com", "oldpassword", "testuser")

    # Аутентификация
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "oldpassword"}
    )
    token = auth_response.json()["access_token"]

    # Попытка обновления с неверным старым паролем
    response = await client.put(
        "/api/user",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "old_password": "wrongoldpassword",
            "new_password": "newpassword123"
        }
    )

    assert response.status_code == 401


# ============================================================================
# Тесты удаления пользователя
# ============================================================================


@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient, create_user):
    """Тест удаления (деактивации) пользователя."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")

    # Аутентификация
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    # Удаление пользователя
    response = await client.delete(
        "/api/user",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 204

    # Попытка входа после удаления (должна быть запрещена)
    auth_response = await client.post(
        "/api/user/auth",
        json={
            "email": "test@example.com",
            "password": "password123"
        }
    )
    assert auth_response.status_code == 403  # Account is inactive

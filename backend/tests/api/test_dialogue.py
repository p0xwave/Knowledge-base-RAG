import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_dialogue(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "My first dialogue"},
    )

    assert response.status_code == 201
    data = response.json()

    assert "dialogue_id" in data
    assert data["name"] == "My first dialogue"
    assert "created_at" in data
    assert "updated_at" in data
    assert "pre_generated_queries" in data
    assert len(data["pre_generated_queries"]) > 0


@pytest.mark.asyncio
async def test_create_dialogue_default_name(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.post(
        "/api/dialogue", headers={"Authorization": f"Bearer {token}"}, json={}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New conversation"


@pytest.mark.asyncio
async def test_create_dialogue_unauthorized(client: AsyncClient, create_user):
    response = await client.post("/api/dialogue", json={"name": "Test"})

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_dialogue(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    create_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test dialogue"},
    )
    dialogue_id = create_response.json()["dialogue_id"]

    response = await client.get(
        f"/api/dialogue/{dialogue_id}", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["dialogue_id"] == dialogue_id
    assert data["name"] == "Test dialogue"
    assert "pre_generated_queries" in data


@pytest.mark.asyncio
async def test_get_dialogue_not_found(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.get(
        "/api/dialogue/99999", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_dialogue_other_user(client: AsyncClient, create_user):
    await create_user("user1@example.com", "password123", "user1")

    auth1 = await client.post(
        "/api/user/auth", json={"email": "user1@example.com", "password": "password123"}
    )
    token1 = auth1.json()["access_token"]

    create_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token1}"},
        json={"name": "User1's dialogue"},
    )
    dialogue_id = create_response.json()["dialogue_id"]

    await create_user("user2@example.com", "password123", "user2")

    auth2 = await client.post(
        "/api/user/auth", json={"email": "user2@example.com", "password": "password123"}
    )
    token2 = auth2.json()["access_token"]

    response = await client.get(
        f"/api/dialogue/{dialogue_id}", headers={"Authorization": f"Bearer {token2}"}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_dialogues_list(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Dialogue 1"},
    )
    await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Dialogue 2"},
    )
    await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Dialogue 3"},
    )

    response = await client.get(
        "/api/dialogue", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) == 3
    assert all("dialogue_id" in d for d in data)
    assert all("name" in d for d in data)


@pytest.mark.asyncio
async def test_get_dialogues_with_search(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "PyTorch tutorial"},
    )
    await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "TensorFlow guide"},
    )
    await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "PyTorch advanced"},
    )

    response = await client.get(
        "/api/dialogue?query=pytorch", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    assert all("pytorch" in d["name"].lower() for d in data)


@pytest.mark.asyncio
async def test_update_dialogue(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    create_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Old name"},
    )
    dialogue_id = create_response.json()["dialogue_id"]

    response = await client.put(
        f"/api/dialogue/{dialogue_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "New name"},
    )

    assert response.status_code == 204

    get_response = await client.get(
        f"/api/dialogue/{dialogue_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert get_response.json()["name"] == "New name"


@pytest.mark.asyncio
async def test_update_dialogue_not_found(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.put(
        "/api/dialogue/99999",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "New name"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_dialogue(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    create_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "To be deleted"},
    )
    dialogue_id = create_response.json()["dialogue_id"]

    response = await client.delete(
        f"/api/dialogue/{dialogue_id}", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 204

    get_response = await client.get(
        f"/api/dialogue/{dialogue_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_dialogue_not_found(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.delete(
        "/api/dialogue/99999", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 404

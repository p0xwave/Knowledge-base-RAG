import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_upload_source(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    file_content = "This is a test markdown document.\n# Hello World"
    files = {"file": ("test.md", io.BytesIO(file_content.encode()), "text/markdown")}

    response = await client.post(
        "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
    )

    assert response.status_code == 201
    data = response.json()

    assert "source_id" in data
    assert data["name"] == "test.md"
    assert data["source_type"] == "md"
    assert data["size_bytes"] == len(file_content)
    assert "created_at" in data


@pytest.mark.asyncio
async def test_upload_source_txt(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    file_content = "Plain text content"
    files = {"file": ("notes.txt", io.BytesIO(file_content.encode()), "text/plain")}

    response = await client.post(
        "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
    )

    assert response.status_code == 201
    assert response.json()["source_type"] == "txt"


@pytest.mark.asyncio
async def test_upload_source_empty_file(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}

    response = await client.post(
        "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
    )

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_source_unsupported_type(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    file_content = b"binary content"
    files = {"file": ("file.exe", io.BytesIO(file_content), "application/exe")}

    response = await client.post(
        "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
    )

    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_sources_list(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    for i in range(3):
        files = {
            "file": (
                f"file{i}.md",
                io.BytesIO(f"Content {i}".encode()),
                "text/markdown",
            )
        }
        await client.post(
            "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
        )

    response = await client.get(
        "/api/source", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["total_count"] == 3
    assert data["page"] == 1
    assert data["limit"] == 10
    assert len(data["sources"]) == 3


@pytest.mark.asyncio
async def test_get_sources_list_with_pagination(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    for i in range(5):
        files = {
            "file": (f"file{i}.txt", io.BytesIO(f"Content {i}".encode()), "text/plain")
        }
        await client.post(
            "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
        )

    response = await client.get(
        "/api/source?page=1&limit=2", headers={"Authorization": f"Bearer {token}"}
    )

    data = response.json()
    assert data["total_count"] == 5
    assert data["total_pages"] == 3
    assert len(data["sources"]) == 2


@pytest.mark.asyncio
async def test_get_sources_list_with_search(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    files_to_upload = [
        ("pytorch_guide.md", "PyTorch guide"),
        ("tensorflow_doc.txt", "TensorFlow doc"),
        ("pytorch_tutorial.md", "PyTorch tutorial"),
    ]

    for filename, content in files_to_upload:
        files = {"file": (filename, io.BytesIO(content.encode()), "text/plain")}
        await client.post(
            "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
        )

    response = await client.get(
        "/api/source?query=pytorch", headers={"Authorization": f"Bearer {token}"}
    )

    data = response.json()
    assert data["total_count"] == 2
    assert all("pytorch" in s["name"].lower() for s in data["sources"])


@pytest.mark.asyncio
async def test_get_source_content(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    file_content = "# PyTorch Tutorial\n\nThis is a guide."
    files = {
        "file": ("tutorial.md", io.BytesIO(file_content.encode()), "text/markdown")
    }

    upload_response = await client.post(
        "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
    )
    source_id = upload_response.json()["source_id"]

    response = await client.get(
        f"/api/source/{source_id}", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["source_id"] == source_id
    assert data["content"] == file_content
    assert data["name"] == "tutorial.md"


@pytest.mark.asyncio
async def test_get_source_not_found(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.get(
        "/api/source/99999", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_download_source(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    file_content = "Downloadable content"
    files = {"file": ("download.txt", io.BytesIO(file_content.encode()), "text/plain")}

    upload_response = await client.post(
        "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
    )
    source_id = upload_response.json()["source_id"]

    response = await client.get(
        f"/api/source/{source_id}/download",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.content.decode() == file_content
    assert "attachment" in response.headers["content-disposition"]
    assert "download.txt" in response.headers["content-disposition"]


@pytest.mark.asyncio
async def test_delete_source(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    files = {"file": ("to_delete.md", io.BytesIO(b"Content"), "text/markdown")}
    upload_response = await client.post(
        "/api/source", headers={"Authorization": f"Bearer {token}"}, files=files
    )
    source_id = upload_response.json()["source_id"]

    response = await client.delete(
        f"/api/source/{source_id}", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 204

    get_response = await client.get(
        f"/api/source/{source_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_source_not_found(client: AsyncClient, create_user):
    await create_user("test@example.com", "password123", "testuser")
    auth_response = await client.post(
        "/api/user/auth", json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    response = await client.delete(
        "/api/source/99999", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 404

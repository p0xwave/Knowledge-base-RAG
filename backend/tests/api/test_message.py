"""Тесты для Message API."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_send_message_success(client: AsyncClient, create_user):
    """Тест отправки сообщения с успешным ответом от RAG."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    # Создание диалога
    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test dialogue"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование RAG API
    mock_rag_response = {
        "response": "PyTorch is a deep learning framework. [§1] [§2]"
    }

    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value=mock_rag_response)
        mock_response.raise_for_status = AsyncMock()

        mock_post = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value.post = mock_post

        # Отправка сообщения
        response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "What is PyTorch?"
            }
        )

    assert response.status_code == 201
    data = response.json()

    assert "message_id" in data
    assert data["user_message"] == "What is PyTorch?"
    assert data["assistant_response"] == "PyTorch is a deep learning framework. [§1] [§2]"
    assert isinstance(data["sources"], list)
    assert isinstance(data["code_executions"], list)
    assert "created_at" in data


@pytest.mark.asyncio
async def test_send_message_dialogue_not_found(client: AsyncClient, create_user):
    """Тест отправки сообщения в несуществующий диалог."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    # Попытка отправить сообщение в несуществующий диалог
    response = await client.post(
        "/api/message",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "dialogue_id": 99999,
            "message": "Test"
        }
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_send_message_unauthorized(client: AsyncClient, create_user):
    """Тест отправки сообщения без токена."""
    response = await client.post(
        "/api/message",
        json={
            "dialogue_id": 1,
            "message": "Test"
        }
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_send_message_rag_api_unavailable(client: AsyncClient, create_user):
    """Тест обработки ошибки подключения к RAG API."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование ошибки RAG API
    import httpx

    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        mock_post = AsyncMock(side_effect=httpx.RequestError("Connection failed"))
        mock_client.return_value.__aenter__.return_value.post = mock_post

        response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "Test"
            }
        )

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_set_feedback_like(client: AsyncClient, create_user):
    """Тест установки положительной обратной связи."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование RAG API
    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={"response": "Answer"})
        mock_response.raise_for_status = AsyncMock()
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        message_response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "Test"
            }
        )

    message_id = message_response.json()["message_id"]

    # Установка like
    response = await client.post(
        "/api/message/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "message_id": message_id,
            "feedback": "like"
        }
    )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_set_feedback_dislike(client: AsyncClient, create_user):
    """Тест установки отрицательной обратной связи."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование RAG API
    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.json = AsyncMock(return_value={"response": "Answer"})
        mock_response.raise_for_status = AsyncMock()
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

        message_response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "Test"
            }
        )

    message_id = message_response.json()["message_id"]

    # Установка dislike
    response = await client.post(
        "/api/message/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "message_id": message_id,
            "feedback": "dislike"
        }
    )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_set_feedback_message_not_found(client: AsyncClient, create_user):
    """Тест установки обратной связи на несуществующее сообщение."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    # Попытка установить feedback на несуществующее сообщение
    response = await client.post(
        "/api/message/feedback",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "message_id": 99999,
            "feedback": "like"
        }
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_send_message_with_code_execution(client: AsyncClient, create_user):
    """Тест отправки сообщения с кодом в ответе RAG."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование RAG API с кодом в ответе
    mock_rag_response = {
        "response": "Here's an example:\n```python\nresult = 2 + 2\n```"
    }

    # Мокирование code-executor API
    mock_executor_response = {
        "success": True,
        "stdout": "",
        "stderr": "",
        "result": "4",
        "error": None
    }

    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        # Создаём два разных mock объекта для разных вызовов
        mock_rag = AsyncMock()
        mock_rag.json = AsyncMock(return_value=mock_rag_response)
        mock_rag.raise_for_status = AsyncMock()

        mock_executor = AsyncMock()
        mock_executor.json = AsyncMock(return_value=mock_executor_response)
        mock_executor.raise_for_status = AsyncMock()

        # Настраиваем последовательность вызовов
        mock_post = AsyncMock(side_effect=[mock_rag, mock_executor])
        mock_client.return_value.__aenter__.return_value.post = mock_post

        response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "Show me an example"
            }
        )

    assert response.status_code == 201
    data = response.json()

    assert "code_executions" in data
    assert len(data["code_executions"]) == 1
    assert data["code_executions"][0]["code"] == "result = 2 + 2"
    assert data["code_executions"][0]["success"] is True
    assert data["code_executions"][0]["result"] == "4"


@pytest.mark.asyncio
async def test_send_message_with_multiple_code_blocks(client: AsyncClient, create_user):
    """Тест отправки сообщения с несколькими блоками кода."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование RAG API с двумя блоками кода
    mock_rag_response = {
        "response": "First:\n```python\nresult = 1 + 1\n```\nSecond:\n```py\nresult = 2 * 2\n```"
    }

    # Мокирование code-executor API
    mock_executor_response_1 = {
        "success": True,
        "stdout": "",
        "stderr": "",
        "result": "2",
        "error": None
    }

    mock_executor_response_2 = {
        "success": True,
        "stdout": "",
        "stderr": "",
        "result": "4",
        "error": None
    }

    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        mock_rag = AsyncMock()
        mock_rag.json = AsyncMock(return_value=mock_rag_response)
        mock_rag.raise_for_status = AsyncMock()

        mock_executor_1 = AsyncMock()
        mock_executor_1.json = AsyncMock(return_value=mock_executor_response_1)
        mock_executor_1.raise_for_status = AsyncMock()

        mock_executor_2 = AsyncMock()
        mock_executor_2.json = AsyncMock(return_value=mock_executor_response_2)
        mock_executor_2.raise_for_status = AsyncMock()

        mock_post = AsyncMock(side_effect=[mock_rag, mock_executor_1, mock_executor_2])
        mock_client.return_value.__aenter__.return_value.post = mock_post

        response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "Show me examples"
            }
        )

    assert response.status_code == 201
    data = response.json()

    assert "code_executions" in data
    assert len(data["code_executions"]) == 2
    assert data["code_executions"][0]["result"] == "2"
    assert data["code_executions"][1]["result"] == "4"


@pytest.mark.asyncio
async def test_send_message_with_code_execution_error(client: AsyncClient, create_user):
    """Тест обработки ошибки выполнения кода."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование RAG API с кодом, который вызывает ошибку
    mock_rag_response = {
        "response": "```python\nresult = 1 / 0\n```"
    }

    # Мокирование code-executor API с ошибкой
    mock_executor_response = {
        "success": False,
        "stdout": "",
        "stderr": "",
        "result": None,
        "error": "ZeroDivisionError: division by zero"
    }

    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        mock_rag = AsyncMock()
        mock_rag.json = AsyncMock(return_value=mock_rag_response)
        mock_rag.raise_for_status = AsyncMock()

        mock_executor = AsyncMock()
        mock_executor.json = AsyncMock(return_value=mock_executor_response)
        mock_executor.raise_for_status = AsyncMock()

        mock_post = AsyncMock(side_effect=[mock_rag, mock_executor])
        mock_client.return_value.__aenter__.return_value.post = mock_post

        response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "Show me an error"
            }
        )

    assert response.status_code == 201
    data = response.json()

    assert "code_executions" in data
    assert len(data["code_executions"]) == 1
    assert data["code_executions"][0]["success"] is False
    assert "ZeroDivisionError" in data["code_executions"][0]["error"]


@pytest.mark.asyncio
async def test_send_message_code_executor_unavailable(client: AsyncClient, create_user):
    """Тест обработки недоступности code-executor."""
    # Создание пользователя
    await create_user("test@example.com", "password123", "testuser")
    # Аутентификация для получения токена
    auth_response = await client.post(
        "/api/user/auth",
        json={"email": "test@example.com", "password": "password123"}
    )
    token = auth_response.json()["access_token"]

    dialogue_response = await client.post(
        "/api/dialogue",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Test"}
    )
    dialogue_id = dialogue_response.json()["dialogue_id"]

    # Мокирование RAG API с кодом
    mock_rag_response = {
        "response": "```python\nresult = 2 + 2\n```"
    }

    import httpx

    with patch("api.message.controller.httpx.AsyncClient") as mock_client:
        mock_rag = AsyncMock()
        mock_rag.json = AsyncMock(return_value=mock_rag_response)
        mock_rag.raise_for_status = AsyncMock()

        # Второй вызов (к code-executor) завершается ошибкой
        mock_post = AsyncMock(side_effect=[
            mock_rag,
            httpx.RequestError("Connection failed")
        ])
        mock_client.return_value.__aenter__.return_value.post = mock_post

        response = await client.post(
            "/api/message",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "dialogue_id": dialogue_id,
                "message": "Show me code"
            }
        )

    assert response.status_code == 201
    data = response.json()

    # Ответ должен быть успешным, но с ошибкой выполнения кода
    assert "code_executions" in data
    assert len(data["code_executions"]) == 1
    assert data["code_executions"][0]["success"] is False
    assert "unavailable" in data["code_executions"][0]["error"].lower()

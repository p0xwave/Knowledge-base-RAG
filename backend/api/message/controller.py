"""Бизнес-логика для Message API."""

import httpx
from db import Dialogue, Message
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .code_parser import parse_and_execute_code
from .models import CodeExecution, MessageFeedback, MessageResponse, SendMessage

# URL сервисов (можно вынести в настройки)
RAG_API_URL = "http://localhost:8000/forward"
CODE_EXECUTOR_URL = "http://localhost:8002/execute"


async def send_message(
    data: SendMessage,
    user_id: int,
    db: AsyncSession
) -> MessageResponse:
    """
    Отправка сообщения и получение ответа от RAG.

    Args:
        data: Данные сообщения
        user_id: ID пользователя (из JWT токена)
        db: Сессия БД

    Returns:
        MessageResponse: Ответ с message_id и ответом ассистента

    Raises:
        HTTPException: 404 если диалог не найден, 500 если RAG API недоступен
    """
    # Проверка существования диалога и принадлежности пользователю
    result = await db.execute(
        select(Dialogue).where(
            Dialogue.id == data.dialogue_id,
            Dialogue.user_id == user_id
        )
    )
    dialogue = result.scalar_one_or_none()

    if not dialogue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dialogue not found"
        )

    # Создание записи сообщения (пока без ответа)
    new_message = Message(
        dialogue_id=data.dialogue_id,
        user_message=data.message,
        assistant_response=None  # Заполним после получения от RAG
    )

    db.add(new_message)
    await db.flush()  # Получить ID без commit

    # Запрос к RAG API
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            rag_response = await client.post(
                RAG_API_URL,
                json={
                    "text": data.message,
                    "tg_user_id": user_id  # Опционально для истории
                }
            )
            rag_response.raise_for_status()
            rag_data = await rag_response.json()

            # Получение ответа от RAG
            assistant_response = rag_data.get("response", "")

    except httpx.RequestError as e:
        # Ошибка подключения к RAG API
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"RAG API unavailable: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        # RAG API вернул ошибку
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG API error: {e.response.status_code}"
        )

    # Обновление сообщения с ответом ассистента
    new_message.assistant_response = assistant_response

    await db.commit()
    await db.refresh(new_message)

    # Извлечение источников из ответа (парсинг [§N] ссылок)
    # TODO: улучшить парсинг источников из ответа RAG
    sources = extract_sources_from_response(assistant_response)

    # Парсинг и выполнение кода из ответа
    code_results = await parse_and_execute_code(assistant_response, CODE_EXECUTOR_URL)
    code_executions = [CodeExecution(**result) for result in code_results]

    return MessageResponse(
        message_id=new_message.id,
        user_message=new_message.user_message,
        assistant_response=new_message.assistant_response,
        sources=sources,
        code_executions=code_executions,
        created_at=new_message.created_at.isoformat()
    )


async def set_message_feedback(
    data: MessageFeedback,
    user_id: int,
    db: AsyncSession
) -> None:
    """
    Установка обратной связи на сообщение.

    Args:
        data: Данные обратной связи
        user_id: ID пользователя (из JWT токена)
        db: Сессия БД

    Raises:
        HTTPException: 404 если сообщение не найдено или не принадлежит пользователю
    """
    # Получение сообщения через диалог для проверки владельца
    result = await db.execute(
        select(Message)
        .join(Dialogue, Message.dialogue_id == Dialogue.id)
        .where(
            Message.id == data.message_id,
            Dialogue.user_id == user_id
        )
    )
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Установка feedback
    message.feedback = data.feedback.value

    await db.commit()


def extract_sources_from_response(response: str) -> list[str]:
    """
    Извлечение источников из ответа RAG.

    Ищет паттерн [§N] в тексте и возвращает уникальные источники.
    TODO: улучшить парсинг, получать реальные URLs из RAG ответа.

    Args:
        response: Ответ от RAG API

    Returns:
        list[str]: Список URL источников
    """
    import re

    # Пока возвращаем заглушку
    # В будущем нужно парсить реальные ссылки из response
    # Например: "[§1] https://pytorch.org/docs/..."

    # Простой парсинг [§N] ссылок
    sources = []
    citation_pattern = r'\[§(\d+)\]'
    citations = re.findall(citation_pattern, response)

    if citations:
        # Заглушка - в реальности нужно маппить citation ID -> URL
        sources = [f"https://pytorch.org/docs/stable/source_{n}.html" for n in set(citations)]

    return sources

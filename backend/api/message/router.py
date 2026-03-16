from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from db import get_db

from . import controller
from .models import ErrorMessage, MessageFeedback, MessageResponse, SendMessage

router = APIRouter(tags=["Message"], prefix="/api/message")


@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"model": ErrorMessage, "description": "Dialogue not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
        503: {"model": ErrorMessage, "description": "RAG API unavailable"},
        500: {"model": ErrorMessage, "description": "RAG API error"},
    },
    summary="Отправить сообщение",
    description="Отправка сообщения в диалог. Сообщение обрабатывается RAG API и возвращается ответ. Требует JWT токен.",
)
async def send_message(
    data: SendMessage,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    return await controller.send_message(data, user_id, db)


@router.post(
    "/feedback",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorMessage, "description": "Message not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Установить обратную связь",
    description="Установка like/dislike для сообщения. Требует JWT токен.",
)
async def set_feedback(
    data: MessageFeedback,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    await controller.set_message_feedback(data, user_id, db)

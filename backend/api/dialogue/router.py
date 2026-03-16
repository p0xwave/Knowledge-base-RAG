from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from db import get_db

from . import controller
from .models import (
    CreateDialogue,
    DialogueResponse,
    ErrorMessage,
    ShortDialogue,
    UpdateDialogue,
)

router = APIRouter(tags=["Dialogue"], prefix="/api/dialogue")


@router.post(
    "",
    response_model=DialogueResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Создать новый диалог",
    description="Создание нового диалога для текущего пользователя. Требует JWT токен.",
)
async def create_dialogue(
    data: CreateDialogue,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DialogueResponse:
    return await controller.create_dialogue(data, user_id, db)


@router.get(
    "/{dialogue_id}",
    response_model=DialogueResponse,
    responses={
        404: {"model": ErrorMessage, "description": "Dialogue not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Получить диалог по ID",
    description="Возвращает полную информацию о диалоге. Требует JWT токен.",
)
async def get_dialogue(
    dialogue_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DialogueResponse:
    return await controller.get_dialogue(dialogue_id, user_id, db)


@router.get(
    "",
    response_model=list[ShortDialogue],
    responses={
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Получить список диалогов",
    description="Возвращает список всех диалогов пользователя. Поддерживает фильтрацию по имени. Требует JWT токен.",
)
async def get_dialogues(
    query: str | None = Query(
        None, description="Поисковый запрос для фильтрации по имени"
    ),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ShortDialogue]:
    return await controller.get_dialogues(user_id, query, db)


@router.put(
    "/{dialogue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorMessage, "description": "Dialogue not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Обновить диалог",
    description="Изменение имени диалога. Требует JWT токен.",
)
async def update_dialogue(
    dialogue_id: int,
    changes: UpdateDialogue,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    await controller.update_dialogue(dialogue_id, changes, user_id, db)


@router.delete(
    "/{dialogue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorMessage, "description": "Dialogue not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Удалить диалог",
    description="Удаление диалога и всех связанных сообщений. Требует JWT токен.",
)
async def delete_dialogue(
    dialogue_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    await controller.delete_dialogue(dialogue_id, user_id, db)

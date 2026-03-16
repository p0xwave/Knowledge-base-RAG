from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from db import get_db

from . import controller
from .models import AuthResponse, ErrorMessage, User, UserAuth, UserChanges

router = APIRouter(tags=["User"], prefix="/api/user")


@router.post(
    "/auth",
    response_model=AuthResponse,
    responses={
        404: {"model": ErrorMessage, "description": "User not found"},
        401: {"model": ErrorMessage, "description": "Invalid password"},
        403: {"model": ErrorMessage, "description": "User account is inactive"},
    },
    summary="Аутентификация пользователя",
    description="Вход пользователя по email и паролю. Возвращает JWT токен и данные пользователя.",
)
async def user_auth(
    credentials: UserAuth, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    result = await controller.authenticate(credentials, db)
    return AuthResponse(**result)


@router.get(
    "/me",
    response_model=User,
    responses={
        401: {"model": ErrorMessage, "description": "Unauthorized"},
        404: {"model": ErrorMessage, "description": "User not found"},
    },
    summary="Получить данные текущего пользователя",
    description="Возвращает данные пользователя из JWT токена.",
)
async def get_current_user(
    user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
) -> User:
    return await controller.get_user_by_id(user_id, db)


@router.put(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorMessage, "description": "User not found"},
        400: {
            "model": ErrorMessage,
            "description": "Invalid data or email already taken",
        },
        401: {
            "model": ErrorMessage,
            "description": "Unauthorized or invalid old password",
        },
    },
    summary="Обновление данных пользователя",
    description="Изменение email, username или пароля. Требует JWT токен.",
)
async def user_update(
    changes: UserChanges,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    await controller.update_user(user_id, changes, db)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorMessage, "description": "User not found"},
        401: {"model": ErrorMessage, "description": "Unauthorized"},
    },
    summary="Удаление пользователя",
    description="Деактивация аккаунта пользователя. Требует JWT токен.",
)
async def user_delete(
    user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)
) -> None:
    await controller.delete_user(user_id, db)

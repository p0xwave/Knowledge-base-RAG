"""FastAPI роутеры для User API."""

from auth import get_current_user_id
from db import get_db
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from . import controller
from .models import AuthResponse, ErrorMessage, User, UserAuth, UserChanges
# UserRegister не используется (регистрация отключена)

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
    credentials: UserAuth,
    db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """Аутентификация пользователя."""
    result = await controller.authenticate(credentials, db)
    return AuthResponse(**result)


# ПРИМЕЧАНИЕ: Публичная регистрация отключена для безопасности.
# Пользователи создаются вручную администратором в базе данных.
# Для создания пользователя используйте SQL:
# INSERT INTO users (email, username, password_hash, is_active)
# VALUES ('user@example.com', 'username', '$2b$12$...', true);
# Хеш пароля можно сгенерировать: python -c "from passlib.hash import bcrypt; print(bcrypt.hash('password'))"

# @router.post(
#     "/register",
#     response_model=AuthResponse,
#     status_code=status.HTTP_201_CREATED,
#     responses={
#         400: {"model": ErrorMessage, "description": "Email already registered"},
#     },
#     summary="Регистрация нового пользователя",
#     description="Создание нового аккаунта. Возвращает JWT токен и данные пользователя.",
# )
# async def user_register(
#     data: UserRegister,
#     db: AsyncSession = Depends(get_db)
# ) -> AuthResponse:
#     """Регистрация нового пользователя."""
#     credentials = UserAuth(email=data.email, password=data.password)
#     result = await controller.register(credentials, data.username, db)
#     return AuthResponse(**result)


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
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Получить данные текущего пользователя."""
    return await controller.get_user_by_id(user_id, db)


@router.put(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorMessage, "description": "User not found"},
        400: {"model": ErrorMessage, "description": "Invalid data or email already taken"},
        401: {"model": ErrorMessage, "description": "Unauthorized or invalid old password"},
    },
    summary="Обновление данных пользователя",
    description="Изменение email, username или пароля. Требует JWT токен.",
)
async def user_update(
    changes: UserChanges,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> None:
    """Обновление данных пользователя."""
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
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> None:
    """Удаление (деактивация) пользователя."""
    await controller.delete_user(user_id, db)

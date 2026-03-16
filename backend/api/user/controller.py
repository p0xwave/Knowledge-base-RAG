"""Бизнес-логика для User API."""

from auth import create_access_token, hash_password, verify_password
from db import User
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User as UserResponse
from .models import UserAuth, UserChanges


async def authenticate(credentials: UserAuth, db: AsyncSession) -> dict:
    """
    Аутентификация пользователя.

    Args:
        credentials: Данные для входа (email, password)
        db: Сессия БД

    Returns:
        dict: { access_token, token_type, user }

    Raises:
        HTTPException: 404 если пользователь не найден, 401 если неверный пароль
    """
    # Поиск пользователя по email
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Проверка пароля
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )

    # Создание JWT токена
    access_token = create_access_token(data={"user_id": user.id, "email": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(
            user_id=user.id,
            email=user.email,
            username=user.username
        )
    }


async def register(credentials: UserAuth, username: str, db: AsyncSession) -> dict:
    """
    Регистрация нового пользователя.

    Args:
        credentials: Данные для регистрации (email, password)
        username: Имя пользователя
        db: Сессия БД

    Returns:
        dict: { access_token, token_type, user }

    Raises:
        HTTPException: 400 если email уже занят
    """
    # Проверка существования пользователя
    result = await db.execute(select(User).where(User.email == credentials.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Создание нового пользователя
    password_hash = hash_password(credentials.password)
    new_user = User(
        email=credentials.email,
        username=username,
        password_hash=password_hash
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Создание JWT токена
    access_token = create_access_token(data={"user_id": new_user.id, "email": new_user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(
            user_id=new_user.id,
            email=new_user.email,
            username=new_user.username
        )
    }


async def get_user_by_id(user_id: int, db: AsyncSession) -> UserResponse:
    """
    Получение пользователя по ID.

    Args:
        user_id: ID пользователя
        db: Сессия БД

    Returns:
        UserResponse: Данные пользователя

    Raises:
        HTTPException: 404 если пользователь не найден
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse(
        user_id=user.id,
        email=user.email,
        username=user.username
    )


async def update_user(user_id: int, changes: UserChanges, db: AsyncSession) -> None:
    """
    Обновление данных пользователя.

    Args:
        user_id: ID пользователя
        changes: Изменения для применения
        db: Сессия БД

    Raises:
        HTTPException: 404 если пользователь не найден,
                      400 если данные невалидны,
                      401 если неверный старый пароль
    """
    # Получение пользователя
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Обновление email
    if changes.email:
        # Проверка уникальности email
        result = await db.execute(
            select(User).where(User.email == changes.email, User.id != user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already taken"
            )
        user.email = changes.email

    # Обновление username
    if changes.username:
        user.username = changes.username

    # Обновление пароля
    if changes.new_password:
        if not changes.old_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Old password is required to set new password"
            )

        # Проверка старого пароля
        if not verify_password(changes.old_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid old password"
            )

        user.password_hash = hash_password(changes.new_password)

    await db.commit()


async def delete_user(user_id: int, db: AsyncSession) -> None:
    """
    Удаление пользователя (мягкое удаление).

    Args:
        user_id: ID пользователя
        db: Сессия БД

    Raises:
        HTTPException: 404 если пользователь не найден
    """
    # Получение пользователя
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Мягкое удаление (деактивация)
    user.is_active = False
    await db.commit()

    # Для жесткого удаления:
    # await db.delete(user)
    # await db.commit()

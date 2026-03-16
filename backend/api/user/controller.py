from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token, hash_password, verify_password
from db import User

from .models import User as UserResponse
from .models import UserAuth, UserChanges


async def authenticate(credentials: UserAuth, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password"
        )

    access_token = create_access_token(data={"user_id": user.id, "email": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(user_id=user.id, email=user.email, username=user.username),
    }


async def register(credentials: UserAuth, username: str, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.email == credentials.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    password_hash = hash_password(credentials.password)
    new_user = User(
        email=credentials.email, username=username, password_hash=password_hash
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(
        data={"user_id": new_user.id, "email": new_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(
            user_id=new_user.id, email=new_user.email, username=new_user.username
        ),
    }


async def get_user_by_id(user_id: int, db: AsyncSession) -> UserResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return UserResponse(user_id=user.id, email=user.email, username=user.username)


async def update_user(user_id: int, changes: UserChanges, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if changes.email:
        result = await db.execute(
            select(User).where(User.email == changes.email, User.id != user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email already taken"
            )
        user.email = changes.email

    if changes.username:
        user.username = changes.username

    if changes.new_password:
        if not changes.old_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Old password is required to set new password",
            )

        if not verify_password(changes.old_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid old password"
            )

        user.password_hash = hash_password(changes.new_password)

    await db.commit()


async def delete_user(user_id: int, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    user.is_active = False
    await db.commit()

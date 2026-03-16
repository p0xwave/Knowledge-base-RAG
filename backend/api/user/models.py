"""Pydantic модели для User API."""

from pydantic import BaseModel


class UserAuth(BaseModel):
    """Модель для аутентификации пользователя."""

    email: str
    password: str


class UserRegister(BaseModel):
    """Модель для регистрации пользователя."""

    email: str
    password: str
    username: str


class UserChanges(BaseModel):
    """Модель для изменения данных пользователя."""

    email: str | None = None
    username: str | None = None
    old_password: str | None = None
    new_password: str | None = None


class User(BaseModel):
    """Модель пользователя (response)."""

    user_id: int
    email: str
    username: str


class AuthResponse(BaseModel):
    """Ответ на аутентификацию/регистрацию."""

    access_token: str
    token_type: str
    user: User


class ErrorMessage(BaseModel):
    """Модель ошибки."""

    detail: str

"""Общие модели и утилиты для всех API."""

from pydantic import BaseModel


class ErrorMessage(BaseModel):
    """Стандартная модель ошибки для всех API эндпоинтов."""

    detail: str

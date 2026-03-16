"""Pydantic модели для Message API."""

from enum import Enum

from pydantic import BaseModel


class MessageFeedbackEnum(str, Enum):
    """Тип обратной связи на сообщение."""

    like = "like"
    dislike = "dislike"


class SendMessage(BaseModel):
    """Модель для отправки сообщения."""

    dialogue_id: int
    message: str


class CodeExecution(BaseModel):
    """Результат выполнения кода."""

    code: str
    success: bool
    stdout: str
    stderr: str
    result: str | None = None
    error: str | None = None


class MessageResponse(BaseModel):
    """Ответ на отправленное сообщение."""

    message_id: int
    user_message: str
    assistant_response: str
    sources: list[str]  # URLs источников
    code_executions: list[CodeExecution] = []  # Результаты выполнения кода
    created_at: str


class MessageFeedback(BaseModel):
    """Модель для обратной связи."""

    message_id: int
    feedback: MessageFeedbackEnum


class ErrorMessage(BaseModel):
    """Модель ошибки."""

    detail: str

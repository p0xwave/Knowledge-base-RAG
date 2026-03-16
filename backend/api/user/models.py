from pydantic import BaseModel


class UserAuth(BaseModel):
    email: str
    password: str


class UserRegister(BaseModel):
    email: str
    password: str
    username: str


class UserChanges(BaseModel):
    email: str | None = None
    username: str | None = None
    old_password: str | None = None
    new_password: str | None = None


class User(BaseModel):
    user_id: int
    email: str
    username: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: User


class ErrorMessage(BaseModel):
    detail: str

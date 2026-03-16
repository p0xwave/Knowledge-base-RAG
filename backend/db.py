from datetime import datetime
from typing import AsyncGenerator

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, relationship

from settings import settings

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )
    is_active = Column(Boolean, default=True, nullable=False)

    dialogues = relationship(
        "Dialogue", back_populates="user", cascade="all, delete-orphan"
    )


class Dialogue(Base):
    __tablename__ = "dialogues"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False, default="New conversation")
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )

    user = relationship("User", back_populates="dialogues")
    messages = relationship(
        "Message", back_populates="dialogue", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    dialogue_id = Column(
        Integer,
        ForeignKey("dialogues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_message = Column(Text, nullable=False)
    assistant_response = Column(Text, nullable=True)
    feedback = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    dialogue = relationship("Dialogue", back_populates="messages")


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    source_type = Column(String(10), nullable=False)
    content = Column(Text, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)


pg_settings = settings.POSTGRES
DATABASE_URL = f"postgresql+asyncpg://{pg_settings.USER}:{pg_settings.PASSWORD}@{pg_settings.HOST}:{pg_settings.PORT}/{pg_settings.DATABASE}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(engine) as session:
        yield session

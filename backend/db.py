from datetime import datetime
from typing import AsyncGenerator

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import text

from settings import settings


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    dialogues: Mapped[list["Dialogue"]] = relationship(
        "Dialogue", back_populates="user", cascade="all, delete-orphan"
    )


class Dialogue(Base):
    __tablename__ = "dialogues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="New conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="dialogues")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="dialogue", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dialogue_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("dialogues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_message_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    assistant_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    sources: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of source URLs
    feedback: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    dialogue: Mapped["Dialogue"] = relationship("Dialogue", back_populates="messages")


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(1000), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    sources: Mapped[list["Source"]] = relationship(
        "Source", back_populates="folder", cascade="all, delete-orphan"
    )


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    folder_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    folder: Mapped["Folder | None"] = relationship("Folder", back_populates="sources")


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    next_version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now
    )


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (UniqueConstraint("dataset_id", "number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int]
    label: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    sha256: Mapped[str] = mapped_column(String(64))
    file_count: Mapped[int]
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    base_version_id: Mapped[int | None]
    runtime: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class DatasetVersionFile(Base):
    """Each row references an immutable content-addressed file, independent of other versions."""

    __tablename__ = "dataset_version_files"
    __table_args__ = (UniqueConstraint("version_id", "path"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(
        ForeignKey("dataset_versions.id", ondelete="CASCADE"), index=True
    )
    path: Mapped[str] = mapped_column(String(1000))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    source_id: Mapped[int | None]


class DatasetStorageLock(Base):
    """ponytail: one transaction lock per store; split by blob if write throughput requires it."""

    __tablename__ = "dataset_storage_lock"

    id: Mapped[int] = mapped_column(primary_key=True)


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

        # Create full-text search indexes for sources
        # Add tsvector columns if they don't exist
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'messages' AND column_name = 'parent_message_id'
                ) THEN
                    ALTER TABLE messages ADD COLUMN parent_message_id INTEGER;
                END IF;
            END $$
        """))

        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'fk_messages_parent_message_id'
                ) THEN
                    ALTER TABLE messages
                    ADD CONSTRAINT fk_messages_parent_message_id
                    FOREIGN KEY (parent_message_id)
                    REFERENCES messages(id)
                    ON DELETE SET NULL;
                END IF;
            END $$
        """))

        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_messages_parent_message_id ON messages(parent_message_id)"
        ))

        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sources' AND column_name = 'name_tsvector'
                ) THEN
                    ALTER TABLE sources ADD COLUMN name_tsvector tsvector;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'sources' AND column_name = 'content_tsvector'
                ) THEN
                    ALTER TABLE sources ADD COLUMN content_tsvector tsvector;
                END IF;
            END $$
        """))

        # Create GIN indexes if they don't exist
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_sources_name_fts ON sources USING GIN(name_tsvector)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_sources_content_fts ON sources USING GIN(content_tsvector)"
        ))

        # Create or replace trigger functions
        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION sources_name_tsvector_update() RETURNS trigger AS $$
            BEGIN
                NEW.name_tsvector := to_tsvector('english', COALESCE(regexp_replace(NEW.name, '[._-]', ' ', 'g'), ''));
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql
        """))

        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION sources_content_tsvector_update() RETURNS trigger AS $$
            BEGIN
                NEW.content_tsvector := to_tsvector('english', COALESCE(NEW.content, ''));
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql
        """))

        # Create triggers
        await conn.execute(text("DROP TRIGGER IF EXISTS sources_name_tsvector_trigger ON sources"))
        await conn.execute(text("""
            CREATE TRIGGER sources_name_tsvector_trigger
                BEFORE INSERT OR UPDATE ON sources
                FOR EACH ROW EXECUTE FUNCTION sources_name_tsvector_update()
        """))

        await conn.execute(text("DROP TRIGGER IF EXISTS sources_content_tsvector_trigger ON sources"))
        await conn.execute(text("""
            CREATE TRIGGER sources_content_tsvector_trigger
                BEFORE INSERT OR UPDATE ON sources
                FOR EACH ROW EXECUTE FUNCTION sources_content_tsvector_update()
        """))

        # Update existing rows
        await conn.execute(text("""
            UPDATE sources SET name_tsvector = to_tsvector('english', COALESCE(regexp_replace(name, '[._-]', ' ', 'g'), ''))
            WHERE name_tsvector IS NULL
        """))

        await conn.execute(text("""
            UPDATE sources SET content_tsvector = to_tsvector('english', COALESCE(content, ''))
            WHERE content_tsvector IS NULL
        """))


async def close_db():
    await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(engine) as session:
        yield session

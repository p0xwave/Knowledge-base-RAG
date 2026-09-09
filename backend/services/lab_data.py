"""TXT/Markdown import, independent of the shared retrieval index."""

from pathlib import Path

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHUNK_SIZE = 3000


def parse_upload(filename: str, data: bytes) -> tuple[str, list[dict], int]:
    if Path(filename).suffix.lower() not in {".txt", ".md"}:
        raise ValueError("Поддерживаются только TXT и Markdown (.md).")
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("Файл должен быть непустым и не больше 10 МБ.")
    try:
        content = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Нужен текстовый файл в кодировке UTF-8.") from exc
    if "\x00" in content or not content.strip():
        raise ValueError("Нужен непустой текстовый документ.")
    text = content.strip()
    chunks = [
        {"text": part, "source": filename}
        for offset in range(0, len(text), CHUNK_SIZE)
        if (part := text[offset : offset + CHUNK_SIZE].strip())
    ]
    return content, chunks, len(chunks)

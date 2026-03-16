# Telegram Bot Dockerfile
FROM python:3.13-slim

WORKDIR /app

# Установка uv
RUN pip install --no-cache-dir uv

# Копирование зависимостей
COPY pyproject.toml ./

# Установка зависимостей
RUN uv pip install --system -e .

# Копирование кода
COPY . .

CMD ["python", "-m", "tgbot"]

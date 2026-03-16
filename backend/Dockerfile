# Backend Dockerfile
FROM python:3.13-slim

WORKDIR /app

# Установка uv
RUN pip install --no-cache-dir uv

# Копирование зависимостей
COPY pyproject.toml ./

# Установка зависимостей
RUN uv pip install --system -e .
RUN uv pip install --system --group dev

# Копирование кода
COPY . .

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]

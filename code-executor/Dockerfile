# Code Executor Dockerfile - Hardened Security Configuration
FROM python:3.13-slim

# Создание непривилегированного пользователя ДО установки зависимостей
RUN groupadd -r sandbox -g 1000 && \
    useradd -r -u 1000 -g sandbox -m -s /sbin/nologin sandbox

WORKDIR /app

# Установка системных зависимостей (временно для компиляции)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Установка uv
RUN pip install --no-cache-dir uv

# Копирование зависимостей
COPY pyproject.toml ./

# Установка Python зависимостей
RUN uv pip install --system -e .

# Установка научных библиотек (опционально, игнорируем ошибки)
RUN uv pip install --system numpy pandas torch --index-url https://download.pytorch.org/whl/cpu || true

# ВАЖНО: Удаляем build-essential после установки зависимостей
# Это предотвращает компиляцию exploit кода внутри контейнера
RUN apt-get purge -y --auto-remove build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Копирование кода приложения
COPY app.py ./

# Создание tmpfs директории для временных файлов
RUN mkdir -p /tmp && chmod 1777 /tmp

# Установка прав доступа (владелец - sandbox)
RUN chown -R sandbox:sandbox /app

# Переключение на непривилегированного пользователя
USER sandbox

EXPOSE 8002

# Healthcheck для мониторинга
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health').read()" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]

# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Установка pnpm
RUN npm install -g pnpm

# Копирование package файлов
COPY package.json pnpm-lock.yaml* ./

# Установка зависимостей
RUN pnpm install --frozen-lockfile

# Копирование остального кода
COPY . .

EXPOSE 3000

# Development mode
CMD ["pnpm", "dev"]

# Production build (раскомментировать для production)
# RUN pnpm build
# CMD ["pnpm", "start"]

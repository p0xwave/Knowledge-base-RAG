# Changelog

## Unreleased

#### Фичи

- Добавлено версионирование датасетов с дедупликацией файлов, безопасным удалением и восстановлением для ответов и обучения.

#### Разное

- Локальные файлы окружения исключены из отслеживания без удаления с диска.

### Документация

- Корневые `README.md` и `SUMMARY.md` приведены в соответствие с фактической
  архитектурой, командами запуска, состоянием проверок и известными ограничениями
  данных и безопасности.
- Добавлена навигация по документации компонентов и зафиксировано различие между
  рабочим runtime, offline ML-пайплайнами и legacy/experimental контурами.
- Обновлены руководства backend/RAG и frontend, включая реальные API/SSE,
  ownership, folders/documents, Docker и browser-side security boundaries.
- `backend/openapi.json` и `.yaml` регенерированы из текущего `app.openapi()`;
  отдельно задокументированы невыраженные в snapshot media types SSE/download.
- Переписаны документы `eval-runner`, `lora-pipeline` и legacy `torch-parser`;
  уточнены внешние эффекты, воспроизводимость, W&B/credential/data risks и
  фактические ограничения resume, training и prompt contract.
- Историческая defense deck привязана к evidence snapshot и очищена от
  неподтверждённых статистических и causal выводов.
- `.env.example`, `AGENTS.md` и пользовательские CLI/docstrings синхронизированы с
  текущими Compose inputs, workspace-командами и реальным поведением кода.

### Миграции

- Добавлена миграция источников сообщений

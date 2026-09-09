# Backend / RAG integration

Этот документ описывает фактическую интеграцию FastAPI backend с PostgreSQL,
локальным RAG-пакетом, ChromaDB, классификатором тематики и сервисом исполнения
кода. Источник истины для поведения — `app.py`, `settings.py`, `api/**`,
`services/**`, `db.py` и пакет `../rag/rag/**`. Снимки `openapi.json` и
`openapi.yaml` должны генерироваться из `app.openapi()` после изменения маршрутов
или Pydantic-моделей.

## Архитектура

```text
Browser / Next.js :3000
  └─ JSON или SSE + Bearer JWT
       └─ FastAPI backend :8001
            ├─ PostgreSQL :5432
            │    users, dialogues, messages, folders, sources, FTS
            ├─ in-process RAG
            │    ├─ SentenceTransformer embeddings
            │    ├─ persistent Chroma collection
            │    ├─ CrossEncoder reranker
            │    ├─ topic classifier
            │    └─ внешний OpenAI-compatible LLM endpoint
            └─ HTTP → code-executor :8002
```

`docker-compose.yml` запускает PostgreSQL, backend, code-executor и frontend. Он
не запускает vLLM, Ollama или иной LLM server. Backend не проксирует запросы на
старый `http://localhost:8000/forward`: если RAG выключен или singleton не
инициализирован, message API отвечает `503`.

## Основные модули

| Путь | Ответственность |
|---|---|
| `app.py` | FastAPI app, CORS, lifespan и подключение routers |
| `settings.py` | Backend env/config; создаёт `settings` при импорте |
| `db.py` | async SQLAlchemy engine, ORM и startup DDL для PostgreSQL FTS |
| `auth.py` | Bearer JWT и получение текущего `user_id` |
| `api/<domain>/router.py` | HTTP contract и dependency injection |
| `api/<domain>/controller.py` | Use-case orchestration и DB operations |
| `api/message/controller.py` | RAG, citations, SSE, history и code execution |
| `api/message_citation_utils.py` | Перенумерация ссылок вида `[§N]` |
| `services/rag_service.py` | Singleton-обёртка над `rag` и topic classifier |
| `services/title_service.py` | Короткий заголовок первого сообщения |
| `../rag/rag/documents.py` | Загрузка, chunking и dedup документов |
| `../rag/rag/vectorstore.py` | Persistent Chroma, embeddings и vector search |
| `../rag/rag/retriever.py` | `basic`, `rerank`, `query_transform` retrieval |
| `../rag/rag/chains.py` | Обычная и streaming генерация ответа |
| `../code-executor/app.py` | RestrictedPython worker с отдельным процессом |

## Startup и shutdown

`settings = Settings()` выполняется при импорте backend-модулей. Поэтому до
импорта `app` должны быть заданы обязательные PostgreSQL-поля и
`JWT_SECRET_KEY`.

Lifespan в `app.py` выполняет следующий порядок:

1. отклоняет известные небезопасные значения `JWT_SECRET_KEY`;
2. вызывает `init_db()`;
3. если `RAG_ENABLED=true`, синхронно создаёт LLM client, embedding model,
   reranker, Chroma collection и topic classifier;
4. при ошибке инициализации RAG пишет warning и оставляет остальной API
   запущенным;
5. при shutdown закрывает SQLAlchemy engine и сбрасывает RAG singleton.

Следствия:

- первый запуск может скачивать модели SentenceTransformer/CrossEncoder и быть
  долгим;
- недоступный RAG не останавливает приложение, но `/api/message` и
  `/api/message/stream` возвращают `503` при обращении к singleton;
- backend не имеет собственного `/health`; `/health` есть только у
  code-executor;
- тесты через ASGI transport обычно обходят lifespan и не подтверждают реальный
  startup PostgreSQL/RAG.

## Конфигурация

`backend/settings.py` использует Pydantic Settings, читает `.env` относительно
текущего рабочего каталога и игнорирует неизвестные переменные. Не переносите
реальные secret values в документацию, логи или OpenAPI snapshots.

### PostgreSQL и JWT

| Переменная | Требование/default | Назначение |
|---|---|---|
| `POSTGRES_USER` | обязательна | PostgreSQL user |
| `POSTGRES_PASSWORD` | обязательна | PostgreSQL password |
| `POSTGRES_HOST` | обязательна | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DATABASE` | обязательна | PostgreSQL database |
| `JWT_SECRET_KEY` | обязательна | Ключ подписи JWT; production-значение должно быть случайным |

### Backend и RAG defaults

| Переменная | Default | Назначение |
|---|---:|---|
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Срок access token |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Явный список origins; credentials включены |
| `RAG_ENABLED` | `true` | Инициализация и использование RAG |
| `RAG_EMBEDDING_MODEL` | `BAAI/bge-base-en-v1.5` | Embedding model |
| `RAG_RERANK_MODEL` | `BAAI/bge-reranker-base` | CrossEncoder |
| `RAG_LLM_MODEL` | `Qwen/Qwen2.5-Coder-7B-Instruct` | Model name для backend serving |
| `RAG_LLM_API_URL` | пустая строка | OpenAI-compatible base URL |
| `RAG_LLM_API_KEY` | пустая строка | API key, если endpoint его требует |
| `RAG_LLM_TIMEOUT` | `30.0` | Timeout LLM client, секунды |
| `RAG_TOP_K` | `5` | Финальное число retrieved chunks |
| `RAG_CHUNK_SIZE` | `1000` | Размер chunk в символах |
| `RAG_CHUNK_OVERLAP` | `200` | Перекрытие chunks в символах |
| `RAG_CHROMA_PATH` | `./data/chromadb` | Persistent Chroma path, зависит от cwd |
| `RAG_CHROMA_COLLECTION` | `docs_fast` | Collection name |
| `RAG_SOURCE_PATH_PREFIXES` | `["drive/MyDrive/dataset/", "dataset/"]` | Prefixes, удаляемые при DB source mapping |
| `OUTLIER_DETECTION_ENABLED` | `true` | Проверка тематики первого вопроса |
| `OUTLIER_CLASSIFIER_PATH` | `./models/pytorch_topic_classifier.joblib` | Joblib classifier path |
| `OUTLIER_REJECT_OFF_TOPIC` | `true` | Возвращать refusal для off-topic первого вопроса |
| `CODE_EXECUTOR_URL` | `http://localhost:8002/execute` | Backend → executor URL |
| `CODE_EXECUTOR_TIMEOUT` | `15` | Timeout выполнения кода, секунды |
| `CODE_EXECUTOR_MAX_CODE_LENGTH` | `10000` | Backend limit до HTTP-вызова |
| `CONVERSATION_HISTORY_ENABLED` | `true` | Передавать предыдущие turns в generation |
| `CONVERSATION_MAX_HISTORY_MESSAGES` | `10` | Максимум ORM `Message` rows в history |

Списки (`CORS_ORIGINS`, `RAG_SOURCE_PATH_PREFIXES`) задавайте в формате,
принимаемом Pydantic для complex env values, обычно JSON array.

Standalone `rag.Settings` имеет prefix `RAG_`, но некоторые имена отличаются.
В частности, standalone package читает `RAG_LLM_MODEL_GENERATION`, а backend —
`RAG_LLM_MODEL`. Не считайте их взаимозаменяемыми.

### Относительные пути

- В Docker рабочий каталог backend — `/app/backend`; volume `./data` смонтирован
  как `/app/backend/data`, поэтому default Chroma path соответствует compose
  layout.
- При локальном запуске из `backend/` bundled index находится по
  `../data/chromadb`, а не по default `./data/chromadb`.
- Default `CODE_EXECUTOR_URL` подходит host-run executor, но не контейнерному
  backend: в Docker нужен service hostname `code-executor`.
- Compose сейчас не задаёт `CODE_EXECUTOR_URL` явно. Не полагайтесь на случайное
  значение из локального/tracked `.env`; перед интеграционным запуском проверьте
  только имя host/path, не выводя secrets.

## Фактический RAG pipeline

Оба message endpoints используют `strategy="query_transform"`, независимо от
default аргумента `RagService.answer_question()`:

1. Проверяется принадлежность диалога пользователю. Если указан
   `parent_message_id`, он должен принадлежать тому же диалогу пользователя.
2. Создаётся и `flush`-ится одна `Message` row, содержащая user question и будущий
   assistant answer. До успешного RAG она не коммитится.
3. Из загруженного relationship `dialogue.messages` собирается history: каждая row
   даёт до двух chat messages (`user`, затем `assistant`). Затем берётся хвост из
   `CONVERSATION_MAX_HISTORY_MESSAGES` rows, но у relationship нет `order_by`,
   поэтому хронологический порядок на уровне БД сейчас не гарантирован.
4. Topic classifier вызывается только для первого сообщения в диалоге. При
   off-topic и `OUTLIER_REJECT_OFF_TOPIC=true` возвращается готовый refusal без
   retrieval.
5. `query_transform` делает два дополнительных LLM-вызова: rewrite запроса и
   HyDE-ответ.
6. Vector search выполняется для исходного вопроса, rewrite и HyDE. Кандидаты
   дедуплицируются по первым 150 символам и rerank-ятся CrossEncoder относительно
   исходного вопроса; берётся `RAG_TOP_K`.
7. Основной LLM генерирует ответ по retrieved context и history.
8. `source` metadata каждого chunk нормализуется и сопоставляется с PostgreSQL
   `Source` текущего пользователя. При найденной folder path используется её ID;
   при неизвестной path код оставляет `folder_id=None` и может ошибочно привязать
   chunk к одноимённому root Source. Остальные несопоставленные chunks не попадают
   в API `sources`; fallback для неизвестной папки — известный defect.
9. Chunks группируются по `Source`, вычисляется эвристический relevance score,
   sources сортируются, а ссылки `[§N]` в полном ответе перенумеровываются.
10. Для первого сообщения с пустым/default названием выполняется ещё один короткий
    LLM-вызов для заголовка диалога. Ошибка title generation не отменяет ответ.
11. Message, sources JSON и возможный title коммитятся в PostgreSQL.

Текущий citation remapper имеет ещё один известный defect: в группе вроде
`[§1, §2]` номера сначала перенумеровываются как группа, затем часть совпадений
может пройти standalone-remap повторно. При нетривиальном source order это способно
создать дубликаты или неверные номера; grouped citations требуют regression test.

CrossEncoder score — raw model output, а итоговый source relevance — внутренняя
эвристика. Ни то ни другое не следует трактовать как калиброванную вероятность.
BM25 и RRF в текущем runtime не реализованы. Backend также не передаёт
`PromptContract` в `rag.answer()`: serving идёт по legacy prompt path.

### Обычный ответ

`POST /api/message` после commit ищет fenced blocks с языком `python` или `py` в
assistant response и последовательно отправляет их в code-executor. Результаты
попадают в `code_executions`, но отдельно в БД не сохраняются. Ошибки исполнения
кода представлены в результате конкретного block и не являются RAG fallback.

### Streaming

`POST /api/message/stream` возвращает `text/event-stream`:

```text
data: {"type":"chunk","delta":"..."}

data: {"type":"complete","sources":[...],"message_id":123,
       "parent_message_id":null,"created_at":"..."}

data: [DONE]
```

При ошибке после открытия stream приходит JSON event `type=error`, затем
`[DONE]`. Синхронный iterator LLM bridge-ится через worker thread и
`asyncio.Queue`, однако rewrite/retrieval/rerank выполняются до возврата
`StreamingResponse` и остаются blocking.

Важные особенности текущего contract:

- raw deltas отправляются до citation remap;
- полный перенумерованный answer сохраняется в БД, но не повторяется в
  `complete` event;
- `complete` отправляется до `db.commit()`;
- fenced Python blocks автоматически не исполняются; для них frontend использует
  отдельный `POST /api/code/execute`;
- cancel/error должен приводить к rollback.

## HTTP API

Swagger UI доступен на `http://localhost:8001/api/docs`, OpenAPI endpoint —
`http://localhost:8001/openapi.json`. Почти все маршруты требуют
`Authorization: Bearer <JWT>`.

| Method | Path | Назначение | Auth |
|---|---|---|---|
| `POST` | `/api/user/auth` | Вход и выдача JWT | нет |
| `GET` | `/api/user/me` | Текущий пользователь | да |
| `PUT` | `/api/user` | Email/username/password | да |
| `DELETE` | `/api/user` | Деактивация пользователя | да |
| `POST` | `/api/dialogue` | Создать диалог | да |
| `GET` | `/api/dialogue` | Список/поиск диалогов | да |
| `GET` | `/api/dialogue/{dialogue_id}` | Диалог с сообщениями | да |
| `PUT` | `/api/dialogue/{dialogue_id}` | Переименовать диалог | да |
| `DELETE` | `/api/dialogue/{dialogue_id}` | Удалить диалог | да |
| `GET` | `/api/dialogue/queries/pre-generated` | Предзаготовленные вопросы | заявлен без auth |
| `POST` | `/api/message` | RAG answer + auto-execution Python blocks | да |
| `POST` | `/api/message/stream` | RAG answer через SSE | да |
| `POST` | `/api/message/feedback` | `like`/`dislike`, ответ `204` | да |
| `POST` | `/api/source` | Upload источника | да |
| `GET` | `/api/source` | List/search/filter/pagination | да |
| `GET` | `/api/source/{source_id}` | Содержимое источника | да |
| `GET` | `/api/source/{source_id}/download` | Скачать источник | да |
| `PATCH` | `/api/source/{source_id}` | Переместить в папку/корень | да |
| `DELETE` | `/api/source/{source_id}` | Удалить источник | да |
| `POST` | `/api/folder` | Создать папку | да |
| `GET` | `/api/folder` | Список папок с document counts | да |
| `PATCH` | `/api/folder/{folder_id}` | Переместить папку | да |
| `DELETE` | `/api/folder/{folder_id}` | Удалить папку с contents | да |
| `POST` | `/api/code/execute` | Authenticated proxy в code-executor | да |

Registration controller существует, но HTTP route регистрации отсутствует.

Точные JSON request/response schemas и validation constraints смотрите в live
Swagger или в сгенерированных `openapi.json`/`openapi.yaml`. Есть два известных
разрыва между generated schema и runtime: stream response объявлен как
`application/json` вместо `text/event-stream`, а download — как JSON вместо
фактического media type файла. Проверяйте эти endpoints отдельным HTTP smoke.

## PostgreSQL и ownership

`db.py` создаёт таблицы `users`, `dialogues`, `messages`, `folders`, `sources`.
`init_db()` вызывает `Base.metadata.create_all()` и затем вручную создаёт/обновляет
PostgreSQL columns, foreign key, `tsvector`, GIN indexes и triggers для English
full-text search.

Alembic/migration history нет. `create_all()` не изменяет существующие columns, а
ручной DDL покрывает только явно запрограммированные upgrades. Любое изменение
schema нужно проверять на уже существующей PostgreSQL БД; SQLite недостаточно для
FTS и PostgreSQL DDL.

User-owned lookups должны включать `user_id`; чужой id обычно маскируется как
`404`. Сохраняйте это свойство при изменении controllers. Известная зона риска —
условия FTS с `AND`/`OR`: list, count и total-size запросы должны иметь одинаковую
tenant-фильтрацию.

## Источники, folders и ChromaDB

### Upload

Backend принимает расширения `md`, `txt`, `pdf`, `docx` и ограничивает payload
10 MiB, но фактически весь файл декодируется как UTF-8 text. Бинарные PDF/DOCX не
парсятся и обычно отклоняются. Upload создаёт источник в корне; перенос в folder —
отдельный `PATCH`.

PostgreSQL commit происходит до best-effort индексации. Ошибка embedding не
отменяет upload. Обратная атомарность также отсутствует при delete: ошибка Chroma
логируется, после чего DB row всё равно удаляется.

### Offline index

`rag.documents.load_documents()` по умолчанию рекурсивно читает только `.md`,
сортирует paths, удаляет полные дубликаты по MD5 и читает UTF-8. Markdown-aware
splitter использует заголовки/пустые строки/переносы как separators; chunks
дедуплицируются по preview + length.

Chroma collection создаётся с cosine distance. Indexed embeddings нормализованы,
ID детерминирован как позиция + SHA1 prefix. Для совместимости индекса должны
совпадать corpus, cleaning, chunk parameters, embedding model/normalization,
metadata schema, collection name и distance metric.

### Критические ограничения текущей реализации

- `rag.vectorstore.index_chunks()` полностью выходит, если collection уже не
  пуста. Поэтому API upload обычно не добавляет новый документ в существующий
  index; это не incremental-indexing semantics.
- Bundled collection содержит legacy metadata без гарантированных `user_id` и
  `document_id`. Delete по `document_id` не удаляет legacy chunks.
- Retrieval не передаёт Chroma `where` по `user_id`. Vector search по shared
  collection не tenant-isolated; DB mapping скрывает часть источников в ответе,
  но чужой chunk уже мог попасть в LLM context.
- Перемещение Source/Folder, пересчёт materialized folder paths и удаление folder
  не синхронизируют Chroma metadata.
- PostgreSQL и Chroma не участвуют в общей транзакции.
- Не открывайте и не rebuild/delete tracked `../data/chromadb` для smoke test.
  Используйте временный каталог и отдельное имя collection.

`backend/scripts/setup_rag.py` — ручной standalone helper. Его dataset/model/
Chroma paths зависят от cwd, а существующая непустая collection будет пропущена.
Перед запуском явно проверьте destination; не используйте скрипт для обновления
bundled index без отдельного решения о rebuild/versioning.

Root scripts `scripts/load_documents.py` и
`scripts/load_documents_with_folders.py` обращаются к отсутствующему endpoint
`:8000/embed/document` и не являются актуальным способом наполнения этого backend.

## Запуск

Требуется Python 3.13 и workspace lock `../uv.lock`.

### Docker Compose

Из корня репозитория:

```bash
docker compose config --quiet
docker compose up --build postgres code-executor backend frontend
```

До `up` задайте через локальное окружение/secret store обязательные PostgreSQL и
JWT значения. OpenAI-compatible LLM URL/model/key нужны для работающего RAG-чата,
но не для CRUD-only запуска с `RAG_ENABLED=false`. Текущий Compose вообще не передаёт
`CODE_EXECUTOR_URL` из root env; корректный `http://code-executor:8002/execute`
нужно добавить явным Compose override либо исправлением service environment.
Не печатайте полный resolved Compose config: он может содержать secrets. Не
используйте `docker compose down -v` без осознанного разрешения на удаление данных.

Текущий Compose — dev-конфигурация с bind mounts и reload. У неё есть известные
packaging/security ограничения; это не production deployment.

### Локально

Поднять PostgreSQL:

```bash
docker compose up -d postgres
```

Запустить executor на host:

```bash
(cd code-executor && uv run --locked --package code-executor --group dev \
  uvicorn app:app --host 127.0.0.1 --port 8002 --reload)
```

Запустить backend из `backend/`:

```bash
(cd backend && uv run --locked --package backend --group dev \
  uvicorn app:app --host 0.0.0.0 --port 8001 --reload)
```

Для RAG host-run явно задайте `RAG_CHROMA_PATH=../data/chromadb`, доступный
`RAG_LLM_API_URL`, при необходимости `RAG_LLM_API_KEY`, корректный classifier path
и `CODE_EXECUTOR_URL=http://127.0.0.1:8002/execute`. Для CRUD-only smoke допустим
временный `RAG_ENABLED=false`.

`OUTLIER_DETECTION_ENABLED=false` запускает RAG без classifier: при пути `None`
загрузка классификатора пропускается. Для выбранной версии датасета можно передать
сохранённый prompt contract и восстановленную collection через
[Python API версионирования](DATASET_VERSIONING.md).

## Проверки

Backend tests:

```bash
(cd backend && uv run --locked --package backend --group dev python -m pytest)
```

Текущий suite не является green baseline: collection ломает устаревший import
`generate_dialogue_title`; backend dev dependencies не объявляют `greenlet` для
async SQLAlchemy; после обхода остаются старые `controller.httpx` mocks,
устаревшие citation expectations и PostgreSQL FTS test на SQLite. Не скрывайте эти
проблемы отключением tests и не приписывайте baseline failure своему изменению без
targeted сравнения.

Также отсутствует полноценное покрытие RAG core, folder API, SSE lifecycle и
реального PostgreSQL/Chroma/model integration. Для RAG unit tests используйте fake
embedder/LLM и временную Chroma collection; не скачивайте модели.

После изменения API:

1. запустите подходящие unit/route tests;
2. для DB/FTS выполните отдельный PostgreSQL smoke;
3. для SSE проверьте order, error, disconnect, rollback и commit;
4. для Source проверьте DB и Chroma состояния отдельно;
5. регенерируйте `openapi.json` и `openapi.yaml` из `app.openapi()` без запуска
   lifespan и сравните их parsed JSON/YAML представления;
6. выполните `git diff --check` и просмотрите полный diff.

## Диагностика

### `RAG service not initialized`

Проверьте наличие config keys без вывода значений, resolved Chroma/classifier
paths, доступность LLM endpoint и startup warnings. Автоматического удалённого
fallback нет.

### Источник загрузился, но не находится

Сначала сравните PostgreSQL row и Chroma metadata/count. Для непустой collection
наиболее вероятная причина — ранний выход `index_chunks()`. Не rebuild-ьте общий
index до выбора совместимой metadata/versioning и стратегии миграции.

### В ответе нет sources или ссылки не совпадают

Проверьте `source` metadata, `RAG_SOURCE_PATH_PREFIXES`, materialized folder path,
filename и наличие соответствующей user-owned `Source` row. Затем проверяйте
grouping/sort и citation remap.

### Search работает иначе в тесте и PostgreSQL

SQLite не поддерживает PostgreSQL `tsvector`, `@@`, `plainto_tsquery`, GIN и
triggers. Подтверждайте FTS поведение на PostgreSQL.

### Code block не исполняется

Streaming endpoint не исполняет blocks. Для non-stream проверьте fenced language
`python`/`py`, backend length/timeout, `CODE_EXECUTOR_URL` и ограничения AST/
RestrictedPython в code-executor.

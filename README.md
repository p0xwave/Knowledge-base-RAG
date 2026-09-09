# Knowledge Base RAG — тестирование RAG и обучение LoRA на ваших данных

Исследовательская платформа для быстрого и воспроизводимого сравнения RAG-систем
на пользовательском корпусе. Целевой сценарий: загрузить свои документы и
контрольные вопросы, прогнать готовые baseline-конфигурации и собственный RAG по
одному протоколу, сравнить качество и скорость, разобрать ошибки по отдельным
примерам.

Дополнительно система может сформировать RAG-aware synthetic dataset и обучить
LoRA/QLoRA-адаптер на том же корпусе. LoRA здесь — ещё один кандидат для
сравнения, а не единственная цель проекта.

> Сейчас встроенные RAG, evaluation и путь `documents → dataset → LoRA adapter`
> доступны как отдельные CLI-контуры. Подключение произвольного внешнего RAG,
> единый comparative run и интерфейс экспериментов ещё находятся в разработке.

Демонстрационный кейс использует документацию PyTorch 2.x и Stack Overflow, но
идея платформы не ограничена этим доменом.

## Цель проекта и статьи

Основной результат — испытательный стенд, который сокращает путь от нового
корпуса до сравнимого RAG-эксперимента. Он должен отвечать на практические вопросы:

- насколько базовый RAG работает на конкретных данных;
- какой из встроенных baseline лучше подходит этому корпусу;
- превосходит ли пользовательский RAG встроенные baseline при одинаковых условиях;
- где именно возникают ошибки retrieval и generation;
- меняет ли дополнительное обучение LoRA итоговое качество.

«Быстрый» здесь означает меньше ручной интеграции и единый воспроизводимый
протокол. Индексация, LLM-вызовы, judge-оценка и GPU-training всё равно могут быть
долгими или платными.

### Два режима сравнения

| Режим | Что фиксируется | Что сравнивается |
|---|---|---|
| End-to-end RAG benchmark | Корпус, вопросы, reference answers, метрики и бюджет | Полные RAG-системы; каждая сама извлекает свой контекст |
| Base-vs-LoRA ablation | Вопросы, retrieved context, prompt и decoding | Только влияние LoRA на generator |

Первый режим нужен для честного сравнения разных RAG. Второй изолирует эффект
адаптера и не смешивает его с изменениями retrieval.

## Целевой пользовательский сценарий

1. Загрузить корпус документов и контрольный Q&A-набор.
2. Создать версию корпуса и поискового индекса.
3. Выбрать встроенные baseline и подключить собственный RAG.
4. При необходимости сгенерировать synthetic dataset и обучить LoRA.
5. Запустить все варианты по одному плану оценки.
6. Получить метрики, latency, статистическую неопределённость и разбор ответов.

Целевой контур:

```text
свои документы ──► corpus/index snapshot ──┬─► встроенные RAG baseline ──┐
                                          └─► пользовательский RAG ─────┤
свой Q&A benchmark ─────────────────────────────────────────────────────┤
                                                                        ▼
                                                           единый evaluator
                                                                        │
документы ──► synthetic dataset ──► LoRA adapter ──► Base/LoRA arm ─────┘
                                                                        │
                                                                        ▼
                                                    metrics + examples + report
```

## Что реализовано сейчас

| Возможность | Статус | Фактическое состояние |
|---|---|---|
| Индексация своего корпуса | ✅ | CLI читает UTF-8 text; по умолчанию `.md`, расширения настраиваются |
| Встроенные RAG baseline | ✅ | `vanilla`, `rerank`, `query_transform` поверх ChromaDB |
| Web RAG demo | ✅ | Next.js-чат, FastAPI, PostgreSQL, sources/folders, citations и SSE |
| Evaluation | 🟡 | Есть lexical, semantic, RAGAS и latency; вход пока привязан к StackOverflow-подобному CSV |
| Synthetic data | 🟡 | Teacher генерирует Q&A, distractors и refusal-примеры; автоматической проверки groundedness нет |
| LoRA/QLoRA | 🟡 | Обучение и сохранение PEFT adapter реализованы; нужны Linux/CUDA и внешний serving |
| Docs-to-LoRA pipeline | 🟡 | `ingest → synth → train`; автоматических serving, Base/LoRA eval и report пока нет |
| Подключение своего RAG | ⬜ | Стабильный adapter/API contract ещё не реализован |
| Универсальный benchmark input | ⬜ | Нет импорта произвольного Q&A schema и versioned test set |
| Experiment UI и background jobs | ⬜ | Нет экранов, очереди долгих задач и общего artifact registry |

Исторические эксперименты показали, что LoRA может как улучшить отдельную метрику,
так и ухудшить итоговое качество. Поэтому проект не предполагает, что LoRA всегда
полезна: adapter должен проходить тот же benchmark, что и Base.

## Встроенные baseline и метрики

| Baseline | Реализация |
|---|---|
| `vanilla` | Dense retrieval по cosine distance |
| `rerank` | Dense candidates + CrossEncoder reranking |
| `query_transform` | LLM rewrite + HyDE + dense retrieval + reranking |

Текущий [`eval-runner`](eval-runner/README.md) считает:

- SQuAD precision/recall/F1 для RAG и ответа без контекста;
- semantic similarity между RAG и no-context ответами;
- RAGAS `faithfulness`, `answer_relevancy`, `context_recall` при доступном judge;
- mean, p50 и p95 latency;
- составной RAG score с настраиваемыми весами.

Один eval-run сейчас оценивает одну generator-модель. Base и LoRA запускаются
раздельно, а одинаковые retrieved contexts не гарантируются. Это ограничение
должно быть устранено до выводов о влиянии адаптера.

Пользовательский RAG пока нельзя передать как plugin или endpoint: evaluator сам
строит один из трёх встроенных pipelines. Для целевого сценария нужен общий
контракт входов, retrieved chunks, answer, timings и errors.

## Synthetic data и LoRA

Текущий offline-контур:

```text
documents
   └─► отдельная ChromaDB
          └─► teacher-generated Q&A + distractors + refusals
                 └─► structured train/val JSONL
                        └─► LoRA/QLoRA training
                               └─► PEFT adapter + tokenizer + prompt contract
```

[`lora-pipeline`](lora-pipeline/README.md) объединяет ingest, synthesis и training.
Результат — adapter, а не merged model и не автоматически развёрнутый endpoint.
Получившийся adapter нужно отдельно подключить к vLLM и оценить.

Без запуска дорогих стадий можно посмотреть доступные параметры:

```bash
uv run --locked --package dataset-prep python -m dataset_prep --help
uv run --locked --package dataset-synth python -m dataset_synth --help
uv run --locked --package lora-pipeline python -m lora_pipeline --help
uv run --locked --package eval-runner python -m eval_runner --help
```

Полная генерация обращается к teacher endpoint, evaluation — к generator/judge,
а LoRA training требует GPU. Для эксперимента всегда используйте новый output
directory и отдельную Chroma collection.

## Архитектура reference-приложения

```text
Browser / Next.js :3000
  └─ JSON + SSE; JWT в localStorage
       └─ FastAPI :8001
            ├─ PostgreSQL :5432 — users, dialogues, messages, folders, sources
            ├─ ChromaDB + embeddings + reranker
            ├─ внешний OpenAI-compatible LLM
            ├─ off-topic classifier
            └─ code-executor :8002
```

Chat-приложение показывает работу одного RAG над базой знаний. Это reference demo,
а не готовый интерфейс benchmark-платформы.

Внешний vLLM/Ollama/gateway не входит в Docker Compose. Без него backend может
обслуживать CRUD, но генерация ответов недоступна.

## Структура репозитория

| Путь | Назначение |
|---|---|
| [`frontend/`](frontend/AGENTS.md) | Next.js reference UI |
| [`backend/`](backend/AGENTS.md) | FastAPI, JWT, PostgreSQL и orchestration runtime |
| [`rag/`](rag/AGENTS.md) | Документы, ChromaDB, retrieval, prompts и LLM client |
| [`dataset-prep/`](dataset-prep/dataset_prep/__main__.py) | Подготовка StackOverflow SFT dataset |
| [`dataset-synth/`](dataset-synth/dataset_synth/__main__.py) | Генерация synthetic Q&A и adversarial rows |
| [`prompt-contract/`](prompt-contract/prompt_contract/__init__.py) | Версионированный training/inference prompt |
| [`lora-train/`](lora-train/lora_train/__main__.py) | LoRA/QLoRA training |
| [`lora-pipeline/`](lora-pipeline/README.md) | Documents-to-adapter pipeline |
| [`eval-runner/`](eval-runner/README.md) | Evaluation, presets и W&B tracking |
| [`code-executor/`](code-executor/app.py) | Исследовательский Python executor |
| [`outlier-detection/`](outlier-detection/outlier_detection/topic_classifier.py) | Off-topic classifier |

`torch-parser` и `tgbot` являются legacy/experimental контурами и не входят в
основной runtime.

## Требования

- Python 3.13, `uv` и корневой `uv.lock`;
- Node.js 20 и pnpm для frontend;
- Docker и Docker Compose для dev-сервисов;
- OpenAI-compatible endpoint для генератора, teacher и при необходимости judge;
- Linux/CUDA для полного LoRA/QLoRA training.

Все Python-пакеты входят в один `uv` workspace и используют общую `.venv`.
Запускайте команды через `uv run --locked --package <name>`. Не выполняйте
`uv sync --all-packages --all-groups` без необходимости: он устанавливает тяжёлый
ML/CUDA stack.

## Запуск reference demo

Создайте приватный корневой `.env`, затем проверьте Compose и запустите нужные
сервисы:

```bash
docker compose config --quiet
docker compose up --build postgres code-executor backend frontend
```

После запуска:

- UI: `http://localhost:3000`;
- Swagger: `http://localhost:8001/api/docs`;
- API prefix: `http://localhost:8001/api`.

Это dev-конфигурация с bind mounts и reload. Полный Docker build пока не считается
green: backend image видит неполный workspace, service URL executor зависит от
окружения, а внешний LLM не запускается.

Публичной регистрации нет: пользователя нужно provision через локальную БД.
Frontend устанавливается только через `pnpm install --frozen-lockfile`; старый
`package-lock.json` не обновляется.

Canonical настройки находятся в:

- [`backend/settings.py`](backend/settings.py) — runtime backend;
- [`rag/rag/config.py`](rag/rag/config.py) — standalone RAG;
- config dataclasses соответствующих experiment CLI.

`NEXT_PUBLIC_API_URL` задаётся как origin backend без `/api`. Не публикуйте
секреты в `NEXT_PUBLIC_*`.

Backend поддерживает [датасеты и неизменяемые версии](backend/DATASET_VERSIONING.md):
CRUD API для будущего интерфейса и Python API для снимков документов, обучающих
и eval-файлов, дедупликацию артефактов и восстановление выбранной версии из Python
для RAG/обучения. Автоматическое переключение chat UI не подключено.

## Проверки

Whole-repo lint/type/test baseline сейчас красный, CI отсутствует. Это не разрешает
добавлять новые ошибки: проверяйте только затронутые файлы и честно отделяйте
регрессии от известных проблем.

```bash
uv --no-cache lock --check
uv run --locked --package lora-pipeline --with pytest \
  python -m pytest prompt-contract/tests dataset-synth/tests lora-pipeline/tests -q

cd frontend
pnpm lint
pnpm format:check
pnpm exec tsc --noEmit --incremental false
```

Backend suite имеет известные collection/runtime failures; полный eval требует
моделей и внешних endpoints, а training — CUDA. Не называйте их проверенными, если
они не запускались.

## Важные ограничения и безопасность

- Проект находится в research/dev-состоянии и не является production deployment.
- «Ваш RAG» — целевая функция: сейчас доступны только три встроенных pipeline.
- «Ваши данные» пока означают UTF-8 text для ingest и StackOverflow-подобный CSV
  для eval. Универсального importer и PDF/DOCX parser нет.
- Shared Chroma не фильтруется по пользователю; research UI нельзя открывать всем
  пользователям до tenant isolation.
- Выбор папок в frontend пока не ограничивает retrieval end-to-end.
- Текущие synthetic train/val имеют известные пересечения; новую статью нужно
  строить на пересобранном leakage-free benchmark. Детали есть в
  [`ROADMAP.md`](ROADMAP.md).
- Backend и eval не загружают prompt contract адаптера автоматически.
- Teacher получает plaintext корпуса. Внешний endpoint допустим только с
  подходящей data-retention policy.
- `backend/.env` и `frontend/.env.local` уже отслеживаются Git; обнаруженное в
  backend правдоподобное секретное значение нужно считать раскрытым и ротировать.
- `lora-pipeline` сохраняет `teacher_api_key` в manifest, а eval CLI безусловно
  отправляет config, contexts и generator/judge keys в W&B. До исправления не
  используйте реальные cloud keys или приватный corpus в этих путях.
- `data/chromadb`, datasets, logs, W&B runs и model outputs являются mutable или
  tracked artifacts. Для smoke создавайте новые временные paths; не перестраивайте
  bundled index.
- Code executor использует ограничения и отдельный процесс, но не является strong
  isolation для враждебного кода.

## Roadmap и документация

- [`ROADMAP.md`](ROADMAP.md) — цели и статусы платформы: BYO-data/BYO-RAG
  benchmark, единый evaluator, LoRA-расширение, experiment UI и статья.
- [`SUMMARY.md`](SUMMARY.md) — краткий снимок фактического runtime.
- [`backend/README_RAG_INTEGRATION.md`](backend/README_RAG_INTEGRATION.md) — детали
  backend, PostgreSQL, RAG и executor.
- [`lora-pipeline/README.md`](lora-pipeline/README.md) — documents-to-adapter flow.
- [`eval-runner/README.md`](eval-runner/README.md) — параметры evaluation и presets.
- [`AGENTS.md`](AGENTS.md), [`backend/AGENTS.md`](backend/AGENTS.md),
  [`rag/AGENTS.md`](rag/AGENTS.md), [`frontend/AGENTS.md`](frontend/AGENTS.md) —
  правила разработки и subsystem contracts.

При конфликте документации с кодом источником истины остаются реализация, типы и
canonical config.

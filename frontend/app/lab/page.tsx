"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  Check,
  Clock3,
  Database,
  Download,
  Files,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LabDatasetFiles } from "@/components/lab-dataset-files"
import { ThemeToggle } from "@/components/theme-toggle"
import { isAuthenticated } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {
  cancelLabRun,
  createSynthesis,
  downloadLabArtifact,
  loadLab,
  planTraining,
  uploadDataset,
  type LabCatalog,
  type LabDataset,
  type LabRun,
} from "@/lib/api/lab"

const selectClass =
  "border-input bg-background focus-visible:ring-ring w-full min-w-0 rounded-md border px-3 py-2 text-sm focus-visible:ring-2"
const statusText: Record<LabRun["status"], string> = {
  queued: "В очереди",
  running: "Генерируется",
  completed: "Готово",
  failed: "Ошибка",
  cancelled: "Отменён",
  planned: "Запланирован",
}
const date = (value: string) =>
  new Date(`${value}${/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? "" : "Z"}`).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
const versionKind = {
  source: "Документы",
  synthesis: "Синтетические данные",
  training: "План LoRA",
  snapshot: "Снимок",
}
const countRules = new Intl.PluralRules("ru")
const countLabel = (count: number, forms: [string, string, string]) => {
  const form = countRules.select(count)
  return `${count} ${forms[form === "one" ? 0 : form === "few" ? 1 : 2]}`
}
const shortModel = (value: string) => value.split("/").pop()

function RunStatus({ run }: { run: LabRun }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        run.status === "completed" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        run.status === "failed" && "text-destructive"
      )}
    >
      {run.status === "running" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : run.status === "completed" ? (
        <Check className="size-3" />
      ) : (
        <Clock3 className="size-3" />
      )}
      {statusText[run.status]}
    </Badge>
  )
}

export default function LabPage() {
  const router = useRouter()
  const [datasets, setDatasets] = useState<LabDataset[]>([])
  const [runs, setRuns] = useState<LabRun[]>([])
  const [catalog, setCatalog] = useState<LabCatalog | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [tabSelection, setTab] = useState<"synthesis" | "training" | null>(null)
  const [dialog, setDialog] = useState<"upload" | "synthesis" | "training" | null>(null)
  const [newVersion, setNewVersion] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState("")
  const [model, setModel] = useState("")
  const [seed, setSeed] = useState(42)
  const [maxChunks, setMaxChunks] = useState(100)
  const [pairs, setPairs] = useState(3)
  const [epochs, setEpochs] = useState(2)
  const [rank, setRank] = useState(16)
  const [parentId, setParentId] = useState("")
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const selected = datasets.find((d) => d.id === selectedId)
  const tab = tabSelection ?? (selected?.kind === "training" ? "training" : "synthesis")
  const related = runs.filter(
    (r) =>
      r.datasetId === selected?.familyId &&
      (selected?.version === 0 ||
        (!r.inputVersionId && !r.outputVersionId) ||
        r.sourceVersionId === selectedId ||
        r.inputVersionId === selectedId ||
        r.outputVersionId === selectedId)
  )
  const synthesis = related.filter((r) => r.kind === "synthesis")
  const completed = synthesis.filter((r) => r.status === "completed" && r.outputVersionId !== null)
  const visible = related.filter((r) => r.kind === tab)
  const families = new Set(datasets.map((d) => d.familyId)).size

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login")
      return
    }
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      const result = await loadLab()
      if (stopped) return
      setLoading(false)
      if (result.success) {
        setDatasets(result.data.datasets)
        setRuns(result.data.runs)
        setCatalog(result.data.catalog)
        setSelectedId((previous) =>
          result.data.datasets.some((d) => d.id === previous)
            ? previous
            : (result.data.datasets.find((d) => d.kind === "source")?.id ??
              result.data.datasets[0]?.id ??
              "")
        )
        setError("")
      } else setError(result.error)
      timer = setTimeout(refresh, 5000)
    }
    void refresh()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [router, refreshKey])

  const selectVersion = (id: string) => {
    setSelectedId(id)
    setTab(datasets.find((d) => d.id === id)?.kind === "training" ? "training" : "synthesis")
  }
  const openUpload = (version: boolean) => {
    setNewVersion(version)
    setFiles([])
    setName(version ? (selected?.name ?? "") : "")
    setDialog("upload")
  }
  const openSynthesis = () => {
    setModel(catalog?.teacherModels[0] ?? "")
    setDialog("synthesis")
  }
  const openTraining = (id?: string) => {
    setParentId(id ?? completed[0]?.id ?? "")
    setModel(catalog?.trainingModels[0] ?? "")
    setDialog("training")
  }
  const download = async (run: LabRun, artifact: "train" | "val" | "manifest") => {
    const result = await downloadLabArtifact(run, artifact)
    if (!result.success) toast.error(result.error)
  }
  const cancel = async (id: string) => {
    const result = await cancelLabRun(id)
    if (!result.success) toast.error(result.error)
    else setRefreshKey((k) => k + 1)
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      if (dialog === "upload") {
        if (
          !files.length ||
          files.length > 100 ||
          files.some((f) => !/\.(txt|md)$/i.test(f.name)) ||
          files.reduce((sum, f) => sum + f.size, 0) > 10 * 1024 * 1024
        ) {
          toast.error("Выберите от 1 до 100 файлов TXT / Markdown общим размером до 10 МБ.")
          return
        }
        const result = await uploadDataset(files, name, newVersion ? selected?.familyId : undefined)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        setSelectedId(result.data.id)
        setDatasets((previous) => [result.data, ...previous])
        setTab("synthesis")
      } else if (dialog === "synthesis") {
        const result = await createSynthesis(selectedId, model, seed, maxChunks, pairs)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        setTab("synthesis")
      } else {
        const result = await planTraining(parentId, model, seed, epochs, rank)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        setTab("training")
      }
      setDialog(null)
      setRefreshKey((k) => k + 1)
      toast.success("Сохранено")
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border bg-card border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Вернуться к чату">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2 font-semibold">
              <Beaker className="text-primary size-5" />
              DataMind <span className="text-muted-foreground font-normal">/ Лаборатория</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-7 px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
              Данные и эксперименты
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">DataLab</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
              Загружайте знания, создавайте синтетические датасеты и сохраняйте прогоны LoRA. Каждая
              версия остаётся в истории.
            </p>
          </div>
          <Button onClick={() => openUpload(false)} disabled={loading || !!error} className="gap-2">
            <Plus className="size-4" />
            Загрузить датасет
          </Button>
        </div>
        <ol
          aria-label="Этапы работы: документы, синтетика, обучение LoRA"
          aria-busy={loading}
          className="border-border grid gap-5 border-y py-5 sm:grid-cols-3 sm:gap-6"
        >
          {[
            {
              icon: Files,
              label: "Документы",
              detail: countLabel(families, ["датасет", "датасета", "датасетов"]),
            },
            {
              icon: Sparkles,
              label: "Синтетические данные",
              detail: countLabel(datasets.filter((d) => d.kind === "synthesis").length, [
                "версия",
                "версии",
                "версий",
              ]),
            },
            {
              icon: GitBranch,
              label: "Обучение LoRA",
              detail: `${countLabel(runs.filter((r) => r.kind === "training").length, [
                "план",
                "плана",
                "планов",
              ])} · запуск позже`,
            },
          ].map(({ icon: Icon, label, detail }, index) => (
            <li key={label} className="flex min-w-0 items-center gap-3">
              <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                  {loading || error ? "—" : detail}
                </p>
              </div>
              {index < 2 && (
                <ArrowRight
                  aria-hidden="true"
                  className="text-muted-foreground hidden size-4 shrink-0 sm:block"
                />
              )}
            </li>
          ))}
        </ol>
        {error && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="mr-2 size-3" />
              Повторить
            </Button>
          </div>
        )}
        {loading ? (
          <div role="status" className="text-muted-foreground flex justify-center gap-3 py-24">
            <Loader2 className="size-5 animate-spin" />
            Загружаем историю…
          </div>
        ) : !datasets.length && !error ? (
          <div className="border-border bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
            <div className="bg-primary/10 text-primary mb-5 rounded-2xl p-4">
              <Upload className="size-7" />
            </div>
            <h2 className="text-xl font-semibold">Начните с ваших документов</h2>
            <p className="text-muted-foreground mt-3 max-w-md text-sm leading-6">
              Соберите TXT и Markdown в датасет. После загрузки можно создать несколько версий
              синтетики разными моделями.
            </p>
            <Button onClick={() => openUpload(false)} className="mt-6">
              Выбрать документы
            </Button>
            <span className="text-muted-foreground mt-3 text-xs">
              UTF-8 · до 100 файлов · до 10 МБ суммарно
            </span>
          </div>
        ) : (
          selected && (
            <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-border bg-card overflow-hidden rounded-xl border">
                <div className="border-border flex items-center justify-between border-b p-4">
                  <h2 className="font-medium">Датасеты и версии</h2>
                  <Database className="text-muted-foreground size-4" />
                </div>
                <div className="max-h-[560px] space-y-1 overflow-auto p-2">
                  {datasets.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => selectVersion(d.id)}
                      aria-pressed={d.id === selectedId}
                      className={cn(
                        "focus-visible:ring-ring w-full rounded-lg px-3 py-3 text-left transition-colors focus-visible:ring-2",
                        d.id === selectedId ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{d.name}</span>
                        <Badge variant="outline">v{d.version}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {versionKind[d.kind]} · {d.filenames.length} файлов
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">{date(d.createdAt)}</p>
                    </button>
                  ))}
                </div>
              </aside>
              <section className="min-w-0 space-y-5">
                <div className="border-border bg-card rounded-xl border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-xl font-semibold">{selected.name}</h2>
                        <Badge variant="secondary">v{selected.version}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {(selected.sizeBytes / 1024).toFixed(1)} КБ · {versionKind[selected.kind]} ·{" "}
                        {date(selected.createdAt)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openUpload(true)}>
                      <Plus className="mr-2 size-3" />
                      Новая версия
                    </Button>
                  </div>
                  {selected.baseVersionId && (
                    <div className="mt-3 text-xs">
                      {datasets.find((d) => d.id === selected.baseVersionId) ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => selectVersion(selected.baseVersionId!)}
                        >
                          Основано на v
                          {datasets.find((d) => d.id === selected.baseVersionId)?.version}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">
                          Исходная версия удалена; файлы этого снимка сохранены.
                        </span>
                      )}
                    </div>
                  )}
                  <LabDatasetFiles key={selected.id} dataset={selected} />
                  <p
                    className="text-muted-foreground mt-3 truncate font-mono text-[10px]"
                    title={selected.sha256}
                  >
                    SHA-256 {selected.sha256}
                  </p>
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-foreground font-medium">Документы</span>
                  <ArrowRight className="size-3" />
                  <span>Версии синтетики</span>
                  <ArrowRight className="size-3" />
                  <span>LoRA и метрики</span>
                </div>
                <div className="border-border bg-card overflow-hidden rounded-xl border">
                  <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div
                      className="bg-muted flex rounded-lg p-1"
                      role="group"
                      aria-label="Тип экспериментов"
                    >
                      {(["synthesis", "training"] as const).map((t) => (
                        <button
                          key={t}
                          aria-pressed={tab === t}
                          onClick={() => setTab(t)}
                          className={cn(
                            "focus-visible:ring-ring rounded-md px-3 py-2 text-sm focus-visible:ring-2",
                            tab === t
                              ? "bg-background font-medium shadow-sm"
                              : "text-muted-foreground"
                          )}
                        >
                          {t === "synthesis" ? "Синтетические данные" : "Обучение LoRA"}{" "}
                          <span className="ml-1 opacity-60">
                            {related.filter((r) => r.kind === t).length}
                          </span>
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !!error ||
                        (tab === "synthesis"
                          ? !catalog?.synthesisConfigured || !selected.canSynthesize
                          : !completed.length)
                      }
                      onClick={() => (tab === "synthesis" ? openSynthesis() : openTraining())}
                    >
                      <Plus className="mr-1 size-3" />
                      {tab === "synthesis" ? "Сгенерировать" : "Новый прогон"}
                    </Button>
                  </div>
                  {tab === "training" && (
                    <div className="border-border bg-muted/40 border-b px-5 py-4 text-sm leading-6">
                      <span className="font-medium">Обучение будет подключено позже.</span> Сейчас
                      сохраняются модель и параметры прогона для суперкомпьютера. Loss и другие
                      метрики появятся после реального обучения.
                    </div>
                  )}
                  {tab === "synthesis" && !selected.canSynthesize && (
                    <p className="border-border bg-muted/40 border-b px-5 py-4 text-sm">
                      Для новой генерации выберите версию исходных TXT/Markdown или загрузите
                      документы.
                    </p>
                  )}
                  {tab === "synthesis" && !catalog?.synthesisConfigured && (
                    <p className="bg-muted/40 border-border border-b px-5 py-4 text-sm leading-6">
                      Для генерации нужно подключить модель-генератор в настройках сервера.
                      Загружать и версионировать документы можно уже сейчас.
                    </p>
                  )}
                  {tab === "synthesis" &&
                    catalog?.synthesisConfigured &&
                    !catalog.synthesisWorkerOnline && (
                      <p
                        role="status"
                        className="bg-muted/40 border-border border-b px-5 py-4 text-sm"
                      >
                        Рабочий процесс генерации не подключён. Новые запуски останутся в очереди до
                        его подключения.
                      </p>
                    )}
                  {!visible.length ? (
                    <div className="px-6 py-12 text-center">
                      <Sparkles className="text-muted-foreground mx-auto mb-3 size-6" />
                      <h3 className="font-medium">
                        {tab === "synthesis"
                          ? "Здесь появятся версии синтетики"
                          : "Пока нет прогонов LoRA"}
                      </h3>
                      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-6">
                        {tab === "synthesis"
                          ? "Выберите модель-генератор. Повторный запуск сохранится отдельно, даже с теми же параметрами."
                          : "Создайте синтетический датасет, затем выберите базовую модель и сохраните план обучения."}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-border divide-y">
                      {visible.map((run) => (
                        <article key={run.id} className="space-y-4 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">
                                  {run.kind === "synthesis" ? "Синтетические данные" : "Прогон"} #
                                  {run.version}
                                </span>
                                <RunStatus run={run} />
                              </div>
                              <p className="mt-2 text-sm font-medium break-all">
                                {shortModel(run.model)}
                              </p>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {date(run.createdAt)} · seed {String(run.config.seed)}
                                {run.parentRunId &&
                                  ` · генерация #${runs.find((s) => s.id === run.parentRunId)?.version ?? "?"}`}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {run.status === "completed" && run.outputVersionId !== null && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => download(run, "train")}
                                  >
                                    <Download className="mr-1 size-3" />
                                    Train
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => download(run, "val")}
                                  >
                                    Validation
                                  </Button>
                                  <Button size="sm" onClick={() => openTraining(run.id)}>
                                    План LoRA
                                  </Button>
                                </>
                              )}
                              {(run.status === "completed" || run.kind === "training") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => download(run, "manifest")}
                                  aria-label={`Скачать конфигурацию ${run.kind} #${run.version}`}
                                >
                                  <Download className="size-4" />
                                </Button>
                              )}
                              {["queued", "planned"].includes(run.status) && (
                                <Button size="sm" variant="ghost" onClick={() => cancel(run.id)}>
                                  Отменить
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {(
                              [
                                ["Вход", run.inputVersionId],
                                ["Результат", run.outputVersionId],
                              ] as const
                            ).map(([label, id]) => {
                              const version = datasets.find((d) => d.id === id)
                              return version ? (
                                <Button
                                  key={label}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => selectVersion(version.id)}
                                >
                                  {label}: v{version.version} · {versionKind[version.kind]}
                                </Button>
                              ) : (
                                <span key={label} className="text-muted-foreground">
                                  {label}:{" "}
                                  {id ||
                                  label === "Вход" ||
                                  run.status === "completed" ||
                                  run.kind === "training"
                                    ? "версия удалена"
                                    : "ожидается"}
                                </span>
                              )
                            })}
                          </div>
                          {run.error && (
                            <p
                              role="alert"
                              className="text-destructive bg-destructive/5 rounded-lg p-3 text-sm"
                            >
                              {run.error}
                            </p>
                          )}
                          <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg p-3">
                            {(run.kind === "synthesis"
                              ? [
                                  ["Train", run.metrics.train],
                                  ["Validation", run.metrics.val],
                                  ["Q&A пар", run.metrics.synth_pairs],
                                ]
                              : [
                                  ["Train loss", run.metrics.train_loss],
                                  ["Eval loss", run.metrics.eval_loss],
                                  ["Эпохи (план)", run.config.epochs],
                                ]
                            ).map(([label, value]) => (
                              <div key={String(label)}>
                                <p className="text-muted-foreground text-[11px]">{label}</p>
                                <p className="mt-1 text-sm font-semibold tabular-nums">
                                  {value === undefined ? "—" : String(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                          {run.kind === "synthesis" && run.status === "completed" && (
                            <p className="text-muted-foreground text-xs leading-5">
                              Количество примеров не является оценкой качества. Проверка
                              достоверности ответов отдельно не проводилась.
                            </p>
                          )}
                          <details className="text-muted-foreground text-xs">
                            <summary className="cursor-pointer">Параметры и происхождение</summary>
                            <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded-lg p-3 text-[11px]">
                              {JSON.stringify(
                                { run_id: run.id, config: run.config, metrics: run.metrics },
                                null,
                                2
                              )}
                            </pre>
                          </details>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )
        )}
      </main>
      {dialog && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open && !busy) setDialog(null)
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {dialog === "upload"
                  ? newVersion
                    ? "Новая версия документов"
                    : "Загрузить датасет"
                  : dialog === "synthesis"
                    ? "Новая версия синтетики"
                    : "Запланировать LoRA"}
              </DialogTitle>
              <DialogDescription>
                {dialog === "upload"
                  ? "TXT и Markdown в UTF-8. Каждая загрузка сохраняется как отдельная неизменяемая версия."
                  : dialog === "synthesis"
                    ? "Модель получит выбранные тексты и создаст пары вопрос–ответ. Запуск обращается к настроенному серверу модели и может расходовать его ресурсы."
                    : "Сохраним конфигурацию будущего обучения. Вычисления пока не запускаются."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
                {dialog === "upload" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="dataset-name">Название датасета</Label>
                      <Input
                        id="dataset-name"
                        required
                        maxLength={120}
                        value={name}
                        disabled={newVersion}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Например, документация проекта"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataset-files">Документы</Label>
                      <Input
                        id="dataset-files"
                        type="file"
                        multiple
                        accept=".txt,.md"
                        required
                        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                        className="h-auto py-3"
                      />
                      <p className="text-muted-foreground text-xs">
                        До 100 файлов, общий размер до 10 МБ. Выбрано: {files.length}.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {dialog === "training" && (
                      <div className="space-y-2">
                        <Label htmlFor="parent-run">Версия синтетики</Label>
                        <select
                          id="parent-run"
                          className={selectClass}
                          value={parentId}
                          onChange={(e) => setParentId(e.target.value)}
                          required
                        >
                          {completed.map((r) => (
                            <option key={r.id} value={r.id}>
                              v{datasets.find((d) => d.id === r.outputVersionId)?.version ?? "?"} ·
                              #{r.version} · {shortModel(r.model)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="lab-model">
                        {dialog === "synthesis" ? "Модель-генератор" : "Базовая модель"}
                      </Label>
                      <select
                        id="lab-model"
                        className={selectClass}
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        required
                      >
                        {(dialog === "synthesis"
                          ? catalog?.teacherModels
                          : catalog?.trainingModels
                        )?.map((m) => (
                          <option key={m} value={m}>
                            {shortModel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lab-seed">Seed</Label>
                        <Input
                          id="lab-seed"
                          type="number"
                          required
                          min={0}
                          max={2147483647}
                          value={seed}
                          onChange={(e) => setSeed(e.target.valueAsNumber)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lab-amount">
                          {dialog === "synthesis" ? "Максимум фрагментов" : "Эпохи"}
                        </Label>
                        <Input
                          id="lab-amount"
                          required
                          type="number"
                          min={dialog === "synthesis" ? 2 : 0.1}
                          max={dialog === "synthesis" ? 2000 : 20}
                          step={dialog === "synthesis" ? 1 : 0.1}
                          value={dialog === "synthesis" ? maxChunks : epochs}
                          onChange={(e) =>
                            dialog === "synthesis"
                              ? setMaxChunks(e.target.valueAsNumber)
                              : setEpochs(e.target.valueAsNumber)
                          }
                        />
                      </div>
                    </div>
                    {dialog === "synthesis" ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="lab-pairs">Q&A пар на фрагмент (максимум)</Label>
                          <Input
                            id="lab-pairs"
                            type="number"
                            required
                            min={1}
                            max={10}
                            value={pairs}
                            onChange={(e) => setPairs(e.target.valueAsNumber)}
                          />
                        </div>
                        <p className="text-muted-foreground text-xs leading-5">
                          20% исходных контекстов с ответами выделяются для проверки. Одинаковые
                          контексты не попадут в обе выборки; фрагменты одного документа могут.
                          Нужно минимум два разных фрагмента с ответами.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="lab-rank">LoRA rank</Label>
                          <select
                            id="lab-rank"
                            className={selectClass}
                            value={rank}
                            onChange={(e) => setRank(Number(e.target.value))}
                          >
                            {[8, 16, 32, 64].map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          QLoRA · learning rate 0.0002. Параметры сохраняются в конфигурации
                          прогона.
                        </p>
                      </>
                    )}
                  </>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || (dialog !== "upload" && !model)}
                >
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {dialog === "upload"
                    ? "Сохранить версию"
                    : dialog === "synthesis"
                      ? "Запустить генерацию"
                      : "Сохранить план обучения"}
                </Button>
              </fieldset>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

import { api, safeRequest } from "./client"

interface BackendDataset {
  id: string
  family_id: string
  version: number
  name: string
  filenames: string[]
  sha256: string
  size_bytes: number
  kind: "source" | "synthesis" | "training" | "snapshot"
  can_synthesize: boolean
  base_version_id: number | null
  file_ids: Record<string, number>
  created_at: string
}
interface BackendRun {
  id: string
  dataset_id: number
  input_version_id: number | null
  output_version_id: number | null
  parent_run_id: string | null
  kind: "synthesis" | "training"
  version: number
  model: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "planned"
  config: Record<string, number | string | boolean>
  metrics: Record<string, number | string>
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

function adaptDataset(d: BackendDataset) {
  return {
    id: d.id,
    familyId: d.family_id,
    version: d.version,
    name: d.name,
    filenames: d.filenames,
    sha256: d.sha256,
    sizeBytes: d.size_bytes,
    kind: d.kind,
    canSynthesize: d.can_synthesize,
    baseVersionId: d.base_version_id === null ? null : String(d.base_version_id),
    fileIds: d.file_ids,
    createdAt: d.created_at,
  }
}
function adaptRun(r: BackendRun) {
  return {
    id: r.id,
    datasetId: String(r.dataset_id),
    inputVersionId: r.input_version_id === null ? null : String(r.input_version_id),
    outputVersionId: r.output_version_id === null ? null : String(r.output_version_id),
    sourceVersionId: String(r.config.source_version_id),
    parentRunId: r.parent_run_id,
    kind: r.kind,
    version: r.version,
    model: r.model,
    status: r.status,
    config: r.config,
    metrics: r.metrics,
    error: r.error,
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  }
}
export type LabDataset = ReturnType<typeof adaptDataset>
export type LabRun = ReturnType<typeof adaptRun>
export interface LabCatalog {
  teacherModels: string[]
  trainingModels: string[]
  synthesisConfigured: boolean
  synthesisWorkerOnline: boolean
}
export const loadLab = () =>
  safeRequest(async () => {
    const [overview, catalog] = await Promise.all([
      api.get<{ datasets: BackendDataset[]; runs: BackendRun[] }>("/api/lab"),
      api.get<{
        teacher_models: string[]
        training_models: string[]
        synthesis_configured: boolean
        synthesis_worker_online: boolean
      }>("/api/lab/catalog"),
    ])
    return {
      datasets: overview.datasets.map(adaptDataset),
      runs: overview.runs.map(adaptRun),
      catalog: {
        teacherModels: catalog.teacher_models,
        trainingModels: catalog.training_models,
        synthesisConfigured: catalog.synthesis_configured,
        synthesisWorkerOnline: catalog.synthesis_worker_online,
      },
    }
  })
export const uploadDataset = (files: File[], name: string, datasetId?: string) =>
  safeRequest(async () => {
    const form = new FormData()
    files.forEach((file) => form.append("files", file))
    form.append("name", name)
    if (datasetId) form.append("dataset_id", datasetId)
    return adaptDataset(await api.upload<BackendDataset>("/api/lab/datasets", form))
  })
export const createSynthesis = (
  datasetId: string,
  model: string,
  seed: number,
  maxChunks: number,
  pairs: number
) =>
  safeRequest(async () =>
    adaptRun(
      await api.post<BackendRun>(`/api/lab/versions/${datasetId}/synthesis`, {
        model,
        seed,
        max_chunks: maxChunks,
        n_qa_per_chunk: pairs,
      })
    )
  )
export const planTraining = (
  runId: string,
  model: string,
  seed: number,
  epochs: number,
  rank: number
) =>
  safeRequest(async () =>
    adaptRun(
      await api.post<BackendRun>(`/api/lab/runs/${runId}/training`, {
        model,
        seed,
        epochs,
        lora_r: rank,
      })
    )
  )
export const cancelLabRun = (id: string) =>
  safeRequest(() => api.post<BackendRun>(`/api/lab/runs/${id}/cancel`))
export const downloadLabArtifact = (run: LabRun, artifact: "train" | "val" | "manifest") =>
  safeRequest(async () => {
    const blob = await api.download(`/api/lab/runs/${run.id}/download/${artifact}`)
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${run.kind}-v${run.version}-${artifact}.${artifact === "manifest" ? "json" : "jsonl"}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })

export const previewSnapshotFile = (
  familyId: string,
  versionId: string,
  fileId: number,
  filename: string
) =>
  safeRequest(async () => {
    if (!/\.(txt|md|markdown|json|jsonl|csv|tsv|yaml|yml|log)$/i.test(filename)) {
      throw new Error("Предпросмотр этого формата недоступен. Скачайте файл, чтобы открыть его.")
    }
    const limit = 128 * 1024
    const blob = await api.get<Blob>(
      `/api/dataset/${familyId}/versions/${versionId}/files/${fileId}/download`,
      undefined,
      { responseType: "blob", headers: { Range: `bytes=0-${limit - 1}` } }
    )
    const truncated = blob.size >= limit
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await blob.slice(0, limit).arrayBuffer(),
        { stream: truncated }
      )
      if (text.includes("\u0000")) throw new Error("Binary content")
      return { text, truncated }
    } catch {
      throw new Error("Не удалось прочитать файл как текст UTF-8. Скачайте его для просмотра.")
    }
  })

export const downloadSnapshotFile = (dataset: LabDataset, filename: string) =>
  safeRequest(async () => {
    const blob = await api.download(
      `/api/dataset/${dataset.familyId}/versions/${dataset.id}/files/${dataset.fileIds[filename]}/download`
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename.split("/").pop() || "artifact"
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })

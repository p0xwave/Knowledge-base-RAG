"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ChevronRight, Download, FileText, Files, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadSnapshotFile, previewSnapshotFile, type LabDataset } from "@/lib/api/lab"

const badgeClass =
  "border-border flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs"

function FilePreview({ dataset, filename }: { dataset: LabDataset; filename: string }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof previewSnapshotFile>> | null>(null)

  const { familyId, id } = dataset
  const fileId = dataset.fileIds[filename]

  useEffect(() => {
    let active = true
    previewSnapshotFile(familyId, id, fileId, filename).then((value) => {
      if (active) setResult(value)
    })
    return () => {
      active = false
    }
  }, [familyId, id, fileId, filename])

  if (!result) {
    return (
      <p role="status" className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Загружаем документ…
      </p>
    )
  }
  if (!result.success) {
    return (
      <p role="alert" className="text-destructive p-4 text-sm">
        {result.error}
      </p>
    )
  }
  return (
    <div className="min-h-0 overflow-auto rounded-lg border">
      {result.data.truncated && (
        <p className="text-muted-foreground border-b p-3 text-xs">
          Показано начало файла (до 128 КиБ). Полный файл можно скачать.
        </p>
      )}
      <pre className="p-4 font-mono text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
        {result.data.text || "Файл пуст."}
      </pre>
    </div>
  )
}

export function LabDatasetFiles({ dataset }: { dataset: LabDataset }) {
  const measureRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const [visibleCount, setVisibleCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [filename, setFilename] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const filenamesKey = JSON.stringify(dataset.filenames)

  useEffect(() => {
    const container = measureRef.current
    if (!container) return
    const measure = () => {
      let previousTop = -1
      let rows = 0
      let count = 0
      for (const child of Array.from(container.children)) {
        const top = (child as HTMLElement).offsetTop
        if (top !== previousTop) {
          rows++
          previousTop = top
        }
        if (rows > 2) break
        count++
      }
      setVisibleCount(count)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [filenamesKey])

  const showFile = (name: string) => {
    setFilename(name)
    setOpen(true)
  }

  return (
    <div className="relative mt-4">
      {/* Noninteractive copies measure wrapping without leaving hidden focus targets. */}
      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        <div ref={measureRef} className="flex flex-wrap gap-2">
          {dataset.filenames.map((name) => (
            <span key={name} className={badgeClass}>
              <FileText className="size-3 shrink-0" />
              <span className="truncate">{name}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Документы версии">
        {dataset.filenames.slice(0, visibleCount).map((name) => (
          <button
            key={name}
            type="button"
            title={`Посмотреть ${name}`}
            className={`${badgeClass} hover:bg-muted focus-visible:ring-ring focus-visible:ring-2`}
            onClick={(event) => {
              openerRef.current = event.currentTarget
              showFile(name)
            }}
          >
            <FileText className="size-3 shrink-0" />
            <span className="truncate">{name}</span>
          </button>
        ))}
      </div>
      {visibleCount < dataset.filenames.length && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={(event) => {
            openerRef.current = event.currentTarget
            setFilename(null)
            setOpen(true)
          }}
        >
          <Files className="size-4" />
          Все файлы ({dataset.filenames.length})<ChevronRight className="size-4" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[85dvh] min-w-0 flex-col sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus()
          }}
        >
          <DialogHeader className="min-w-0 pr-6 text-left">
            <DialogTitle>Файлы датасета</DialogTitle>
            <DialogDescription className="[overflow-wrap:anywhere]">
              {dataset.name} · v{dataset.version} · Файлов: {dataset.filenames.length}
            </DialogDescription>
          </DialogHeader>
          {filename === null ? (
            <div className="min-h-0 overflow-y-auto rounded-lg border">
              {dataset.filenames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-3 border-b p-3 text-left text-sm last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset"
                  onClick={() => setFilename(name)}
                >
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{name}</span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFilename(null)}>
                  <ArrowLeft className="size-4" />
                  Все файлы
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloading}
                  onClick={async () => {
                    setDownloading(true)
                    const result = await downloadSnapshotFile(dataset, filename)
                    setDownloading(false)
                    if (!result.success) toast.error(result.error)
                  }}
                >
                  {downloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Скачать
                </Button>
              </div>
              <h3 className="text-sm font-medium [overflow-wrap:anywhere]">{filename}</h3>
              <FilePreview key={filename} dataset={dataset} filename={filename} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

interface UploadAreaProps {
  isDragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onBrowse: () => void
}

export function UploadArea({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
}: UploadAreaProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "rounded-2xl border-2 border-dashed p-8 mb-6 text-center transition-all",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-muted-foreground/40"
      )}
      role="region"
      aria-label="File upload area"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onBrowse()
        }
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports .md and .txt files
          </p>
        </div>
        <Button
          variant="outline"
          className="mt-2 bg-transparent"
          onClick={onBrowse}
        >
          Select files
        </Button>
      </div>
    </div>
  )
}

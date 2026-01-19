"use client"

import { FileText } from "lucide-react"
import type { Source } from "@/lib/types"

interface SourceBadgeProps {
  source: Source
  onClick: () => void
}

export function SourceBadge({ source, onClick }: SourceBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm transition-colors cursor-pointer group active:scale-95"
    >
      <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      <span className="truncate max-w-[100px] sm:max-w-[150px] text-foreground/80 group-hover:text-foreground transition-colors">
        {source.title}
      </span>
      <span className="text-xs text-muted-foreground">
        {Math.round(source.relevance * 100)}%
      </span>
    </button>
  )
}

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
      className="bg-muted/50 hover:bg-muted group inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors active:scale-95 sm:gap-2 sm:px-3 sm:py-1.5"
    >
      <FileText className="text-muted-foreground group-hover:text-foreground h-3 w-3 shrink-0 transition-colors sm:h-3.5 sm:w-3.5" />
      <span className="text-foreground/80 group-hover:text-foreground max-w-[100px] truncate transition-colors sm:max-w-[150px]">
        {source.title}
      </span>
      <span className="text-muted-foreground text-xs">{Math.round(source.relevance * 100)}%</span>
    </button>
  )
}

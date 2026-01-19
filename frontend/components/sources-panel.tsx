"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  X,
  FileText,
  Search,
  ExternalLink,
  File,
} from "lucide-react"
import type { Source } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SourcesPanelProps {
  sources: Source[]
  onClose: () => void
}

export function SourcesPanel({ sources, onClose }: SourcesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredSources = sources.filter(
    (source) =>
      source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex w-80 flex-col border-l border-border/50 bg-background h-full overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="font-semibold text-foreground">Sources</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30 border-0 h-9 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        {/* Retrieved Sources */}
        <ScrollArea className="flex-1 px-4 pb-4">
          {filteredSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? "No matching sources" : "No sources yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                {searchQuery ? "Try a different search term" : "Ask a question to see relevant documents"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                {filteredSources.length} document{filteredSources.length !== 1 ? "s" : ""} found
              </p>
              {filteredSources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

interface SourceCardProps {
  source: Source
}

function SourceCard({ source }: SourceCardProps) {
  const getFileExtension = (title: string) => {
    if (title.endsWith(".md")) return "MD"
    if (title.endsWith(".txt")) return "TXT"
    return "DOC"
  }

  const extension = getFileExtension(source.title)
  const Icon = source.title.endsWith(".md") ? FileText : File

  const extensionColors: Record<string, string> = {
    MD: "bg-blue-500/10 text-blue-500",
    TXT: "bg-emerald-500/10 text-emerald-500",
    DOC: "bg-amber-500/10 text-amber-500",
  }

  return (
    <div className="group rounded-xl p-3 hover:bg-muted/50 transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", extensionColors[extension] || extensionColors.DOC)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-foreground truncate flex-1">{source.title}</h3>
            <span className="text-xs text-muted-foreground shrink-0">
              {Math.round(source.relevance * 100)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{source.content}</p>
        </div>
      </div>
      <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3 w-3" />
          Open
        </Button>
      </div>
    </div>
  )
}

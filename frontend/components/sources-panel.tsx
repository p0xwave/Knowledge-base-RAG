"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  X,
  FileText,
  Search,
  ExternalLink,
  File,
} from "lucide-react"
import type { Source } from "@/app/page"
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
    <div className="flex w-80 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-card/50">
        <h2 className="font-semibold text-foreground">Sources</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search in sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>
        </div>

        {/* Retrieved Sources */}
        <ScrollArea className="flex-1 px-4 pb-4">
          {filteredSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? "No matching sources" : "No sources retrieved yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : "Ask a question to see relevant sources"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-2">
                Found {filteredSources.length} relevant document{filteredSources.length !== 1 ? "s" : ""}
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
  const getFileIcon = (type: string) => {
    switch (type) {
      case "document":
        return FileText
      default:
        return File
    }
  }
  
  const Icon = getFileIcon(source.type)

  const getFileExtension = (title: string) => {
    if (title.endsWith(".md")) return "MD"
    if (title.endsWith(".txt")) return "TXT"
    return "DOC"
  }

  const extension = getFileExtension(source.title)

  const extensionColors: Record<string, string> = {
    MD: "bg-chart-1/10 text-chart-1",
    TXT: "bg-chart-3/10 text-chart-3",
    DOC: "bg-chart-5/10 text-chart-5",
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", extensionColors[extension] || extensionColors.DOC)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm text-foreground truncate">{source.title}</h3>
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
              {Math.round(source.relevance * 100)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{extension} Document</p>
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{source.content}</p>
        </div>
      </div>
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/50">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary">
          <ExternalLink className="h-3 w-3" />
          View Full
        </Button>
      </div>
    </div>
  )
}

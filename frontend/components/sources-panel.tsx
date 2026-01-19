"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/empty-state"
import { useSearch } from "@/hooks/useSearch"
import { X, FileText, Search, ExternalLink, File } from "lucide-react"
import type { Source } from "@/lib/types"
import { FILE_EXTENSION_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface SourcesPanelProps {
  sources: Source[]
  onClose: () => void
}

export function SourcesPanel({ sources, onClose }: SourcesPanelProps) {
  const { searchQuery, setSearchQuery, filteredItems, resultCount } = useSearch(
    sources,
    (source, query) =>
      source.title.toLowerCase().includes(query) || source.content.toLowerCase().includes(query)
  )

  return (
    <div className="border-border/50 bg-background flex h-full w-80 shrink-0 flex-col overflow-hidden border-l">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-foreground font-semibold">Sources</h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col">
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/30 focus-visible:ring-primary/30 h-9 border-0 pl-9 focus-visible:ring-1"
            />
          </div>
        </div>

        {/* Retrieved Sources */}
        <ScrollArea className="flex-1 px-4 pb-4">
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={searchQuery ? "No matching sources" : "No sources yet"}
              description={
                searchQuery
                  ? "Try a different search term"
                  : "Ask a question to see relevant documents"
              }
              className="py-12"
            />
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground mb-3 text-xs">
                {resultCount} document{resultCount !== 1 ? "s" : ""} found
              </p>
              {filteredItems.map((source) => (
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
  const colorClass = FILE_EXTENSION_COLORS[extension] || FILE_EXTENSION_COLORS.DOC

  return (
    <div className="group hover:bg-muted/50 cursor-pointer rounded-xl p-3 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", colorClass)}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground flex-1 truncate text-sm font-medium">{source.title}</h3>
            <span className="text-muted-foreground shrink-0 text-xs">
              {Math.round(source.relevance * 100)}%
            </span>
          </div>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
            {source.content}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1.5 text-xs"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </Button>
      </div>
    </div>
  )
}

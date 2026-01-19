"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import {
  FileText,
  Database,
  Globe,
  Copy,
  ExternalLink,
  Calendar,
  User,
  Hash,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react"
import type { Source } from "@/lib/types"
import { extendedSourceData } from "@/lib/mock-data"
import { SOURCE_TYPE_COLORS, SOURCE_TYPE_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface SourceDetailModalProps {
  source: Source | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SOURCE_TYPE_ICONS = {
  document: FileText,
  database: Database,
  api: Globe,
}

export function SourceDetailModal({ source, open, onOpenChange }: SourceDetailModalProps) {
  const { copied, copy } = useCopyFeedback()

  if (!source) return null

  const extendedData = extendedSourceData[source.id] || {
    author: "Unknown",
    createdAt: new Date().toISOString().split("T")[0],
    updatedAt: new Date().toISOString().split("T")[0],
    path: "/unknown",
    tags: [],
    fullContent: source.content,
    relatedSources: [],
    metadata: [],
  }

  const Icon = SOURCE_TYPE_ICONS[source.type]
  const typeLabel = SOURCE_TYPE_LABELS[source.type]
  const colorClass = SOURCE_TYPE_COLORS[source.type]

  const handleCopy = () => copy(extendedData.fullContent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border bg-card/50 border-b p-6 pb-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
                colorClass
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-foreground text-lg font-semibold">
                    {source.title}
                  </DialogTitle>
                  <p className="text-muted-foreground mt-0.5 text-sm">{typeLabel} Source</p>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 shrink-0">
                  {Math.round(source.relevance * 100)}% Relevance
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-180px)] flex-1">
          <div className="space-y-6 p-6">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">Author:</span>
                <span className="text-foreground font-medium">{extendedData.author}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">Updated:</span>
                <span className="text-foreground font-medium">{extendedData.updatedAt}</span>
              </div>
              <div className="col-span-2 flex items-center gap-2 text-sm">
                <Hash className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">Path:</span>
                <code className="bg-muted text-foreground truncate rounded px-2 py-0.5 font-mono text-xs">
                  {extendedData.path}
                </code>
              </div>
            </div>

            {/* Tags */}
            {extendedData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {extendedData.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-muted/50 hover:bg-muted text-xs"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <Separator />

            {/* Content */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <Layers className="text-muted-foreground h-4 w-4" />
                  Retrieved Content
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="text-chart-5 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="border-border bg-muted/30 rounded-xl border p-4">
                <pre className="text-foreground font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {extendedData.fullContent}
                </pre>
              </div>
            </div>

            {/* Metadata */}
            {extendedData.metadata.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Clock className="text-muted-foreground h-4 w-4" />
                    Metadata
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {extendedData.metadata.map((item) => (
                      <div key={item.label} className="border-border bg-card rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs">{item.label}</p>
                        <p className="text-foreground mt-0.5 text-sm font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Related Sources */}
            {extendedData.relatedSources.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-foreground mb-3 text-sm font-semibold">Related Sources</h3>
                  <div className="space-y-2">
                    {extendedData.relatedSources.map((related) => {
                      const RelatedIcon = SOURCE_TYPE_ICONS[related.type]
                      const relatedColorClass = SOURCE_TYPE_COLORS[related.type]
                      return (
                        <button
                          key={related.id}
                          className="border-border bg-card hover:bg-muted/50 hover:border-primary/20 group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all"
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              relatedColorClass
                            )}
                          >
                            <RelatedIcon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-foreground flex-1 text-sm font-medium">
                            {related.title}
                          </span>
                          <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-colors" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-border bg-card/50 flex items-center justify-between border-t p-4">
          <p className="text-muted-foreground text-xs">
            Source retrieved from your private database
          </p>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <ExternalLink className="h-3.5 w-3.5" />
            Open Original
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

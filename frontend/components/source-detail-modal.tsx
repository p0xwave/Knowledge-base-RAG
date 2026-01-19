"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
import { COPY_FEEDBACK_TIMEOUT } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface SourceDetailModalProps {
  source: Source | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SourceDetailModal({ source, open, onOpenChange }: SourceDetailModalProps) {
  const [copied, setCopied] = useState(false)

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

  const icons = {
    document: FileText,
    database: Database,
    api: Globe,
  }
  const Icon = icons[source.type]

  const typeLabels = {
    document: "Document",
    database: "Database",
    api: "API",
  }

  const colors = {
    document: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    database: "bg-chart-5/10 text-chart-5 border-chart-5/20",
    api: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(extendedData.fullContent)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card/50">
          <div className="flex items-start gap-4">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border", colors[source.type])}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    {source.title}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {typeLabels[source.type]} Source
                  </p>
                </div>
                <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                  {Math.round(source.relevance * 100)}% Relevance
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(85vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Author:</span>
                <span className="text-foreground font-medium">{extendedData.author}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Updated:</span>
                <span className="text-foreground font-medium">{extendedData.updatedAt}</span>
              </div>
              <div className="flex items-center gap-2 text-sm col-span-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Path:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-foreground truncate">
                  {extendedData.path}
                </code>
              </div>
            </div>

            {/* Tags */}
            {extendedData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {extendedData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs bg-muted/50 hover:bg-muted">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <Separator />

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Retrieved Content
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs gap-1.5"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-chart-5" />
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
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {extendedData.fullContent}
                </pre>
              </div>
            </div>

            {/* Metadata */}
            {extendedData.metadata.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Metadata
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {extendedData.metadata.map((item) => (
                      <div key={item.label} className="rounded-lg border border-border bg-card p-3">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{item.value}</p>
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
                  <h3 className="text-sm font-semibold text-foreground mb-3">Related Sources</h3>
                  <div className="space-y-2">
                    {extendedData.relatedSources.map((related) => {
                      const RelatedIcon = icons[related.type]
                      return (
                        <button
                          key={related.id}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/20 transition-all text-left group"
                        >
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", colors[related.type])}>
                            <RelatedIcon className="h-3.5 w-3.5" />
                          </div>
                          <span className="flex-1 text-sm font-medium text-foreground">{related.title}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
        <div className="border-t border-border p-4 bg-card/50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
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

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
import type { Source } from "@/app/page"
import { cn } from "@/lib/utils"

interface SourceDetailModalProps {
  source: Source | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Extended source data for demo
const extendedSourceData: Record<string, {
  author: string
  createdAt: string
  updatedAt: string
  path: string
  tags: string[]
  fullContent: string
  relatedSources: { id: string; title: string; type: "document" | "database" | "api" }[]
  metadata: { label: string; value: string }[]
}> = {
  "1": {
    author: "Finance Team",
    createdAt: "2024-09-15",
    updatedAt: "2024-10-01",
    path: "/reports/finance/q3-2024.pdf",
    tags: ["finance", "quarterly", "revenue", "2024"],
    fullContent: `Revenue increased by 23% compared to Q2, driven primarily by enterprise client acquisitions. The quarterly performance exceeded expectations set at the beginning of the fiscal year.

Key Performance Indicators:
• Total Revenue: $8.2M (up from $6.7M in Q2)
• Gross Margin: 72.4% (improvement of 2.1 percentage points)
• Operating Expenses: $3.1M (controlled growth of 8%)
• Net Income: $2.8M (34% margin)

Enterprise Segment Analysis:
The enterprise segment showed exceptional growth with 47 new contracts signed. Average contract value increased by 18% to $45,000 annually. Customer retention in this segment remained strong at 96%.

Regional Performance:
• North America: +28% YoY
• Europe: +19% YoY  
• Asia Pacific: +34% YoY

The strong performance in Asia Pacific is attributed to our expanded sales presence in Singapore and Australia.`,
    relatedSources: [
      { id: "2", title: "Customer Database", type: "database" },
      { id: "3", title: "Sales API Response", type: "api" },
    ],
    metadata: [
      { label: "Document Type", value: "PDF Report" },
      { label: "Pages", value: "24" },
      { label: "Department", value: "Finance" },
      { label: "Confidentiality", value: "Internal" },
    ],
  },
  "2": {
    author: "System",
    createdAt: "2024-01-01",
    updatedAt: "2024-10-15",
    path: "postgres://db.internal/customers",
    tags: ["customers", "crm", "enterprise", "analytics"],
    fullContent: `Customer Database Query Results:

Total Active Customers: 12,450
├── Enterprise Tier: 342 accounts
├── Premium Tier: 2,108 accounts
└── Standard Tier: 10,000 accounts

Customer Growth Metrics:
• New customers (Q3): 1,247
• Churned customers (Q3): 89
• Net customer growth: +1,158
• Monthly growth rate: 3.2%

Enterprise Customer Details:
Average revenue per enterprise account: $45,000/year
Enterprise segment contribution: 62% of total revenue
Top industries: Technology (34%), Healthcare (22%), Finance (18%)

Geographic Distribution:
• United States: 58%
• United Kingdom: 12%
• Germany: 8%
• Canada: 7%
• Other: 15%`,
    relatedSources: [
      { id: "1", title: "Q3 Financial Report", type: "document" },
      { id: "3", title: "Sales API Response", type: "api" },
    ],
    metadata: [
      { label: "Database", value: "PostgreSQL" },
      { label: "Records", value: "12,450" },
      { label: "Last Sync", value: "5 min ago" },
      { label: "Schema Version", value: "v2.4" },
    ],
  },
  "3": {
    author: "Sales System",
    createdAt: "2024-10-15",
    updatedAt: "2024-10-15",
    path: "api.internal/v2/sales/metrics",
    tags: ["sales", "mrr", "api", "real-time"],
    fullContent: `Sales API Response - Real-time Metrics

Monthly Recurring Revenue (MRR): $2.4M
Annual Recurring Revenue (ARR): $28.8M
Year-over-Year Growth: 47%

Pipeline Status:
• Qualified Leads: 423
• Opportunities: 187
• Proposals Sent: 89
• Closed Won (MTD): 34
• Closed Lost (MTD): 12

Sales Team Performance:
• Average deal size: $12,400
• Sales cycle length: 32 days (down from 41 days)
• Win rate: 74%
• Quota attainment: 112%

Revenue by Product:
• Core Platform: 68%
• Analytics Add-on: 18%
• Enterprise Features: 14%

Forecast (Q4):
Expected revenue: $9.1M
Confidence level: High (based on pipeline coverage of 3.2x)`,
    relatedSources: [
      { id: "1", title: "Q3 Financial Report", type: "document" },
      { id: "2", title: "Customer Database", type: "database" },
    ],
    metadata: [
      { label: "API Version", value: "v2.0" },
      { label: "Response Time", value: "124ms" },
      { label: "Cache Status", value: "Fresh" },
      { label: "Rate Limit", value: "1000/min" },
    ],
  },
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
    setTimeout(() => setCopied(false), 2000)
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

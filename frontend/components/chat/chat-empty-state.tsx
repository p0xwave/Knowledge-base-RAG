"use client"

import { Database, FileText, Globe, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const suggestions = [
  { icon: Database, text: "What are the key metrics from Q3?", color: "bg-chart-1/10 text-chart-1" },
  { icon: FileText, text: "Summarize the latest sales report", color: "bg-chart-5/10 text-chart-5" },
  { icon: Globe, text: "Compare customer growth across regions", color: "bg-chart-3/10 text-chart-3" },
]

interface ChatEmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void
}

export function ChatEmptyState({ onSuggestionClick }: ChatEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center max-w-xl mx-auto py-8 sm:py-16 px-2">
      <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4 sm:mb-6 shadow-sm">
        <Sparkles className="h-7 w-7 sm:h-9 sm:w-9 text-primary" />
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2 text-balance">
        Query Your Private Database
      </h2>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-md leading-relaxed">
        Ask questions about your data and get AI-powered insights with source citations.
      </p>
      <div className="grid gap-2 sm:gap-3 w-full max-w-md">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick?.(suggestion.text)}
            className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 text-left transition-all hover:shadow-md hover:border-primary/20 active:scale-[0.98] sm:hover:-translate-y-0.5"
          >
            <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg shrink-0", suggestion.color)}>
              <suggestion.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span className="text-sm text-foreground">{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

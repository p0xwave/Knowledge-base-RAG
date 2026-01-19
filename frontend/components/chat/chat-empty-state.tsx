"use client"

import { Database, FileText, Globe, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const suggestions = [
  {
    icon: Database,
    text: "What are the key metrics from Q3?",
    color: "bg-chart-1/10 text-chart-1",
  },
  {
    icon: FileText,
    text: "Summarize the latest sales report",
    color: "bg-chart-5/10 text-chart-5",
  },
  {
    icon: Globe,
    text: "Compare customer growth across regions",
    color: "bg-chart-3/10 text-chart-3",
  },
]

interface ChatEmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void
}

export function ChatEmptyState({ onSuggestionClick }: ChatEmptyStateProps) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-2 py-8 text-center sm:py-16">
      <div className="from-primary/20 to-primary/5 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br shadow-sm sm:mb-6 sm:h-20 sm:w-20 sm:rounded-3xl">
        <Sparkles className="text-primary h-7 w-7 sm:h-9 sm:w-9" />
      </div>
      <h2 className="text-foreground mb-2 text-xl font-semibold text-balance sm:text-2xl">
        Query Your Private Database
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md text-sm leading-relaxed sm:mb-8 sm:text-base">
        Ask questions about your data and get AI-powered insights with source citations.
      </p>
      <div className="grid w-full max-w-md gap-2 sm:gap-3">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick?.(suggestion.text)}
            className="border-border bg-card hover:border-primary/20 flex items-center gap-2 rounded-xl border p-3 text-left transition-all hover:shadow-md active:scale-[0.98] sm:gap-3 sm:p-4 sm:hover:-translate-y-0.5"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10",
                suggestion.color
              )}
            >
              <suggestion.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span className="text-foreground text-sm">{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

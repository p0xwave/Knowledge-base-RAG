"use client"

import { Button } from "@/components/ui/button"
import { TooltipButton } from "@/components/tooltip-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { PanelLeftOpen, FileText } from "lucide-react"
import type { Conversation } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ChatHeaderProps {
  conversation: Conversation | null
  showSources: boolean
  onToggleSources: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function ChatHeader({
  conversation,
  showSources,
  onToggleSources,
  sidebarOpen,
  onToggleSidebar,
}: ChatHeaderProps) {
  return (
    <header
      className="flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-3"
      role="banner"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="font-semibold text-foreground text-sm sm:text-base truncate">
            {conversation?.title || "New Conversation"}
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-chart-5 shrink-0"></span>
            <span className="truncate">3 documents loaded</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <ThemeToggle />
        <TooltipButton
          tooltip="Toggle sources panel"
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 sm:gap-2 shadow-sm",
            showSources && "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
          )}
          onClick={onToggleSources}
          aria-label={showSources ? "Hide sources panel" : "Show sources panel"}
          aria-pressed={showSources}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sources</span>
        </TooltipButton>
      </div>
    </header>
  )
}

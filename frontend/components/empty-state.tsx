"use client"

import type React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
  iconClassName?: string
}

/**
 * Reusable empty state component with icon, title, and description
 * Used across: documents/page, sources-panel, chat-main
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", className)}>
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-3",
          iconClassName
        )}
      >
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

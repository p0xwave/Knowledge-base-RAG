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
          "bg-muted/50 mb-3 flex h-12 w-12 items-center justify-center rounded-full",
          iconClassName
        )}
      >
        <Icon className="text-muted-foreground h-5 w-5" />
      </div>
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-[200px] text-xs">{description}</p>
      )}
      {children}
    </div>
  )
}

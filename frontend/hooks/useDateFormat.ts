"use client"

import { useCallback } from "react"
import { ONE_DAY_MS, TWO_DAYS_MS, THREE_DAYS_MS } from "@/lib/constants"

/**
 * Hook for formatting dates in a human-readable way
 * Used across: documents/page, chat-sidebar
 */
export function useDateFormat() {
  const formatRelativeDate = useCallback((date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / ONE_DAY_MS)

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }, [])

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }, [])

  const formatGroupLabel = useCallback((date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < ONE_DAY_MS) return "Today"
    if (diff < TWO_DAYS_MS) return "Yesterday"
    if (diff < THREE_DAYS_MS) return "Previous 2 days"
    return "Older"
  }, [])

  return {
    formatRelativeDate,
    formatFileSize,
    formatGroupLabel,
  }
}

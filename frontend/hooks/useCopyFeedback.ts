"use client"

import { useState, useCallback } from "react"
import { COPY_FEEDBACK_TIMEOUT } from "@/lib/constants"

/**
 * Hook for copy-to-clipboard functionality with visual feedback
 * Used across: chat-main, source-detail-modal, code-block
 */
export function useCopyFeedback(timeout = COPY_FEEDBACK_TIMEOUT) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), timeout)
      return true
    } catch (error) {
      console.error("Failed to copy:", error)
      return false
    }
  }, [timeout])

  const reset = useCallback(() => {
    setCopied(false)
  }, [])

  return { copied, copy, reset }
}

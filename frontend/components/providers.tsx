"use client"

import type React from "react"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/sonner"

interface ProvidersProps {
  children: React.ReactNode
}

/**
 * Client-side providers wrapper that includes:
 * - Error Boundary for catching React errors
 * - Toast notifications (Sonner)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      {children}
      <Toaster position="top-right" />
    </ErrorBoundary>
  )
}

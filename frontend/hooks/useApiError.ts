"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

export interface ApiErrorOptions {
  showToast?: boolean
  toastDuration?: number
  retryCount?: number
  retryDelay?: number
  onError?: (error: Error) => void
}

export interface ApiErrorState {
  error: Error | null
  isError: boolean
  errorMessage: string | null
}

const DEFAULT_OPTIONS: ApiErrorOptions = {
  showToast: true,
  toastDuration: 5000,
  retryCount: 0,
  retryDelay: 1000,
}

// Error messages mapping for common API errors
const ERROR_MESSAGES: Record<string, string> = {
  NetworkError: "Network error. Please check your connection.",
  TimeoutError: "Request timed out. Please try again.",
  400: "Invalid request. Please check your input.",
  401: "Authentication required. Please log in.",
  403: "Access denied. You don't have permission.",
  404: "Resource not found.",
  429: "Too many requests. Please wait a moment.",
  500: "Server error. Please try again later.",
  502: "Service temporarily unavailable.",
  503: "Service maintenance in progress.",
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for status code in error message
    const statusMatch = error.message.match(/\b(\d{3})\b/)
    if (statusMatch) {
      const code = statusMatch[1]
      if (ERROR_MESSAGES[code]) {
        return ERROR_MESSAGES[code]
      }
    }

    // Check for network errors
    if (error.message.toLowerCase().includes("network")) {
      return ERROR_MESSAGES.NetworkError
    }

    if (error.message.toLowerCase().includes("timeout")) {
      return ERROR_MESSAGES.TimeoutError
    }

    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return "An unexpected error occurred"
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useApiError(defaultOptions?: ApiErrorOptions) {
  const [state, setState] = useState<ApiErrorState>({
    error: null,
    isError: false,
    errorMessage: null,
  })

  const clearError = useCallback(() => {
    setState({
      error: null,
      isError: false,
      errorMessage: null,
    })
  }, [])

  const handleError = useCallback(
    (error: unknown, options?: ApiErrorOptions) => {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...defaultOptions, ...options }
      const errorObj = error instanceof Error ? error : new Error(String(error))
      const message = getErrorMessage(error)

      setState({
        error: errorObj,
        isError: true,
        errorMessage: message,
      })

      if (mergedOptions.showToast) {
        toast.error(message, {
          duration: mergedOptions.toastDuration,
        })
      }

      mergedOptions.onError?.(errorObj)

      return { error: errorObj, message }
    },
    [defaultOptions]
  )

  const executeWithRetry = useCallback(
    async <T>(
      fn: () => Promise<T>,
      options?: ApiErrorOptions
    ): Promise<{ data: T | null; error: Error | null }> => {
      const mergedOptions = { ...DEFAULT_OPTIONS, ...defaultOptions, ...options }
      let lastError: Error | null = null

      for (let attempt = 0; attempt <= (mergedOptions.retryCount || 0); attempt++) {
        try {
          clearError()
          const data = await fn()
          return { data, error: null }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          // Don't retry on 4xx client errors
          const is4xxError = lastError.message.match(/\b4\d{2}\b/)
          if (is4xxError) {
            break
          }

          // If not last attempt, wait before retry
          if (attempt < (mergedOptions.retryCount || 0)) {
            await delay(mergedOptions.retryDelay || 1000)
          }
        }
      }

      handleError(lastError, options)
      return { data: null, error: lastError }
    },
    [defaultOptions, clearError, handleError]
  )

  const wrapAsync = useCallback(
    <T>(fn: () => Promise<T>, options?: ApiErrorOptions): Promise<T | null> => {
      return executeWithRetry(fn, options).then((result) => result.data)
    },
    [executeWithRetry]
  )

  return {
    ...state,
    clearError,
    handleError,
    executeWithRetry,
    wrapAsync,
  }
}

// Type-safe error boundary hook for components
export function useErrorToast() {
  const showError = useCallback((message: string, options?: { duration?: number }) => {
    toast.error(message, { duration: options?.duration ?? 5000 })
  }, [])

  const showSuccess = useCallback((message: string, options?: { duration?: number }) => {
    toast.success(message, { duration: options?.duration ?? 3000 })
  }, [])

  const showWarning = useCallback((message: string, options?: { duration?: number }) => {
    toast.warning(message, { duration: options?.duration ?? 4000 })
  }, [])

  const showInfo = useCallback((message: string, options?: { duration?: number }) => {
    toast.info(message, { duration: options?.duration ?? 3000 })
  }, [])

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
  }
}

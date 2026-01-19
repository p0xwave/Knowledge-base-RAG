// Base API client with error handling and request utilities

import type { ApiResult } from "@/types/api"

// ============================================
// Configuration
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api"
const DEFAULT_TIMEOUT = 30000

export interface RequestConfig extends RequestInit {
  timeout?: number
  params?: Record<string, string | number | boolean | undefined>
}

// ============================================
// Custom error class
// ============================================

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public response?: unknown
  ) {
    super(message)
    this.name = "ApiRequestError"
  }
}

// ============================================
// Request utilities
// ============================================

function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(
    endpoint,
    API_BASE_URL.startsWith("http") ? API_BASE_URL : window.location.origin
  )

  if (!endpoint.startsWith("http")) {
    url.pathname = `${API_BASE_URL}${endpoint}`.replace(/\/+/g, "/")
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })
  }

  return url.toString()
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    let errorCode = `HTTP_${response.status}`

    if (contentType?.includes("application/json")) {
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
        errorCode = errorData.code || errorCode
      } catch {
        // Ignore JSON parse errors for error responses
      }
    }

    throw new ApiRequestError(errorMessage, errorCode, response.status)
  }

  if (contentType?.includes("application/json")) {
    return response.json()
  }

  return response.text() as unknown as T
}

// ============================================
// Main request function
// ============================================

async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, params, ...fetchConfig } = config

  const url = buildUrl(endpoint, params)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchConfig,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchConfig.headers,
      },
    })

    return handleResponse<T>(response)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new ApiRequestError("Request timeout", "TIMEOUT", undefined)
      }
      throw new ApiRequestError(error.message, "NETWORK_ERROR", undefined)
    }

    throw new ApiRequestError("Unknown error", "UNKNOWN", undefined)
  } finally {
    clearTimeout(timeoutId)
  }
}

// ============================================
// HTTP method helpers
// ============================================

export const api = {
  get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    config?: RequestConfig
  ): Promise<T> {
    return request<T>(endpoint, { ...config, method: "GET", params })
  },

  post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(endpoint, {
      ...config,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(endpoint, {
      ...config,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>(endpoint, {
      ...config,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return request<T>(endpoint, { ...config, method: "DELETE" })
  },
}

// ============================================
// Safe request wrapper (returns ApiResult)
// ============================================

export async function safeRequest<T>(requestFn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    const data = await requestFn()
    return { data, success: true }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return {
        error: error.message,
        code: error.code,
        success: false,
      }
    }

    return {
      error: error instanceof Error ? error.message : "Unknown error",
      code: "UNKNOWN",
      success: false,
    }
  }
}

// ============================================
// Streaming support
// ============================================

export interface StreamCallbacks<T> {
  onChunk: (chunk: T) => void
  onError?: (error: ApiRequestError) => void
  onComplete?: () => void
}

export async function streamRequest<T>(
  endpoint: string,
  data: unknown,
  callbacks: StreamCallbacks<T>
): Promise<void> {
  const url = buildUrl(endpoint)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new ApiRequestError(
        `HTTP ${response.status}`,
        `HTTP_${response.status}`,
        response.status
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new ApiRequestError("No response body", "NO_BODY")
    }

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        callbacks.onComplete?.()
        break
      }

      const text = decoder.decode(value, { stream: true })
      const lines = text.split("\n").filter((line) => line.trim())

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6)
          if (jsonStr === "[DONE]") {
            callbacks.onComplete?.()
            return
          }

          try {
            const chunk = JSON.parse(jsonStr) as T
            callbacks.onChunk(chunk)
          } catch {
            // Ignore JSON parse errors for malformed chunks
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      callbacks.onError?.(error)
    } else {
      callbacks.onError?.(
        new ApiRequestError(
          error instanceof Error ? error.message : "Unknown error",
          "STREAM_ERROR"
        )
      )
    }
  }
}

// ============================================
// File upload support
// ============================================

export async function uploadFile<T>(
  endpoint: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<T> {
  const url = buildUrl(endpoint)
  const formData = new FormData()
  formData.append("file", file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress((event.loaded / event.total) * 100)
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new ApiRequestError("Invalid response", "PARSE_ERROR"))
        }
      } else {
        reject(new ApiRequestError(`HTTP ${xhr.status}`, `HTTP_${xhr.status}`, xhr.status))
      }
    })

    xhr.addEventListener("error", () => {
      reject(new ApiRequestError("Upload failed", "UPLOAD_ERROR"))
    })

    xhr.addEventListener("abort", () => {
      reject(new ApiRequestError("Upload aborted", "ABORT"))
    })

    xhr.open("POST", url)
    xhr.send(formData)
  })
}

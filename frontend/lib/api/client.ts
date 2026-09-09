// Base API client with error handling and request utilities

import type { ApiResult } from "@/types/api"
import { getAuthHeader } from "@/lib/auth/token"

// Re-export ApiResult for convenience
export type { ApiResult }

// ============================================
// Configuration
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""
const DEFAULT_TIMEOUT = 600000 // 10 minutes for RAG requests

export interface RequestConfig extends RequestInit {
  timeout?: number
  responseType?: "blob"
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
  // Если endpoint уже полный URL, используем его
  if (endpoint.startsWith("http")) {
    const url = new URL(endpoint)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }
    return url.toString()
  }

  // Строим URL из base + endpoint
  let baseUrl: string
  if (API_BASE_URL.startsWith("http")) {
    // API_BASE_URL уже полный URL
    baseUrl = API_BASE_URL
  } else {
    // API_BASE_URL относительный путь
    baseUrl = window.location.origin + API_BASE_URL
  }

  // Убираем trailing slash из base и leading slash из endpoint, затем соединяем
  const cleanBase = baseUrl.replace(/\/$/, "")
  const cleanEndpoint = endpoint.replace(/^\//, "")
  const fullUrl = `${cleanBase}/${cleanEndpoint}`

  const url = new URL(fullUrl)

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
        errorMessage =
          (typeof errorData.detail === "string" ? errorData.detail : undefined) ||
          (Array.isArray(errorData.detail)
            ? errorData.detail.map((item: { msg: string }) => item.msg).join("; ")
            : undefined) ||
          errorData.error ||
          errorData.message ||
          errorMessage
        errorCode = errorData.code || errorCode
      } catch {
        // Ignore JSON parse errors for error responses
      }
    }

    // Handle 401 Unauthorized - clear auth and redirect to login
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        const { clearAuthData } = await import("@/lib/auth/token")
        clearAuthData()

        // Redirect to login page
        window.location.href = "/login"
      }
    }

    throw new ApiRequestError(errorMessage, errorCode, response.status)
  }

  // Handle 204 No Content responses
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T
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
  const { timeout = DEFAULT_TIMEOUT, params, responseType, ...fetchConfig } = config

  const url = buildUrl(endpoint, params)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Build headers with authentication
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchConfig.headers as Record<string, string>),
  }

  if (fetchConfig.body instanceof FormData) delete headers["Content-Type"]

  // Add JWT token if available
  const authHeader = getAuthHeader()
  if (authHeader) {
    headers["Authorization"] = authHeader
  }

  try {
    const response = await fetch(url, {
      ...fetchConfig,
      signal: controller.signal,
      headers,
    })

    if (response.ok && responseType === "blob") return (await response.blob()) as T
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
  upload<T>(endpoint: string, data: FormData): Promise<T> {
    return request<T>(endpoint, { method: "POST", body: data })
  },

  download(endpoint: string): Promise<Blob> {
    return request<Blob>(endpoint, { responseType: "blob" })
  },

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
  callbacks: StreamCallbacks<T>,
  signal?: AbortSignal
): Promise<void> {
  const url = buildUrl(endpoint)

  // Build headers with authentication
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const authHeader = getAuthHeader()
  if (authHeader) {
    headers["Authorization"] = authHeader
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      signal,
    })

    if (!response.ok) {
      // Handle 401 Unauthorized - clear auth and redirect to login
      if (response.status === 401 && typeof window !== "undefined") {
        const { clearAuthData } = await import("@/lib/auth/token")
        clearAuthData()
        window.location.href = "/login"
      }

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
    let buffer = ""

    const processDataLine = (rawLine: string) => {
      const line = rawLine.trim()
      if (!line.startsWith("data:")) {
        return
      }

      const jsonStr = line.slice(5).trimStart()
      if (!jsonStr) {
        return
      }

      if (jsonStr === "[DONE]") {
        callbacks.onComplete?.()
        return "done"
      }

      try {
        const event = JSON.parse(jsonStr)

        // Handle error events from backend
        if (event.type === "error") {
          callbacks.onError?.(
            new ApiRequestError(event.message || "Stream error", "STREAM_ERROR", event.code || 500)
          )
          return "done"
        }

        callbacks.onChunk(event as T)
      } catch {
        // Ignore JSON parse errors for malformed chunks
      }
      return
    }

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim()) {
          for (const rawLine of buffer.split("\n")) {
            const result = processDataLine(rawLine)
            if (result === "done") {
              return
            }
          }
        }
        callbacks.onComplete?.()
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Parse incrementally by single lines as well.
      // Some SSE servers flush one `data:` line at a time, not full `\n\n` blocks.
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const rawLine of lines) {
        const result = processDataLine(rawLine)
        if (result === "done") {
          return
        }
      }
    }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      callbacks.onError?.(error)
    } else if (error instanceof Error && error.name === "AbortError") {
      callbacks.onError?.(new ApiRequestError("The operation was aborted.", "ABORT"))
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

    xhr.addEventListener("load", async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new ApiRequestError("Invalid response", "PARSE_ERROR"))
        }
      } else {
        // Handle 401 Unauthorized - clear auth and redirect to login
        if (xhr.status === 401 && typeof window !== "undefined") {
          const { clearAuthData } = await import("@/lib/auth/token")
          clearAuthData()
          window.location.href = "/login"
        }

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

    // Add JWT token if available
    const authHeader = getAuthHeader()
    if (authHeader) {
      xhr.setRequestHeader("Authorization", authHeader)
    }

    xhr.send(formData)
  })
}

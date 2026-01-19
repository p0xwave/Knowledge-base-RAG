// Document queries (GET requests)

import { api, safeRequest } from "../client"
import type {
  ApiResult,
  DocumentListItem,
  DocumentSearchRequest,
  DocumentSearchResponse,
  PaginatedResponse,
  PaginationParams,
  SourceDetailResponse,
} from "@/types/api"

const ENDPOINTS = {
  list: "/documents",
  single: (id: string) => `/documents/${id}`,
  search: "/documents/search",
  source: (id: string) => `/sources/${id}`,
}

/**
 * Get paginated list of documents
 */
export async function getDocuments(
  params?: PaginationParams
): Promise<ApiResult<PaginatedResponse<DocumentListItem>>> {
  return safeRequest(() => api.get<PaginatedResponse<DocumentListItem>>(ENDPOINTS.list, params))
}

/**
 * Get single document details
 */
export async function getDocument(id: string): Promise<ApiResult<DocumentListItem>> {
  return safeRequest(() => api.get<DocumentListItem>(ENDPOINTS.single(id)))
}

/**
 * Search documents by query
 */
export async function searchDocuments(
  request: DocumentSearchRequest
): Promise<ApiResult<DocumentSearchResponse>> {
  return safeRequest(() =>
    api.get<DocumentSearchResponse>(ENDPOINTS.search, {
      query: request.query,
      limit: request.limit,
    })
  )
}

/**
 * Get source details with full content
 */
export async function getSourceDetails(id: string): Promise<ApiResult<SourceDetailResponse>> {
  return safeRequest(() => api.get<SourceDetailResponse>(ENDPOINTS.source(id)))
}

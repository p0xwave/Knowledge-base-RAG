// Document mutations (POST/PUT/DELETE requests)

import { api, safeRequest, uploadFile } from "../client"
import type { ApiResult, UploadDocumentResponse } from "@/types/api"

const ENDPOINTS = {
  upload: "/documents/upload",
  delete: (id: string) => `/documents/${id}`,
  bulkDelete: "/documents/bulk-delete",
}

/**
 * Upload a document
 */
export async function uploadDocument(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ApiResult<UploadDocumentResponse>> {
  return safeRequest(() => uploadFile<UploadDocumentResponse>(ENDPOINTS.upload, file, onProgress))
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<ApiResult<{ success: boolean }>> {
  return safeRequest(() => api.delete<{ success: boolean }>(ENDPOINTS.delete(id)))
}

/**
 * Bulk delete documents
 */
export async function bulkDeleteDocuments(ids: string[]): Promise<ApiResult<{ deleted: number }>> {
  return safeRequest(() => api.post<{ deleted: number }>(ENDPOINTS.bulkDelete, { ids }))
}

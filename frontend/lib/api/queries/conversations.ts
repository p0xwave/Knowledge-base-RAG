// Conversation queries (GET requests)

import { api, safeRequest } from "../client"
import type {
  ApiResult,
  ConversationListItem,
  ConversationResponse,
  PaginatedResponse,
  PaginationParams,
} from "@/types/api"

const ENDPOINTS = {
  list: "/conversations",
  single: (id: string) => `/conversations/${id}`,
}

/**
 * Get paginated list of conversations
 */
export async function getConversations(
  params?: PaginationParams
): Promise<ApiResult<PaginatedResponse<ConversationListItem>>> {
  return safeRequest(() => api.get<PaginatedResponse<ConversationListItem>>(ENDPOINTS.list, params))
}

/**
 * Get single conversation with messages
 */
export async function getConversation(id: string): Promise<ApiResult<ConversationResponse>> {
  return safeRequest(() => api.get<ConversationResponse>(ENDPOINTS.single(id)))
}

/**
 * Search conversations by title or content
 */
export async function searchConversations(
  query: string,
  params?: PaginationParams
): Promise<ApiResult<PaginatedResponse<ConversationListItem>>> {
  return safeRequest(() =>
    api.get<PaginatedResponse<ConversationListItem>>(ENDPOINTS.list, {
      ...params,
      q: query,
    })
  )
}

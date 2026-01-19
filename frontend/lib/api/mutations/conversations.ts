// Conversation mutations (POST/PUT/DELETE requests)

import { api, safeRequest, streamRequest, type StreamCallbacks } from "../client"
import type {
  ApiResult,
  ConversationResponse,
  CreateConversationRequest,
  UpdateConversationRequest,
  SendMessageRequest,
  SendMessageResponse,
  EditMessageRequest,
  StreamChunk,
} from "@/types/api"

const ENDPOINTS = {
  create: "/conversations",
  update: (id: string) => `/conversations/${id}`,
  delete: (id: string) => `/conversations/${id}`,
  sendMessage: "/messages",
  editMessage: (id: string) => `/messages/${id}`,
  deleteMessage: (id: string) => `/messages/${id}`,
  streamMessage: "/messages/stream",
}

/**
 * Create a new conversation
 */
export async function createConversation(
  request: CreateConversationRequest
): Promise<ApiResult<ConversationResponse>> {
  return safeRequest(() => api.post<ConversationResponse>(ENDPOINTS.create, request))
}

/**
 * Update conversation (e.g., rename)
 */
export async function updateConversation(
  id: string,
  request: UpdateConversationRequest
): Promise<ApiResult<ConversationResponse>> {
  return safeRequest(() => api.put<ConversationResponse>(ENDPOINTS.update(id), request))
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<ApiResult<{ success: boolean }>> {
  return safeRequest(() => api.delete<{ success: boolean }>(ENDPOINTS.delete(id)))
}

/**
 * Send a message (non-streaming)
 */
export async function sendMessage(
  request: SendMessageRequest
): Promise<ApiResult<SendMessageResponse>> {
  return safeRequest(() => api.post<SendMessageResponse>(ENDPOINTS.sendMessage, request))
}

/**
 * Send a message with streaming response
 */
export function sendMessageStream(
  request: SendMessageRequest,
  callbacks: StreamCallbacks<StreamChunk>
): Promise<void> {
  return streamRequest<StreamChunk>(ENDPOINTS.streamMessage, request, callbacks)
}

/**
 * Edit an existing message
 */
export async function editMessage(
  request: EditMessageRequest
): Promise<ApiResult<SendMessageResponse>> {
  return safeRequest(() =>
    api.put<SendMessageResponse>(ENDPOINTS.editMessage(request.messageId), {
      content: request.content,
    })
  )
}

/**
 * Delete a message
 */
export async function deleteMessage(messageId: string): Promise<ApiResult<{ success: boolean }>> {
  return safeRequest(() => api.delete<{ success: boolean }>(ENDPOINTS.deleteMessage(messageId)))
}

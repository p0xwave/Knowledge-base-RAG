// API request/response types and contracts

// ============================================
// Base API types
// ============================================

export interface ApiResponse<T> {
  data: T
  success: true
}

export interface ApiError {
  error: string
  code: string
  success: false
}

export type ApiResult<T> = ApiResponse<T> | ApiError

// Pagination
export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  nextCursor?: string
}

// ============================================
// Chat API
// ============================================

// Send message request
export interface SendMessageRequest {
  conversationId?: string
  content: string
  parentMessageId?: string
}

// Send message response
export interface SendMessageResponse {
  messageId: string
  conversationId: string
  content: string
  sources: SourceResponse[]
  timestamp: string
}

// Edit message request
export interface EditMessageRequest {
  messageId: string
  content: string
}

// Stream response chunk
export interface StreamChunk {
  type: "content" | "source" | "done" | "error"
  content?: string
  source?: SourceResponse
  error?: string
}

// ============================================
// Conversations API
// ============================================

export interface ConversationListItem {
  id: string
  title: string
  lastMessage?: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface ConversationResponse {
  id: string
  title: string
  messages: MessageResponse[]
  createdAt: string
  updatedAt: string
}

export interface CreateConversationRequest {
  title?: string
  initialMessage?: string
}

export interface UpdateConversationRequest {
  title: string
}

// ============================================
// Messages API
// ============================================

export interface MessageResponse {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: SourceResponse[]
  timestamp: string
  isEdited?: boolean
  editHistory?: MessageVersionResponse[]
  parentMessageId?: string
}

export interface MessageVersionResponse {
  content: string
  timestamp: string
  responseId?: string
}

// ============================================
// Sources/Documents API
// ============================================

export interface SourceResponse {
  id: string
  title: string
  content: string
  relevance: number
  type: "document" | "database" | "api"
  fileType?: "md" | "txt"
  uploadedAt?: string
}

export interface SourceDetailResponse extends SourceResponse {
  author: string
  createdAt: string
  updatedAt: string
  path: string
  tags: string[]
  fullContent: string
  relatedSources: RelatedSourceResponse[]
  metadata: MetadataItem[]
}

export interface RelatedSourceResponse {
  id: string
  title: string
  type: "document" | "database" | "api"
}

export interface MetadataItem {
  label: string
  value: string
}

// ============================================
// Documents API
// ============================================

export interface DocumentListItem {
  id: string
  name: string
  size: number
  fileType: "md" | "txt"
  uploadedAt: string
  chunksCount?: number
}

export interface UploadDocumentRequest {
  file: File
}

export interface UploadDocumentResponse {
  id: string
  name: string
  size: number
  fileType: "md" | "txt"
  uploadedAt: string
  chunksCount: number
}

export interface DocumentSearchRequest {
  query: string
  limit?: number
}

export interface DocumentSearchResponse {
  results: SourceResponse[]
  totalFound: number
}

// ============================================
// Code Execution API
// ============================================

export interface ExecuteCodeRequest {
  code: string
  language: "python" | "javascript"
}

export interface ExecuteCodeResponse {
  output: string
  error?: string
  executionTime?: number
}

// ============================================
// Settings API
// ============================================

export interface UserSettings {
  theme: "light" | "dark" | "system"
  language: string
  notifications: boolean
}

export interface UpdateSettingsRequest {
  theme?: "light" | "dark" | "system"
  language?: string
  notifications?: boolean
}

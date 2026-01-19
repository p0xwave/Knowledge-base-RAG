// Discriminated unions for message types

import type { Source } from "@/lib/types"

// ============================================
// Base message types
// ============================================

interface BaseMessage {
  id: string
  timestamp: Date
  isEdited?: boolean
  editHistory?: MessageVersion[]
}

export interface MessageVersion {
  content: string
  timestamp: Date
  responseId?: string
}

// ============================================
// User message
// ============================================

export interface UserMessage extends BaseMessage {
  role: "user"
  content: string
}

// ============================================
// Assistant message
// ============================================

export interface AssistantMessage extends BaseMessage {
  role: "assistant"
  content: string
  sources?: Source[]
  parentMessageId?: string
}

// ============================================
// System message (for future use)
// ============================================

export interface SystemMessage extends BaseMessage {
  role: "system"
  content: string
  type: "info" | "warning" | "error"
}

// ============================================
// Discriminated union
// ============================================

export type Message = UserMessage | AssistantMessage | SystemMessage

// ============================================
// Type guards
// ============================================

export function isUserMessage(message: Message): message is UserMessage {
  return message.role === "user"
}

export function isAssistantMessage(message: Message): message is AssistantMessage {
  return message.role === "assistant"
}

export function isSystemMessage(message: Message): message is SystemMessage {
  return message.role === "system"
}

// ============================================
// Message status types
// ============================================

export type MessageStatus = "sending" | "sent" | "error" | "streaming"

export interface MessageWithStatus {
  message: Message
  status: MessageStatus
  error?: string
}

// ============================================
// Streaming message types
// ============================================

export interface StreamingMessage {
  id: string
  role: "assistant"
  content: string
  isStreaming: true
  sources?: Source[]
}

export type DisplayMessage = Message | StreamingMessage

export function isStreamingMessage(message: DisplayMessage): message is StreamingMessage {
  return "isStreaming" in message && message.isStreaming === true
}

// ============================================
// Message group for UI display
// ============================================

export interface MessageGroup {
  userMessage: UserMessage
  assistantMessage?: AssistantMessage | StreamingMessage
  timestamp: Date
}

// ============================================
// Chat state types
// ============================================

export type ChatStatus = "idle" | "loading" | "streaming" | "error"

export interface ChatState {
  status: ChatStatus
  error?: string
  streamingMessageId?: string
}

// ============================================
// Message actions
// ============================================

export type MessageAction =
  | { type: "send"; content: string }
  | { type: "edit"; messageId: string; content: string }
  | { type: "regenerate"; messageId: string }
  | { type: "delete"; messageId: string }
  | { type: "copy"; messageId: string }

// ============================================
// Event types for message handling
// ============================================

export interface MessageSentEvent {
  type: "message_sent"
  message: UserMessage
}

export interface MessageReceivedEvent {
  type: "message_received"
  message: AssistantMessage
}

export interface StreamStartEvent {
  type: "stream_start"
  messageId: string
}

export interface StreamChunkEvent {
  type: "stream_chunk"
  messageId: string
  chunk: string
}

export interface StreamEndEvent {
  type: "stream_end"
  messageId: string
  sources?: Source[]
}

export interface StreamErrorEvent {
  type: "stream_error"
  messageId: string
  error: string
}

export type MessageEvent =
  | MessageSentEvent
  | MessageReceivedEvent
  | StreamStartEvent
  | StreamChunkEvent
  | StreamEndEvent
  | StreamErrorEvent

export interface MessageVersion {
  content: string
  timestamp: Date
  responseId?: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  timestamp: Date
  isEdited?: boolean
  editHistory?: MessageVersion[]
  parentMessageId?: string
}

export interface Source {
  id: string
  title: string
  content: string
  relevance: number
  type: "document"
  fileType?: "md" | "txt"
  uploadedAt?: Date
  folderId?: string | null
  folderPath?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface ExtendedSourceData {
  author: string
  createdAt: string
  updatedAt: string
  path: string
  tags: string[]
  fullContent: string
  relatedSources: { id: string; title: string; type: "document" | "database" | "api" }[]
  metadata: { label: string; value: string }[]
}

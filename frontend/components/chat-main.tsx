"use client"

import { useState } from "react"
import { ChatHeader } from "@/components/chat/chat-header"
import { MessageList } from "@/components/chat/message-list"
import { MessageInput } from "@/components/chat/message-input"
import { SourceDetailModal } from "@/components/source-detail-modal"
import type { Conversation, Source } from "@/lib/types"

interface ChatMainProps {
  conversation: Conversation | null
  onSendMessage: (content: string) => void
  onEditMessage: (messageId: string, newContent: string) => void
  isWaitingForResponse: boolean
  showSources: boolean
  onToggleSources: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function ChatMain({
  conversation,
  onSendMessage,
  onEditMessage,
  isWaitingForResponse,
  showSources,
  onToggleSources,
  sidebarOpen,
  onToggleSidebar,
}: ChatMainProps) {
  const [input, setInput] = useState("")
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [sourceModalOpen, setSourceModalOpen] = useState(false)

  const handleSourceClick = (source: Source) => {
    setSelectedSource(source)
    setSourceModalOpen(true)
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isWaitingForResponse) return
    onSendMessage(trimmed)
    setInput("")
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  return (
    <div
      className="from-background to-muted/30 flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b"
      role="main"
    >
      <ChatHeader
        conversation={conversation}
        showSources={showSources}
        onToggleSources={onToggleSources}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      <MessageList
        conversation={conversation}
        isWaitingForResponse={isWaitingForResponse}
        onSourceClick={handleSourceClick}
        onEditMessage={onEditMessage}
        onSuggestionClick={handleSuggestionClick}
      />

      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isWaitingForResponse}
      />

      <SourceDetailModal
        source={selectedSource}
        open={sourceModalOpen}
        onOpenChange={setSourceModalOpen}
      />
    </div>
  )
}

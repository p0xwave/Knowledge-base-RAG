"use client"

import { useState } from "react"
import { ChatHeader } from "@/components/chat/chat-header"
import { MessageList } from "@/components/chat/message-list"
import { MessageInput } from "@/components/chat/message-input"
import { SourceDetailModal } from "@/components/source-detail-modal"
import type { Source } from "@/lib/types"

export function ChatMain() {
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [sourceModalOpen, setSourceModalOpen] = useState(false)

  const handleSourceClick = (source: Source) => {
    setSelectedSource(source)
    setSourceModalOpen(true)
  }

  return (
    <div
      className="from-background to-muted/30 flex min-h-0 flex-1 flex-col overflow-hidden bg-linear-to-b"
      role="main"
    >
      <ChatHeader />

      <MessageList onSourceClick={handleSourceClick} />

      <MessageInput />

      <SourceDetailModal
        source={selectedSource}
        open={sourceModalOpen}
        onOpenChange={setSourceModalOpen}
      />
    </div>
  )
}

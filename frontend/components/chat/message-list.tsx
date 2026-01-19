"use client"

import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"
import { ChatEmptyState } from "./chat-empty-state"
import { MessageGroup } from "./message-group"
import { useMessageGroups } from "@/hooks/useMessageGroups"
import { useChatStore } from "@/lib/store/chat-store"
import type { Source } from "@/lib/types"

interface MessageListProps {
  onSourceClick: (source: Source) => void
  onSuggestionClick?: (suggestion: string) => void
}

export function MessageList({ onSourceClick, onSuggestionClick }: MessageListProps) {
  const conversation = useChatStore((s) => s.activeConversation)
  const isWaitingForResponse = useChatStore((s) => s.isWaitingForResponse)
  const editMessage = useChatStore((s) => s.editMessage)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageGroups = useMessageGroups(conversation)

  // Auto-scroll to bottom when messages change or while waiting for response
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const scrollArea = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]")
        if (scrollArea) {
          scrollArea.scrollTo({
            top: scrollArea.scrollHeight,
            behavior: "smooth",
          })
        }
      }
    }
    requestAnimationFrame(scrollToBottom)
  }, [conversation?.messages, isWaitingForResponse])

  return (
    <ScrollArea
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-auto"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      <div className="p-3 sm:p-4">
        {conversation?.messages.length === 0 ? (
          <ChatEmptyState onSuggestionClick={onSuggestionClick} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
            {messageGroups.map((group) => (
              <MessageGroup
                key={group.userMessage.id}
                userMessage={group.userMessage}
                responses={group.responses}
                onSourceClick={onSourceClick}
                onEditMessage={editMessage}
              />
            ))}
            {isWaitingForResponse && (
              <div className="flex gap-2 sm:gap-4">
                <div className="from-primary to-primary/80 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br sm:h-8 sm:w-8">
                  <Loader2 className="text-primary-foreground h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                </div>
                <div className="flex-1 space-y-2 pt-1 sm:space-y-3">
                  <div className="bg-muted/80 h-3 w-3/4 animate-pulse rounded-lg sm:h-4" />
                  <div className="bg-muted/60 h-3 w-1/2 animate-pulse rounded-lg sm:h-4" />
                  <div className="bg-muted/40 h-3 w-2/3 animate-pulse rounded-lg sm:h-4" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

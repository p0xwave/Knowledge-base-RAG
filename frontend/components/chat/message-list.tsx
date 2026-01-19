"use client"

import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"
import { ChatEmptyState } from "./chat-empty-state"
import { MessageGroup } from "./message-group"
import { useMessageGroups } from "@/hooks/useMessageGroups"
import type { Conversation, Source } from "@/lib/types"

interface MessageListProps {
  conversation: Conversation | null
  isWaitingForResponse: boolean
  onSourceClick: (source: Source) => void
  onEditMessage: (messageId: string, newContent: string) => void
  onSuggestionClick?: (suggestion: string) => void
}

export function MessageList({
  conversation,
  isWaitingForResponse,
  onSourceClick,
  onEditMessage,
  onSuggestionClick,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageGroups = useMessageGroups(conversation)

  // Auto-scroll to bottom when messages change or while waiting for response
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollArea) {
          scrollArea.scrollTo({
            top: scrollArea.scrollHeight,
            behavior: 'smooth'
          })
        }
      }
    }
    requestAnimationFrame(scrollToBottom)
  }, [conversation?.messages, isWaitingForResponse])

  return (
    <ScrollArea ref={scrollRef} className="flex-1 min-h-0 overflow-auto" role="log" aria-label="Chat messages" aria-live="polite">
      <div className="p-3 sm:p-4">
        {conversation?.messages.length === 0 ? (
          <ChatEmptyState onSuggestionClick={onSuggestionClick} />
        ) : (
          <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
            {messageGroups.map((group) => (
              <MessageGroup
                key={group.userMessage.id}
                userMessage={group.userMessage}
                responses={group.responses}
                onSourceClick={onSourceClick}
                onEditMessage={onEditMessage}
              />
            ))}
            {isWaitingForResponse && (
              <div className="flex gap-2 sm:gap-4">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80">
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground animate-spin" />
                </div>
                <div className="flex-1 space-y-2 sm:space-y-3 pt-1">
                  <div className="h-3 sm:h-4 w-3/4 animate-pulse rounded-lg bg-muted/80" />
                  <div className="h-3 sm:h-4 w-1/2 animate-pulse rounded-lg bg-muted/60" />
                  <div className="h-3 sm:h-4 w-2/3 animate-pulse rounded-lg bg-muted/40" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { UserMessageBubble } from "./user-message-bubble"
import { AssistantMessageBubble } from "./assistant-message-bubble"
import { History, ChevronLeft, ChevronRight } from "lucide-react"
import type { Message, Source } from "@/lib/types"

interface MessageGroupProps {
  userMessage: Message
  responses: Message[]
  onSourceClick: (source: Source) => void
  onEditMessage: (messageId: string, newContent: string) => void
}

export function MessageGroup({ userMessage, responses, onSourceClick, onEditMessage }: MessageGroupProps) {
  const [currentResponseIndex, setCurrentResponseIndex] = useState(responses.length - 1)

  // Update index when responses change
  useEffect(() => {
    setCurrentResponseIndex(responses.length - 1)
  }, [responses.length])

  const currentResponse = responses[currentResponseIndex]
  const hasMultipleResponses = responses.length > 1

  return (
    <div className="space-y-4 sm:space-y-6">
      <UserMessageBubble
        message={userMessage}
        onEditMessage={onEditMessage}
      />

      {currentResponse && (
        <div className="space-y-2">
          <AssistantMessageBubble
            message={currentResponse}
            onSourceClick={onSourceClick}
          />

          {hasMultipleResponses && (
            <div className="flex items-center gap-1 ml-9 sm:ml-12">
              <History className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => setCurrentResponseIndex((i) => Math.max(0, i - 1))}
                disabled={currentResponseIndex === 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[40px] text-center">
                {currentResponseIndex + 1} / {responses.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => setCurrentResponseIndex((i) => Math.min(responses.length - 1, i + 1))}
                disabled={currentResponseIndex === responses.length - 1}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
                {currentResponseIndex === responses.length - 1 ? "Current" : "Previous"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

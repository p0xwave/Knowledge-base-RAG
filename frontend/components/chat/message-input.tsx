"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TooltipButton } from "@/components/tooltip-button"
import { Paperclip, Send } from "lucide-react"
import { MAX_MESSAGE_LENGTH } from "@/lib/constants"
import { toast } from "sonner"
import { useChatStore } from "@/lib/store/chat-store"

export function MessageInput() {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isWaitingForResponse = useChatStore((s) => s.isWaitingForResponse)
  const sendMessage = useChatStore((s) => s.sendMessage)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || isWaitingForResponse) return

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`)
      return
    }

    sendMessage(trimmed)
    setValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-background p-3 pb-4 sm:p-4 sm:pb-6">
      <div className="mx-auto max-w-3xl">
        <div className="bg-muted/50 hover:bg-muted/70 focus-within:bg-muted/70 focus-within:ring-border relative flex items-center gap-1.5 rounded-2xl px-2 py-2 transition-colors focus-within:ring-1 sm:gap-2 sm:px-3">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="text-foreground placeholder:text-muted-foreground max-h-[200px] min-h-8 flex-1 resize-none border-0 bg-transparent py-0 text-sm leading-8 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
            aria-label="Message input"
          />
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <TooltipButton
              tooltip="Attach file"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hidden h-8 w-8 hover:bg-transparent sm:flex"
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </TooltipButton>
            <Button
              onClick={handleSend}
              disabled={!value.trim() || isWaitingForResponse}
              size="icon"
              className="h-8 w-8 rounded-xl"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 hidden text-center text-xs sm:mt-3 sm:block">
          AI responses are generated from your uploaded documents. Always verify critical
          information.
        </p>
      </div>
    </div>
  )
}

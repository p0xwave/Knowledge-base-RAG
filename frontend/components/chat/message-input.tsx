"use client"

import type React from "react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TooltipButton } from "@/components/tooltip-button"
import { Paperclip, Send } from "lucide-react"
import { MAX_MESSAGE_LENGTH } from "@/lib/constants"
import { toast } from "sonner"

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
}

export function MessageInput({ value, onChange, onSend, disabled }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`)
      return
    }

    onSend()
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
        <div className="relative flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-muted/50 hover:bg-muted/70 transition-colors focus-within:bg-muted/70 focus-within:ring-1 focus-within:ring-border px-2 sm:px-3 py-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 min-h-8 max-h-[200px] resize-none border-0 bg-transparent py-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none text-foreground placeholder:text-muted-foreground text-sm leading-8"
            rows={1}
            aria-label="Message input"
          />
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <TooltipButton
              tooltip="Attach file"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent hidden sm:flex"
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </TooltipButton>
            <Button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              size="icon"
              className="h-8 w-8 rounded-xl"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <p className="mt-2 sm:mt-3 text-center text-xs text-muted-foreground hidden sm:block">
          AI responses are generated from your uploaded documents. Always verify critical information.
        </p>
      </div>
    </div>
  )
}

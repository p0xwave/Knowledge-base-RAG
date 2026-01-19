"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TooltipButton } from "@/components/tooltip-button"
import { ParagraphRenderer } from "@/components/paragraph-renderer"
import { User, Pencil, History, ChevronLeft, ChevronRight } from "lucide-react"
import type { Message } from "@/lib/types"
import { cn } from "@/lib/utils"

interface UserMessageBubbleProps {
  message: Message
  onEditMessage: (messageId: string, newContent: string) => void
}

export function UserMessageBubble({ message, onEditMessage }: UserMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showHistory, setShowHistory] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(0)

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEditMessage(message.id, editContent)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }

  const history = message.editHistory || []
  const hasHistory = history.length > 0

  return (
    <div className="flex gap-2 sm:gap-4 justify-end">
      <div className="flex-1 max-w-[85%] sm:max-w-[80%] flex justify-end">
        <div className="space-y-2">
          {isEditing ? (
            <div className="rounded-2xl bg-muted/80 p-3 sm:p-4">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none text-foreground text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-muted-foreground">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 bg-primary text-primary-foreground">
                <ParagraphRenderer
                  content={message.content}
                  className="text-sm leading-relaxed"
                  paragraphClassName="mb-1.5 last:mb-0"
                />
              </div>

              <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                {message.isEdited && (
                  <span className="text-xs text-muted-foreground mr-1">(edited)</span>
                )}
                {hasHistory && (
                  <TooltipButton
                    tooltip="View edit history"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      showHistory && "bg-muted text-foreground"
                    )}
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <History className="h-3.5 w-3.5" />
                  </TooltipButton>
                )}
                <TooltipButton
                  tooltip="Edit message"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </TooltipButton>
              </div>

              {/* Edit History Panel */}
              {showHistory && hasHistory && (
                <div className="rounded-xl bg-muted/30 p-2 sm:p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Previous versions</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-muted"
                        onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
                        disabled={historyIndex === 0}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground min-w-[30px] text-center">
                        {historyIndex + 1} / {history.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-muted"
                        onClick={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
                        disabled={historyIndex === history.length - 1}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
                    <p className="text-sm text-foreground">{history[historyIndex].content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {history[historyIndex].timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
      </div>
    </div>
  )
}

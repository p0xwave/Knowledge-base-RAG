"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ParagraphRenderer } from "@/components/paragraph-renderer"
import { SourceBadge } from "./source-badge"
import { CodeBlock } from "@/components/code-block"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { Bot, Copy, Check, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react"
import type { Message, Source } from "@/lib/types"
import { CODE_BLOCK_REGEX } from "@/lib/syntax-highlighting"
import { cn } from "@/lib/utils"

interface AssistantMessageBubbleProps {
  message: Message
  onSourceClick: (source: Source) => void
}

export function AssistantMessageBubble({ message, onSourceClick }: AssistantMessageBubbleProps) {
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null)
  const { copied, copy } = useCopyFeedback()

  const handleCopy = () => copy(message.content)

  const handleFeedback = (type: "like" | "dislike") => {
    setFeedback(feedback === type ? null : type)
  }

  // Parse content for code blocks
  const renderContent = () => {
    const content = message.content
    const regex = new RegExp(CODE_BLOCK_REGEX.source, "g")
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index)
        parts.push(<ParagraphRenderer key={`text-${lastIndex}`} content={textBefore} />)
      }

      // Add code block
      const language = match[1] || "javascript"
      const code = match[2].trim()
      parts.push(<CodeBlock key={`code-${match.index}`} code={code} language={language} />)

      lastIndex = match.index + match[0].length
    }

    // Add remaining text after last code block
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex)
      parts.push(<ParagraphRenderer key={`text-${lastIndex}`} content={remainingText} />)
    }

    return parts.length > 0 ? parts : <ParagraphRenderer content={content} />
  }

  return (
    <div className="flex gap-2 sm:gap-4">
      <div className="from-primary to-primary/80 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br sm:h-8 sm:w-8">
        <Bot className="text-primary-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="prose prose-sm text-foreground prose-p:leading-relaxed prose-p:my-2 prose-strong:text-foreground prose-strong:font-semibold max-w-none">
          {renderContent()}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="border-border/50 mt-3 border-t pt-3 sm:mt-4 sm:pt-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">Referenced sources</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {message.sources.map((source) => (
                <SourceBadge
                  key={source.id}
                  source={source}
                  onClick={() => onSourceClick(source)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:mt-3 sm:gap-1"
          style={{ opacity: 1 }}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 transition-all duration-200 sm:h-8 sm:w-8",
                    copied
                      ? "text-green-500 hover:bg-green-500/10 hover:text-green-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="animate-in zoom-in-50 h-3.5 w-3.5 duration-200 sm:h-4 sm:w-4" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied!" : "Copy"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 transition-all duration-200 sm:h-8 sm:w-8",
                    feedback === "like"
                      ? "scale-110 text-green-500 hover:bg-green-500/10 hover:text-green-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => handleFeedback("like")}
                >
                  <ThumbsUp
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200 sm:h-4 sm:w-4",
                      feedback === "like" && "animate-in zoom-in-50 fill-current"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {feedback === "like" ? "Thanks for feedback!" : "Good response"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 transition-all duration-200 sm:h-8 sm:w-8",
                    feedback === "dislike"
                      ? "scale-110 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => handleFeedback("dislike")}
                >
                  <ThumbsDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200 sm:h-4 sm:w-4",
                      feedback === "dislike" && "animate-in zoom-in-50 fill-current"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {feedback === "dislike" ? "Thanks for feedback!" : "Bad response"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-7 w-7 transition-all duration-200 active:rotate-180 sm:h-8 sm:w-8"
                >
                  <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

"use client"

import { cn } from "@/lib/utils"

interface ParagraphRendererProps {
  content: string
  className?: string
  paragraphClassName?: string
}

/**
 * Renders text content with line breaks as separate paragraphs
 * Used across: chat-main (UserMessageBubble, AssistantMessageBubble), sources-panel
 */
export function ParagraphRenderer({
  content,
  className,
  paragraphClassName = "mb-2 last:mb-0 leading-relaxed",
}: ParagraphRendererProps) {
  const paragraphs = content.split("\n")

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={paragraphClassName}>
          {paragraph}
        </p>
      ))}
    </div>
  )
}

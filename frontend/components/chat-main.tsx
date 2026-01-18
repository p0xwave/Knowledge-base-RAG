"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  PanelLeftOpen,
  Send,
  Paperclip,
  Sparkles,
  User,
  Bot,
  FileText,
  Database,
  Globe,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Loader2,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { SourceDetailModal } from "@/components/source-detail-modal"
import { CodeBlock } from "@/components/code-block"
import type { Conversation, Message, Source, MessageVersion } from "@/app/page"
import { cn } from "@/lib/utils"

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
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSourceClick = (source: Source) => {
    setSelectedSource(source)
    setSourceModalOpen(true)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation?.messages])

  const handleSend = () => {
    if (!input.trim() || isWaitingForResponse) return
    onSendMessage(input)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by user message and its responses (including history)
  const getMessageGroups = () => {
    if (!conversation) return []
    
    const groups: { userMessage: Message; responses: Message[] }[] = []
    
    for (let i = 0; i < conversation.messages.length; i++) {
      const msg = conversation.messages[i]
      if (msg.role === "user") {
        const responses: Message[] = []
        // Collect all assistant responses linked to this user message
        for (let j = i + 1; j < conversation.messages.length; j++) {
          const nextMsg = conversation.messages[j]
          if (nextMsg.role === "assistant" && (nextMsg.parentMessageId === msg.id || (j === i + 1 && !nextMsg.parentMessageId))) {
            responses.push(nextMsg)
          }
          if (nextMsg.role === "user") break
        }
        groups.push({ userMessage: msg, responses })
      }
    }
    
    return groups
  }

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-background to-muted/30 overflow-hidden min-h-0">
      <header className="flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onToggleSidebar}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-foreground text-sm sm:text-base truncate">{conversation?.title || "New Conversation"}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-chart-5 shrink-0"></span>
              <span className="truncate">3 documents loaded</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 sm:gap-2 shadow-sm",
                    showSources && "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15",
                  )}
                  onClick={onToggleSources}
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Sources</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle sources panel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div className="p-3 sm:p-4">
          {conversation?.messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
              {getMessageGroups().map((group) => (
                <MessageGroup
                  key={group.userMessage.id}
                  userMessage={group.userMessage}
                  responses={group.responses}
                  onSourceClick={handleSourceClick}
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

      <div className="bg-background p-3 pb-4 sm:p-4 sm:pb-6">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-muted/50 hover:bg-muted/70 transition-colors focus-within:bg-muted/70 focus-within:ring-1 focus-within:ring-border px-2 sm:px-3 py-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="flex-1 min-h-8 max-h-[200px] resize-none border-0 bg-transparent py-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none text-foreground placeholder:text-muted-foreground text-sm leading-8"
              rows={1}
            />
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent hidden sm:flex">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isWaitingForResponse}
                size="icon"
                className="h-8 w-8 rounded-xl"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-center text-xs text-muted-foreground hidden sm:block">
            AI responses are generated from your uploaded documents. Always verify critical information.
          </p>
        </div>
      </div>

      <SourceDetailModal 
        source={selectedSource} 
        open={sourceModalOpen} 
        onOpenChange={setSourceModalOpen} 
      />
    </div>
  )
}

function EmptyState() {
  const suggestions = [
    { icon: Database, text: "What are the key metrics from Q3?", color: "bg-chart-1/10 text-chart-1" },
    { icon: FileText, text: "Summarize the latest sales report", color: "bg-chart-5/10 text-chart-5" },
    { icon: Globe, text: "Compare customer growth across regions", color: "bg-chart-3/10 text-chart-3" },
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center text-center max-w-xl mx-auto py-8 sm:py-16 px-2">
      <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4 sm:mb-6 shadow-sm">
        <Sparkles className="h-7 w-7 sm:h-9 sm:w-9 text-primary" />
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2 text-balance">Query Your Private Database</h2>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-md leading-relaxed">
        Ask questions about your data and get AI-powered insights with source citations.
      </p>
      <div className="grid gap-2 sm:gap-3 w-full max-w-md">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 text-left transition-all hover:shadow-md hover:border-primary/20 active:scale-[0.98] sm:hover:-translate-y-0.5"
          >
            <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg shrink-0", suggestion.color)}>
              {suggestion.icon && <suggestion.icon className="h-4 w-4 sm:h-5 sm:w-5" />}
            </div>
            <span className="text-sm text-foreground">{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface MessageGroupProps {
  userMessage: Message
  responses: Message[]
  onSourceClick: (source: Source) => void
  onEditMessage: (messageId: string, newContent: string) => void
}

function MessageGroup({ userMessage, responses, onSourceClick, onEditMessage }: MessageGroupProps) {
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

interface UserMessageBubbleProps {
  message: Message
  onEditMessage: (messageId: string, newContent: string) => void
}

function UserMessageBubble({ message, onEditMessage }: UserMessageBubbleProps) {
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
                <div className="text-sm leading-relaxed">
                  {message.content.split("\n").map((paragraph, index) => (
                    <p key={index} className="mb-1.5 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                {message.isEdited && (
                  <span className="text-xs text-muted-foreground mr-1">(edited)</span>
                )}
                {hasHistory && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                            showHistory && "bg-muted text-foreground"
                          )}
                          onClick={() => setShowHistory(!showHistory)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View edit history</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit message</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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

interface AssistantMessageBubbleProps {
  message: Message
  onSourceClick: (source: Source) => void
}

function AssistantMessageBubble({ message, onSourceClick }: AssistantMessageBubbleProps) {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFeedback = (type: 'like' | 'dislike') => {
    setFeedback(feedback === type ? null : type)
  }

  // Parse content for code blocks
  const renderContent = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index)
        parts.push(
          <div key={`text-${lastIndex}`}>
            {textBefore.split("\n").map((paragraph, index) => (
              <p key={index} className="mb-2 last:mb-0 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        )
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
      parts.push(
        <div key={`text-${lastIndex}`}>
          {remainingText.split("\n").map((paragraph, index) => (
            <p key={index} className="mb-2 last:mb-0 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      )
    }

    return parts.length > 0 ? parts : content.split("\n").map((paragraph, index) => (
      <p key={index} className="mb-2 last:mb-0 leading-relaxed">
        {paragraph}
      </p>
    ))
  }

  return (
    <div className="flex gap-2 sm:gap-4">
      <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80">
        <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="prose prose-sm max-w-none text-foreground prose-p:leading-relaxed prose-p:my-2 prose-strong:text-foreground prose-strong:font-semibold">
          {renderContent(message.content)}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">Referenced sources</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {message.sources.map((source) => (
                <SourceBadge key={source.id} source={source} onClick={() => onSourceClick(source)} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 sm:mt-3 flex items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: 1 }}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 transition-all duration-200",
                    copied
                      ? "text-green-500 hover:text-green-500 hover:bg-green-500/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-in zoom-in-50 duration-200" />
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
                    "h-7 w-7 sm:h-8 sm:w-8 transition-all duration-200",
                    feedback === 'like'
                      ? "text-green-500 hover:text-green-500 hover:bg-green-500/10 scale-110"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => handleFeedback('like')}
                >
                  <ThumbsUp className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200",
                    feedback === 'like' && "fill-current animate-in zoom-in-50"
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{feedback === 'like' ? "Thanks for feedback!" : "Good response"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 transition-all duration-200",
                    feedback === 'dislike'
                      ? "text-red-500 hover:text-red-500 hover:bg-red-500/10 scale-110"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  onClick={() => handleFeedback('dislike')}
                >
                  <ThumbsDown className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200",
                    feedback === 'dislike' && "fill-current animate-in zoom-in-50"
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{feedback === 'dislike' ? "Thanks for feedback!" : "Bad response"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 active:rotate-180"
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

interface SourceBadgeProps {
  source: Source
  onClick: () => void
}

function SourceBadge({ source, onClick }: SourceBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm transition-colors cursor-pointer group active:scale-95"
    >
      <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      <span className="truncate max-w-[100px] sm:max-w-[150px] text-foreground/80 group-hover:text-foreground transition-colors">{source.title}</span>
      <span className="text-xs text-muted-foreground">{Math.round(source.relevance * 100)}%</span>
    </button>
  )
}

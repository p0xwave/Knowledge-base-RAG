"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Edit2,
  Database,
  Settings,
  HelpCircle,
  ChevronLeft,
  Sparkles,
} from "lucide-react"
import type { Conversation } from "@/app/page"
import { cn } from "@/lib/utils"

interface ChatSidebarProps {
  conversations: Conversation[]
  activeConversation: Conversation | null
  onSelectConversation: (conversation: Conversation) => void
  onNewConversation: () => void
  onDeleteConversation: (id: string) => void
  isOpen: boolean
  onToggle: () => void
}

export function ChatSidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isOpen,
  onToggle,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredConversations = conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const groupedConversations = {
    today: filteredConversations.filter((c) => {
      const today = new Date()
      return c.updatedAt.toDateString() === today.toDateString()
    }),
    yesterday: filteredConversations.filter((c) => {
      const yesterday = new Date(Date.now() - 86400000)
      return c.updatedAt.toDateString() === yesterday.toDateString()
    }),
    older: filteredConversations.filter((c) => {
      const yesterday = new Date(Date.now() - 86400000)
      return c.updatedAt < yesterday
    }),
  }

  return (
    <div
      className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-all duration-300 h-full overflow-hidden shrink-0",
        isOpen ? "w-72" : "w-0",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-semibold text-sidebar-foreground">DataMind</span>
            <p className="text-[10px] text-muted-foreground">RAG Assistant</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
          onClick={onToggle}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3">
        <Button
          onClick={onNewConversation}
          className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground h-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 px-3">
        {groupedConversations.today.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Today</p>
            {groupedConversations.today.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversation?.id === conversation.id}
                onSelect={() => onSelectConversation(conversation)}
                onDelete={() => onDeleteConversation(conversation.id)}
              />
            ))}
          </div>
        )}

        {groupedConversations.yesterday.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Yesterday
            </p>
            {groupedConversations.yesterday.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversation?.id === conversation.id}
                onSelect={() => onSelectConversation(conversation)}
                onDelete={() => onDeleteConversation(conversation.id)}
              />
            ))}
          </div>
        )}

        {groupedConversations.older.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Previous 7 Days
            </p>
            {groupedConversations.older.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversation?.id === conversation.id}
                onSelect={() => onSelectConversation(conversation)}
                onDelete={() => onDeleteConversation(conversation.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3 space-y-0.5">
        <Link href="/documents">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent h-9"
          >
            <Database className="h-4 w-4" />
            Documents
          </Button>
        </Link>
        <Link href="/settings">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent h-9"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent h-9"
        >
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-all",
        isActive
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
      onClick={onSelect}
    >
      <MessageSquare className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
      <span className="flex-1 truncate text-sm">{conversation.title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem>
            <Edit2 className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

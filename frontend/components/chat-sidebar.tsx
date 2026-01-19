"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import type { Conversation } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/lib/store/chat-store"
import { useGroupedConversations } from "@/hooks/useGroupedConversations"

export function ChatSidebar() {
  const [searchQuery, setSearchQuery] = useState("")

  const conversations = useChatStore((s) => s.conversations)
  const activeConversation = useChatStore((s) => s.activeConversation)
  const isOpen = useChatStore((s) => s.sidebarOpen)
  const selectConversation = useChatStore((s) => s.selectConversation)
  const createConversation = useChatStore((s) => s.createConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const toggleSidebar = useChatStore((s) => s.toggleSidebar)

  const groupedConversations = useGroupedConversations(conversations, searchQuery)

  return (
    <div
      className={cn(
        "border-border bg-sidebar flex h-full shrink-0 flex-col overflow-hidden border-r transition-all duration-300",
        isOpen ? "w-72" : "w-0"
      )}
    >
      <div className="border-sidebar-border flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <div className="from-primary to-primary/80 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm">
            <Sparkles className="text-primary-foreground h-4 w-4" />
          </div>
          <div>
            <span className="text-sidebar-foreground font-semibold">DataMind</span>
            <p className="text-muted-foreground text-[10px]">RAG Assistant</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent h-8 w-8"
          onClick={toggleSidebar}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3">
        <Button
          onClick={createConversation}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full justify-start gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground h-9 pl-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 px-3">
        {groupedConversations.today.length > 0 && (
          <div className="mb-4">
            <p className="text-muted-foreground mb-2 px-2 text-[11px] font-medium tracking-wider uppercase">
              Today
            </p>
            {groupedConversations.today.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversation?.id === conversation.id}
                onSelect={() => selectConversation(conversation)}
                onDelete={() => deleteConversation(conversation.id)}
              />
            ))}
          </div>
        )}

        {groupedConversations.yesterday.length > 0 && (
          <div className="mb-4">
            <p className="text-muted-foreground mb-2 px-2 text-[11px] font-medium tracking-wider uppercase">
              Yesterday
            </p>
            {groupedConversations.yesterday.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversation?.id === conversation.id}
                onSelect={() => selectConversation(conversation)}
                onDelete={() => deleteConversation(conversation.id)}
              />
            ))}
          </div>
        )}

        {groupedConversations.older.length > 0 && (
          <div className="mb-4">
            <p className="text-muted-foreground mb-2 px-2 text-[11px] font-medium tracking-wider uppercase">
              Previous 7 Days
            </p>
            {groupedConversations.older.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversation?.id === conversation.id}
                onSelect={() => selectConversation(conversation)}
                onDelete={() => deleteConversation(conversation.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-sidebar-border space-y-0.5 border-t p-3">
        <Link href="/documents">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent h-9 w-full justify-start gap-2"
          >
            <Database className="h-4 w-4" />
            Documents
          </Button>
        </Link>
        <Link href="/settings">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent h-9 w-full justify-start gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent h-9 w-full justify-start gap-2"
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
        "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-all",
        isActive
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
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
            className="hover:bg-background h-6 w-6 opacity-0 group-hover:opacity-100"
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

"use client"

import { useChatStore } from "@/lib/store/chat-store"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ChatMain } from "@/components/chat-main"
import { SourcesPanel } from "@/components/sources-panel"

export default function Home() {
  // Используем селекторы для оптимизации ререндеров
  const conversations = useChatStore((s) => s.conversations)
  const activeConversation = useChatStore((s) => s.activeConversation)
  const showSources = useChatStore((s) => s.showSources)
  const selectedSources = useChatStore((s) => s.selectedSources)
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)
  const isWaitingForResponse = useChatStore((s) => s.isWaitingForResponse)

  // Actions - не вызывают ререндер при получении
  const createConversation = useChatStore((s) => s.createConversation)
  const selectConversation = useChatStore((s) => s.selectConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const editMessage = useChatStore((s) => s.editMessage)
  const toggleSources = useChatStore((s) => s.toggleSources)
  const closeSources = useChatStore((s) => s.closeSources)
  const toggleSidebar = useChatStore((s) => s.toggleSidebar)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={selectConversation}
        onNewConversation={createConversation}
        onDeleteConversation={deleteConversation}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />
      <ChatMain
        conversation={activeConversation}
        onSendMessage={sendMessage}
        onEditMessage={editMessage}
        isWaitingForResponse={isWaitingForResponse}
        showSources={showSources}
        onToggleSources={toggleSources}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
      />
      {showSources && <SourcesPanel sources={selectedSources} onClose={closeSources} />}
    </div>
  )
}

"use client"

import { useChatStore } from "@/lib/store/chat-store"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ChatMain } from "@/components/chat-main"
import { SourcesPanel } from "@/components/sources-panel"

export default function Home() {
  const showSources = useChatStore((s) => s.showSources)

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <ChatSidebar />
      <ChatMain />
      {showSources && <SourcesPanel />}
    </div>
  )
}

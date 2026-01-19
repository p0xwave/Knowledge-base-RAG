"use client"

import { useState } from "react"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ChatMain } from "@/components/chat-main"
import { SourcesPanel } from "@/components/sources-panel"
import type { Conversation, Message, Source, MessageVersion } from "@/lib/types"
import { mockSources, mockConversations } from "@/lib/mock-data"
import { SIMULATED_RESPONSE_DELAY, EDIT_RESPONSE_DELAY } from "@/lib/constants"

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(mockConversations[0])
  const [showSources, setShowSources] = useState(true)
  const [selectedSources, setSelectedSources] = useState<Source[]>(mockSources)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)

  const handleNewConversation = () => {
    const newConvo: Conversation = {
      id: Date.now().toString(),
      title: "New Conversation",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setConversations([newConvo, ...conversations])
    setActiveConversation(newConvo)
    setSelectedSources([])
  }

  const handleSendMessage = (content: string) => {
    if (!activeConversation) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    // Add user message immediately
    setActiveConversation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [...prev.messages, userMessage],
        updatedAt: new Date(),
      }
    })

    // Start loading state
    setIsWaitingForResponse(true)

    // Simulate AI response with sources
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I've analyzed your uploaded documents and found relevant information. Based on the retrieved data, here's what I found:\n\nThe data indicates significant trends in your requested area. I've identified **3 relevant sources** that support this analysis.\n\n```python\nimport numpy as np\nimport matplotlib.pyplot as plt\n\n# Sales data by region\nregions = ['North', 'South', 'East', 'West']\nsales_q2 = np.array([1.2, 0.9, 1.5, 1.1])\nsales_q3 = np.array([1.8, 1.1, 1.9, 1.4])\n\n# Calculate growth\ngrowth = (sales_q3 - sales_q2) / sales_q2 * 100\n\n# Create bar chart\nx = np.arange(len(regions))\nwidth = 0.35\n\nfig, ax = plt.subplots(figsize=(8, 5))\nbar1 = ax.bar(x - width/2, sales_q2, width, label='Q2', color='#6366f1')\nbar2 = ax.bar(x + width/2, sales_q3, width, label='Q3', color='#10b981')\n\nax.set_ylabel('Revenue ($M)')\nax.set_title('Q2 vs Q3 Revenue by Region')\nax.set_xticks(x)\nax.set_xticklabels(regions)\nax.legend()\n\n# Add growth labels\nfor i, (g, y) in enumerate(zip(growth, sales_q3)):\n    ax.annotate(f'+{g:.0f}%', xy=(i + width/2, y), ha='center', va='bottom', fontsize=9, color='green')\n\nplt.tight_layout()\nplt.show()\n\nprint(f\"Total Q3 Revenue: ${sales_q3.sum():.1f}M\")\nprint(f\"Best region: {regions[np.argmax(growth)]} (+{growth.max():.0f}%)\")\n```\n\nWould you like me to dive deeper into any specific aspect?",
        sources: mockSources,
        timestamp: new Date(),
      }

      setActiveConversation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: [...prev.messages, assistantMessage],
          updatedAt: new Date(),
        }
      })
      setSelectedSources(mockSources)
      setIsWaitingForResponse(false)
    }, SIMULATED_RESPONSE_DELAY)
  }

  const handleDeleteConversation = (id: string) => {
    setConversations(conversations.filter((c) => c.id !== id))
    if (activeConversation?.id === id) {
      setActiveConversation(conversations.find((c) => c.id !== id) || null)
    }
  }

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!activeConversation) return

    setActiveConversation((prev) => {
      if (!prev) return prev

      const messageIndex = prev.messages.findIndex((m) => m.id === messageId)
      if (messageIndex === -1) return prev

      const originalMessage = prev.messages[messageIndex]

      // Find the response to this message (next assistant message)
      const responseMessage = prev.messages[messageIndex + 1]

      // Create edit history entry
      const historyEntry: MessageVersion = {
        content: originalMessage.content,
        timestamp: originalMessage.timestamp,
        responseId: responseMessage?.id,
      }

      // Update the message with edit history
      const updatedMessage: Message = {
        ...originalMessage,
        content: newContent,
        isEdited: true,
        editHistory: [...(originalMessage.editHistory || []), historyEntry],
        timestamp: new Date(),
      }

      // Generate new response ID
      const newResponseId = Date.now().toString()

      // Keep old response but mark it, create new response
      const newMessages = [...prev.messages]
      newMessages[messageIndex] = updatedMessage

      // If there was a response, keep it in history and add new one
      if (responseMessage && responseMessage.role === "assistant") {
        // Mark old response with parent reference
        newMessages[messageIndex + 1] = {
          ...responseMessage,
          parentMessageId: messageId,
        }

        // Add new response after a delay (simulated)
        setTimeout(() => {
          const newAssistantMessage: Message = {
            id: newResponseId,
            role: "assistant",
            content:
              "I've re-analyzed based on your updated question. Here's the revised response:\n\nThe updated analysis shows different insights based on your refined query. I found **3 relevant sources** that address your specific question.\n\n```python\nimport pandas as pd\nimport numpy as np\n\n# Create customer data\ndata = {\n    'customer_id': range(1, 11),\n    'segment': ['Enterprise', 'SMB', 'Enterprise', 'Premium', 'SMB', \n                'Enterprise', 'Premium', 'SMB', 'Enterprise', 'Premium'],\n    'revenue': [45000, 12000, 52000, 28000, 15000, \n                48000, 31000, 9500, 61000, 25000],\n    'months_active': [24, 8, 36, 18, 6, 30, 15, 4, 42, 12]\n}\n\ndf = pd.DataFrame(data)\n\n# Analysis by segment\nsummary = df.groupby('segment').agg({\n    'revenue': ['sum', 'mean', 'count'],\n    'months_active': 'mean'\n}).round(0)\n\nprint(\"=== Customer Segment Analysis ===\")\nprint(summary)\nprint(f\"\\nTotal customers: {len(df)}\")\nprint(f\"Total revenue: ${df['revenue'].sum():,}\")\nprint(f\"\\nTop segment by revenue: {df.groupby('segment')['revenue'].sum().idxmax()}\")\nprint(f\"Avg customer lifetime: {df['months_active'].mean():.1f} months\")\n```\n\nWould you like me to elaborate on any particular aspect?",
            sources: mockSources,
            timestamp: new Date(),
            parentMessageId: messageId,
          }

          setActiveConversation((current) => {
            if (!current) return current
            return {
              ...current,
              messages: [...current.messages, newAssistantMessage],
              updatedAt: new Date(),
            }
          })
        }, EDIT_RESPONSE_DELAY)
      }

      return {
        ...prev,
        messages: newMessages,
        updatedAt: new Date(),
      }
    })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={setActiveConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <ChatMain
        conversation={activeConversation}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        isWaitingForResponse={isWaitingForResponse}
        showSources={showSources}
        onToggleSources={() => setShowSources(!showSources)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
      {showSources && <SourcesPanel sources={selectedSources} onClose={() => setShowSources(false)} />}
    </div>
  )
}

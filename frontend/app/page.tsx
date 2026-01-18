"use client"

import { useState } from "react"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ChatMain } from "@/components/chat-main"
import { SourcesPanel } from "@/components/sources-panel"

export interface MessageVersion {
  content: string
  timestamp: Date
  responseId?: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  timestamp: Date
  isEdited?: boolean
  editHistory?: MessageVersion[]
  parentMessageId?: string // For responses linked to edited messages
}

export interface Source {
  id: string
  title: string
  content: string
  relevance: number
  type: "document"
  fileType?: "md" | "txt"
  uploadedAt?: Date
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

const mockSources: Source[] = [
  {
    id: "1",
    title: "Q3_Financial_Report.md",
    content: "Revenue increased by 23% compared to Q2, driven primarily by enterprise client acquisitions...",
    relevance: 0.95,
    type: "document",
    fileType: "md",
    uploadedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "2",
    title: "customer_analysis.txt",
    content: "Total active customers: 12,450. Enterprise tier: 342. Premium tier: 2,108...",
    relevance: 0.88,
    type: "document",
    fileType: "txt",
    uploadedAt: new Date(Date.now() - 172800000),
  },
  {
    id: "3",
    title: "sales_summary.md",
    content: "Monthly recurring revenue: $2.4M. Annual growth rate: 47%...",
    relevance: 0.82,
    type: "document",
    fileType: "md",
    uploadedAt: new Date(Date.now() - 259200000),
  },
]

const mockConversations: Conversation[] = [
  {
    id: "1",
    title: "Q3 Revenue Analysis",
    messages: [
      {
        id: "1",
        role: "user",
        content: "What was our Q3 revenue performance?",
        timestamp: new Date(),
      },
      {
        id: "2",
        role: "assistant",
        content:
          "Based on the Q3 Financial Report, your revenue increased by **23%** compared to Q2. This growth was primarily driven by enterprise client acquisitions, with 47 new enterprise contracts signed during the quarter.\n\nKey highlights:\n- Total revenue: $8.2M\n- Enterprise segment: +34%\n- SMB segment: +12%\n- Churn rate: 2.1% (down from 3.4%)\n\nHere's a code snippet to calculate growth rate:\n\n```javascript\nfunction calculateGrowthRate(current, previous) {\n  const growth = ((current - previous) / previous) * 100;\n  console.log('Growth calculated');\n  return growth.toFixed(2) + '%';\n}\n\n// Example usage\nconst q3Growth = calculateGrowthRate(8.2, 6.67);\n```\n\nWould you like me to provide more detailed analysis?",
        sources: mockSources,
        timestamp: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "Customer Segmentation",
    messages: [],
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "3",
    title: "Product Usage Metrics",
    messages: [],
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 172800000),
  },
]

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
          "I've analyzed your uploaded documents and found relevant information. Based on the retrieved data, here's what I found:\n\nThe data indicates significant trends in your requested area. I've identified **3 relevant sources** that support this analysis.\n\n```javascript\nfunction analyzeDocuments(query) {\n  const results = documents.filter(doc => doc.matches(query));\n  return results.map(r => r.summary);\n}\n```\n\nWould you like me to dive deeper into any specific aspect?",
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
    }, 2000)
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
              "I've re-analyzed based on your updated question. Here's the revised response:\n\nThe updated analysis shows different insights based on your refined query. I found **3 relevant sources** that address your specific question.\n\n```javascript\nconst result = analyzeData(query);\nconsole.log('Analysis complete');\nreturn result;\n```\n\nWould you like me to elaborate on any particular aspect?",
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
        }, 1000)
      }

      return {
        ...prev,
        messages: newMessages,
        updatedAt: new Date(),
      }
    })
  }

  return (
    <div className="flex h-screen bg-background">
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

import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { Conversation, Message, Source, MessageVersion } from "@/lib/types"
import { mockSources, mockConversations } from "@/lib/mock-data"
import { SIMULATED_RESPONSE_DELAY, EDIT_RESPONSE_DELAY } from "@/lib/constants"

interface ChatState {
  // State
  conversations: Conversation[]
  activeConversation: Conversation | null
  showSources: boolean
  selectedSources: Source[]
  sidebarOpen: boolean
  isWaitingForResponse: boolean
}

interface ChatActions {
  // Actions
  createConversation: () => void
  selectConversation: (conversation: Conversation) => void
  deleteConversation: (id: string) => void
  sendMessage: (content: string) => void
  editMessage: (messageId: string, newContent: string) => void
  toggleSources: () => void
  closeSources: () => void
  toggleSidebar: () => void
  setSidebar: (open: boolean) => void
}

type ChatStore = ChatState & ChatActions

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      conversations: mockConversations,
      activeConversation: mockConversations[0],
      showSources: true,
      selectedSources: mockSources,
      sidebarOpen: true,
      isWaitingForResponse: false,

      // Actions
      createConversation: () => {
        const newConvo: Conversation = {
          id: Date.now().toString(),
          title: "New Conversation",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({
          conversations: [newConvo, ...state.conversations],
          activeConversation: newConvo,
          selectedSources: [],
        }))
      },

      selectConversation: (conversation) => {
        set({ activeConversation: conversation })
      },

      deleteConversation: (id) => {
        const { conversations, activeConversation } = get()
        const newConversations = conversations.filter((c) => c.id !== id)
        set({
          conversations: newConversations,
          activeConversation:
            activeConversation?.id === id ? newConversations[0] || null : activeConversation,
        })
      },

      sendMessage: (content) => {
        const { activeConversation } = get()
        if (!activeConversation) return

        const userMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content,
          timestamp: new Date(),
        }

        // Add user message
        set((state) => ({
          activeConversation: state.activeConversation
            ? {
                ...state.activeConversation,
                messages: [...state.activeConversation.messages, userMessage],
                updatedAt: new Date(),
              }
            : null,
          isWaitingForResponse: true,
        }))

        // Simulate AI response
        setTimeout(() => {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `I've analyzed your uploaded documents and found relevant information. Based on the retrieved data, here's what I found:

The data indicates significant trends in your requested area. I've identified **3 relevant sources** that support this analysis.

\`\`\`python
import numpy as np
import matplotlib.pyplot as plt

# Sales data by region
regions = ['North', 'South', 'East', 'West']
sales_q2 = np.array([1.2, 0.9, 1.5, 1.1])
sales_q3 = np.array([1.8, 1.1, 1.9, 1.4])

# Calculate growth
growth = (sales_q3 - sales_q2) / sales_q2 * 100

# Create bar chart
x = np.arange(len(regions))
width = 0.35

fig, ax = plt.subplots(figsize=(8, 5))
bar1 = ax.bar(x - width/2, sales_q2, width, label='Q2', color='#6366f1')
bar2 = ax.bar(x + width/2, sales_q3, width, label='Q3', color='#10b981')

ax.set_ylabel('Revenue ($M)')
ax.set_title('Q2 vs Q3 Revenue by Region')
ax.set_xticks(x)
ax.set_xticklabels(regions)
ax.legend()

# Add growth labels
for i, (g, y) in enumerate(zip(growth, sales_q3)):
    ax.annotate(f'+{g:.0f}%', xy=(i + width/2, y), ha='center', va='bottom', fontsize=9, color='green')

plt.tight_layout()
plt.show()

print(f"Total Q3 Revenue: \${sales_q3.sum():.1f}M")
print(f"Best region: {regions[np.argmax(growth)]} (+{growth.max():.0f}%)")
\`\`\`

Would you like me to dive deeper into any specific aspect?`,
            sources: mockSources,
            timestamp: new Date(),
          }

          set((state) => ({
            activeConversation: state.activeConversation
              ? {
                  ...state.activeConversation,
                  messages: [...state.activeConversation.messages, assistantMessage],
                  updatedAt: new Date(),
                }
              : null,
            selectedSources: mockSources,
            isWaitingForResponse: false,
          }))
        }, SIMULATED_RESPONSE_DELAY)
      },

      editMessage: (messageId, newContent) => {
        const { activeConversation } = get()
        if (!activeConversation) return

        const messages = activeConversation.messages
        const messageIndex = messages.findIndex((m) => m.id === messageId)
        if (messageIndex === -1) return

        const originalMessage = messages[messageIndex]
        const responseMessage = messages[messageIndex + 1]

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

        // Create updated messages array
        const newMessages = [...messages]
        newMessages[messageIndex] = updatedMessage

        // If there was a response, mark it with parent reference
        if (responseMessage && responseMessage.role === "assistant") {
          newMessages[messageIndex + 1] = {
            ...responseMessage,
            parentMessageId: messageId,
          }
        }

        set({
          activeConversation: {
            ...activeConversation,
            messages: newMessages,
            updatedAt: new Date(),
          },
        })

        // Generate new response after delay
        if (responseMessage && responseMessage.role === "assistant") {
          setTimeout(() => {
            const newAssistantMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: `I've re-analyzed based on your updated question. Here's the revised response:

The updated analysis shows different insights based on your refined query. I found **3 relevant sources** that address your specific question.

\`\`\`python
import pandas as pd
import numpy as np

# Create customer data
data = {
    'customer_id': range(1, 11),
    'segment': ['Enterprise', 'SMB', 'Enterprise', 'Premium', 'SMB',
                'Enterprise', 'Premium', 'SMB', 'Enterprise', 'Premium'],
    'revenue': [45000, 12000, 52000, 28000, 15000,
                48000, 31000, 9500, 61000, 25000],
    'months_active': [24, 8, 36, 18, 6, 30, 15, 4, 42, 12]
}

df = pd.DataFrame(data)

# Analysis by segment
summary = df.groupby('segment').agg({
    'revenue': ['sum', 'mean', 'count'],
    'months_active': 'mean'
}).round(0)

print("=== Customer Segment Analysis ===")
print(summary)
print(f"\\nTotal customers: {len(df)}")
print(f"Total revenue: \${df['revenue'].sum():,}")
print(f"\\nTop segment by revenue: {df.groupby('segment')['revenue'].sum().idxmax()}")
print(f"Avg customer lifetime: {df['months_active'].mean():.1f} months")
\`\`\`

Would you like me to elaborate on any particular aspect?`,
              sources: mockSources,
              timestamp: new Date(),
              parentMessageId: messageId,
            }

            set((state) => ({
              activeConversation: state.activeConversation
                ? {
                    ...state.activeConversation,
                    messages: [...state.activeConversation.messages, newAssistantMessage],
                    updatedAt: new Date(),
                  }
                : null,
            }))
          }, EDIT_RESPONSE_DELAY)
        }
      },

      toggleSources: () => {
        set((state) => ({ showSources: !state.showSources }))
      },

      closeSources: () => {
        set({ showSources: false })
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }))
      },

      setSidebar: (open) => {
        set({ sidebarOpen: open })
      },
    }),
    { name: "chat-store" }
  )
)

// Селекторы для оптимизации ререндеров
export const selectConversations = (state: ChatStore) => state.conversations
export const selectActiveConversation = (state: ChatStore) => state.activeConversation
export const selectShowSources = (state: ChatStore) => state.showSources
export const selectSelectedSources = (state: ChatStore) => state.selectedSources
export const selectSidebarOpen = (state: ChatStore) => state.sidebarOpen
export const selectIsWaitingForResponse = (state: ChatStore) => state.isWaitingForResponse

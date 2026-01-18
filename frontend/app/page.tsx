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
          "Based on the Q3 Financial Report, your revenue increased by **23%** compared to Q2. This growth was primarily driven by enterprise client acquisitions, with 47 new enterprise contracts signed during the quarter.\n\nKey highlights:\n- Total revenue: $8.2M\n- Enterprise segment: +34%\n- SMB segment: +12%\n- Churn rate: 2.1% (down from 3.4%)\n\nHere's a statistical analysis with NumPy:\n\n```python\nimport numpy as np\n\n# Quarterly revenue data (in millions)\nrevenue = np.array([5.8, 6.2, 6.67, 8.2])\nquarters = ['Q4 2023', 'Q1 2024', 'Q2 2024', 'Q3 2024']\n\n# Calculate statistics\nmean_revenue = np.mean(revenue)\nstd_revenue = np.std(revenue)\ngrowth_rates = np.diff(revenue) / revenue[:-1] * 100\n\nprint(f\"Revenue data: {revenue}\")\nprint(f\"Mean revenue: ${mean_revenue:.2f}M\")\nprint(f\"Std deviation: ${std_revenue:.2f}M\")\nprint(f\"Quarter-over-quarter growth: {growth_rates.round(1)}%\")\nprint(f\"Average growth rate: {np.mean(growth_rates):.1f}%\")\nprint(f\"Max growth: {np.max(growth_rates):.1f}% (Q3)\")\n```\n\nWould you like me to provide more detailed analysis?",
        sources: mockSources,
        timestamp: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "ML: Neural Network Demo",
    messages: [
      {
        id: "1",
        role: "user",
        content: "Can you show me how to create a neural network for predicting values?",
        timestamp: new Date(Date.now() - 86400000),
      },
      {
        id: "2",
        role: "assistant",
        content:
          "Here's a TensorFlow.js example that trains a simple neural network to learn the pattern y = 2x - 1:\n\n```javascript\n// Create a simple neural network model\nconst model = tf.sequential();\nmodel.add(tf.layers.dense({ units: 1, inputShape: [1] }));\n\n// Compile the model\nmodel.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });\n\n// Training data: y = 2x - 1\nconst xs = tf.tensor2d([-1, 0, 1, 2, 3, 4], [6, 1]);\nconst ys = tf.tensor2d([-3, -1, 1, 3, 5, 7], [6, 1]);\n\nconsole.log('Training neural network...');\n\n// Train the model\nawait model.fit(xs, ys, { epochs: 250, verbose: 0 });\n\nconsole.log('Training complete!');\n\n// Make predictions\nconst testValues = [5, 10, 20];\nfor (const x of testValues) {\n  const prediction = model.predict(tf.tensor2d([x], [1, 1]));\n  const result = prediction.dataSync()[0];\n  console.log(`f(${x}) = ${result.toFixed(2)} (expected: ${2 * x - 1})`);\n}\n```\n\nThis demonstrates:\n- Creating a sequential model with dense layers\n- Compiling with optimizer and loss function\n- Training on sample data\n- Making predictions",
        sources: mockSources.slice(0, 2),
        timestamp: new Date(Date.now() - 86400000),
      },
    ],
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "3",
    title: "PyTorch: Neural Network",
    messages: [
      {
        id: "1",
        role: "user",
        content: "Покажи как создать нейросеть на PyTorch",
        timestamp: new Date(Date.now() - 172800000),
      },
      {
        id: "2",
        role: "assistant",
        content:
          "Вот пример создания и обучения простой нейросети на PyTorch:\n\n```python\nimport torch\nimport torch.nn as nn\nimport torch.optim as optim\n\n# Определяем архитектуру сети\nclass SimpleNet(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.fc1 = nn.Linear(10, 32)\n        self.fc2 = nn.Linear(32, 16)\n        self.fc3 = nn.Linear(16, 1)\n        self.relu = nn.ReLU()\n    \n    def forward(self, x):\n        x = self.relu(self.fc1(x))\n        x = self.relu(self.fc2(x))\n        return self.fc3(x)\n\n# Создаём модель\nmodel = SimpleNet()\nprint(f\"Модель:\\n{model}\")\n\n# Данные для обучения\nX = torch.randn(100, 10)\ny = torch.randn(100, 1)\n\n# Loss и optimizer\ncriterion = nn.MSELoss()\noptimizer = optim.Adam(model.parameters(), lr=0.01)\n\n# Обучение\nfor epoch in range(100):\n    optimizer.zero_grad()\n    output = model(X)\n    loss = criterion(output, y)\n    loss.backward()\n    optimizer.step()\n    \n    if epoch % 20 == 0:\n        print(f\"Epoch {epoch}, Loss: {loss.item():.4f}\")\n\nprint(f\"\\nФинальный loss: {loss.item():.4f}\")\n```\n\nЭто демонстрирует основы PyTorch: определение модели, forward pass, backpropagation и оптимизацию.",
        sources: mockSources.slice(0, 2),
        timestamp: new Date(Date.now() - 172800000),
      },
    ],
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 172800000),
  },
  {
    id: "4",
    title: "PyTorch: Tensor Operations",
    messages: [
      {
        id: "1",
        role: "user",
        content: "Покажи операции с тензорами в PyTorch",
        timestamp: new Date(Date.now() - 259200000),
      },
      {
        id: "2",
        role: "assistant",
        content:
          "Вот основные операции с тензорами в PyTorch:\n\n```python\nimport torch\n\n# Создание тензоров\na = torch.tensor([[1, 2], [3, 4]], dtype=torch.float32)\nb = torch.tensor([[5, 6], [7, 8]], dtype=torch.float32)\n\nprint(\"Тензор A:\")\nprint(a)\n\nprint(\"\\nТензор B:\")\nprint(b)\n\n# Математические операции\nprint(\"\\nA + B:\")\nprint(a + b)\n\nprint(\"\\nA * B (поэлементно):\")\nprint(a * b)\n\nprint(\"\\nA @ B (матричное умножение):\")\nprint(a @ b)\n\n# Статистика\ndata = torch.tensor([1., 2., 3., 4., 5., 6., 7., 8., 9., 10.])\nprint(f\"\\nСтатистика для [1..10]:\")\nprint(f\"Среднее: {data.mean().item():.2f}\")\nprint(f\"Std: {data.std().item():.2f}\")\nprint(f\"Сумма: {data.sum().item():.0f}\")\nprint(f\"Min/Max: {data.min().item():.0f} / {data.max().item():.0f}\")\n\n# GPU проверка\nprint(f\"\\nCUDA доступна: {torch.cuda.is_available()}\")\n```\n\nPyTorch предоставляет мощный API для работы с тензорами и автоматическое дифференцирование.",
        sources: mockSources.slice(0, 1),
        timestamp: new Date(Date.now() - 259200000),
      },
    ],
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(Date.now() - 259200000),
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

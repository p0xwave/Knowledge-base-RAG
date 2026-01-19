import type { Source, Conversation, ExtendedSourceData } from "./types"
import { ONE_DAY_MS, TWO_DAYS_MS, THREE_DAYS_MS } from "./constants"

export const mockSources: Source[] = [
  {
    id: "1",
    title: "Q3_Financial_Report.md",
    content:
      "Revenue increased by 23% compared to Q2, driven primarily by enterprise client acquisitions...",
    relevance: 0.95,
    type: "document",
    fileType: "md",
    uploadedAt: new Date(Date.now() - ONE_DAY_MS),
  },
  {
    id: "2",
    title: "customer_analysis.txt",
    content: "Total active customers: 12,450. Enterprise tier: 342. Premium tier: 2,108...",
    relevance: 0.88,
    type: "document",
    fileType: "txt",
    uploadedAt: new Date(Date.now() - TWO_DAYS_MS),
  },
  {
    id: "3",
    title: "sales_summary.md",
    content: "Monthly recurring revenue: $2.4M. Annual growth rate: 47%...",
    relevance: 0.82,
    type: "document",
    fileType: "md",
    uploadedAt: new Date(Date.now() - THREE_DAYS_MS),
  },
]

export const mockConversations: Conversation[] = [
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
          'Based on the Q3 Financial Report, your revenue increased by **23%** compared to Q2. This growth was primarily driven by enterprise client acquisitions, with 47 new enterprise contracts signed during the quarter.\n\nKey highlights:\n- Total revenue: $8.2M\n- Enterprise segment: +34%\n- SMB segment: +12%\n- Churn rate: 2.1% (down from 3.4%)\n\nHere\'s a statistical analysis with NumPy:\n\n```python\nimport numpy as np\n\n# Quarterly revenue data (in millions)\nrevenue = np.array([5.8, 6.2, 6.67, 8.2])\nquarters = [\'Q4 2023\', \'Q1 2024\', \'Q2 2024\', \'Q3 2024\']\n\n# Calculate statistics\nmean_revenue = np.mean(revenue)\nstd_revenue = np.std(revenue)\ngrowth_rates = np.diff(revenue) / revenue[:-1] * 100\n\nprint(f"Revenue data: {revenue}")\nprint(f"Mean revenue: ${mean_revenue:.2f}M")\nprint(f"Std deviation: ${std_revenue:.2f}M")\nprint(f"Quarter-over-quarter growth: {growth_rates.round(1)}%")\nprint(f"Average growth rate: {np.mean(growth_rates):.1f}%")\nprint(f"Max growth: {np.max(growth_rates):.1f}% (Q3)")\n```\n\nWould you like me to provide more detailed analysis?',
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
        timestamp: new Date(Date.now() - ONE_DAY_MS),
      },
      {
        id: "2",
        role: "assistant",
        content:
          "Here's a TensorFlow.js example that trains a simple neural network to learn the pattern y = 2x - 1:\n\n```javascript\n// Create a simple neural network model\nconst model = tf.sequential();\nmodel.add(tf.layers.dense({ units: 1, inputShape: [1] }));\n\n// Compile the model\nmodel.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });\n\n// Training data: y = 2x - 1\nconst xs = tf.tensor2d([-1, 0, 1, 2, 3, 4], [6, 1]);\nconst ys = tf.tensor2d([-3, -1, 1, 3, 5, 7], [6, 1]);\n\nconsole.log('Training neural network...');\n\n// Train the model\nawait model.fit(xs, ys, { epochs: 250, verbose: 0 });\n\nconsole.log('Training complete!');\n\n// Make predictions\nconst testValues = [5, 10, 20];\nfor (const x of testValues) {\n  const prediction = model.predict(tf.tensor2d([x], [1, 1]));\n  const result = prediction.dataSync()[0];\n  console.log(`f(${x}) = ${result.toFixed(2)} (expected: ${2 * x - 1})`);\n}\n```\n\nThis demonstrates:\n- Creating a sequential model with dense layers\n- Compiling with optimizer and loss function\n- Training on sample data\n- Making predictions",
        sources: mockSources.slice(0, 2),
        timestamp: new Date(Date.now() - ONE_DAY_MS),
      },
    ],
    createdAt: new Date(Date.now() - ONE_DAY_MS),
    updatedAt: new Date(Date.now() - ONE_DAY_MS),
  },
  {
    id: "3",
    title: "PyTorch: Neural Network",
    messages: [
      {
        id: "1",
        role: "user",
        content: "Покажи как создать нейросеть на PyTorch",
        timestamp: new Date(Date.now() - TWO_DAYS_MS),
      },
      {
        id: "2",
        role: "assistant",
        content:
          'Вот пример создания и обучения простой нейросети на PyTorch:\n\n```python\nimport torch\nimport torch.nn as nn\nimport torch.optim as optim\n\n# Определяем архитектуру сети\nclass SimpleNet(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.fc1 = nn.Linear(10, 32)\n        self.fc2 = nn.Linear(32, 16)\n        self.fc3 = nn.Linear(16, 1)\n        self.relu = nn.ReLU()\n    \n    def forward(self, x):\n        x = self.relu(self.fc1(x))\n        x = self.relu(self.fc2(x))\n        return self.fc3(x)\n\n# Создаём модель\nmodel = SimpleNet()\nprint(f"Модель:\\n{model}")\n\n# Данные для обучения\nX = torch.randn(100, 10)\ny = torch.randn(100, 1)\n\n# Loss и optimizer\ncriterion = nn.MSELoss()\noptimizer = optim.Adam(model.parameters(), lr=0.01)\n\n# Обучение\nfor epoch in range(100):\n    optimizer.zero_grad()\n    output = model(X)\n    loss = criterion(output, y)\n    loss.backward()\n    optimizer.step()\n    \n    if epoch % 20 == 0:\n        print(f"Epoch {epoch}, Loss: {loss.item():.4f}")\n\nprint(f"\\nФинальный loss: {loss.item():.4f}")\n```\n\nЭто демонстрирует основы PyTorch: определение модели, forward pass, backpropagation и оптимизацию.',
        sources: mockSources.slice(0, 2),
        timestamp: new Date(Date.now() - TWO_DAYS_MS),
      },
    ],
    createdAt: new Date(Date.now() - TWO_DAYS_MS),
    updatedAt: new Date(Date.now() - TWO_DAYS_MS),
  },
  {
    id: "4",
    title: "PyTorch: Tensor Operations",
    messages: [
      {
        id: "1",
        role: "user",
        content: "Покажи операции с тензорами в PyTorch",
        timestamp: new Date(Date.now() - THREE_DAYS_MS),
      },
      {
        id: "2",
        role: "assistant",
        content:
          'Вот основные операции с тензорами в PyTorch:\n\n```python\nimport torch\n\n# Создание тензоров\na = torch.tensor([[1, 2], [3, 4]], dtype=torch.float32)\nb = torch.tensor([[5, 6], [7, 8]], dtype=torch.float32)\n\nprint("Тензор A:")\nprint(a)\n\nprint("\\nТензор B:")\nprint(b)\n\n# Математические операции\nprint("\\nA + B:")\nprint(a + b)\n\nprint("\\nA * B (поэлементно):")\nprint(a * b)\n\nprint("\\nA @ B (матричное умножение):")\nprint(a @ b)\n\n# Статистика\ndata = torch.tensor([1., 2., 3., 4., 5., 6., 7., 8., 9., 10.])\nprint(f"\\nСтатистика для [1..10]:")\nprint(f"Среднее: {data.mean().item():.2f}")\nprint(f"Std: {data.std().item():.2f}")\nprint(f"Сумма: {data.sum().item():.0f}")\nprint(f"Min/Max: {data.min().item():.0f} / {data.max().item():.0f}")\n\n# GPU проверка\nprint(f"\\nCUDA доступна: {torch.cuda.is_available()}")\n```\n\nPyTorch предоставляет мощный API для работы с тензорами и автоматическое дифференцирование.',
        sources: mockSources.slice(0, 1),
        timestamp: new Date(Date.now() - THREE_DAYS_MS),
      },
    ],
    createdAt: new Date(Date.now() - THREE_DAYS_MS),
    updatedAt: new Date(Date.now() - THREE_DAYS_MS),
  },
]

export const extendedSourceData: Record<string, ExtendedSourceData> = {
  "1": {
    author: "Finance Team",
    createdAt: "2024-09-15",
    updatedAt: "2024-10-01",
    path: "/reports/finance/q3-2024.pdf",
    tags: ["finance", "quarterly", "revenue", "2024"],
    fullContent: `Revenue increased by 23% compared to Q2, driven primarily by enterprise client acquisitions. The quarterly performance exceeded expectations set at the beginning of the fiscal year.

Key Performance Indicators:
• Total Revenue: $8.2M (up from $6.7M in Q2)
• Gross Margin: 72.4% (improvement of 2.1 percentage points)
• Operating Expenses: $3.1M (controlled growth of 8%)
• Net Income: $2.8M (34% margin)

Enterprise Segment Analysis:
The enterprise segment showed exceptional growth with 47 new contracts signed. Average contract value increased by 18% to $45,000 annually. Customer retention in this segment remained strong at 96%.

Regional Performance:
• North America: +28% YoY
• Europe: +19% YoY
• Asia Pacific: +34% YoY

The strong performance in Asia Pacific is attributed to our expanded sales presence in Singapore and Australia.`,
    relatedSources: [
      { id: "2", title: "Customer Database", type: "database" },
      { id: "3", title: "Sales API Response", type: "api" },
    ],
    metadata: [
      { label: "Document Type", value: "PDF Report" },
      { label: "Pages", value: "24" },
      { label: "Department", value: "Finance" },
      { label: "Confidentiality", value: "Internal" },
    ],
  },
  "2": {
    author: "System",
    createdAt: "2024-01-01",
    updatedAt: "2024-10-15",
    path: "postgres://db.internal/customers",
    tags: ["customers", "crm", "enterprise", "analytics"],
    fullContent: `Customer Database Query Results:

Total Active Customers: 12,450
├── Enterprise Tier: 342 accounts
├── Premium Tier: 2,108 accounts
└── Standard Tier: 10,000 accounts

Customer Growth Metrics:
• New customers (Q3): 1,247
• Churned customers (Q3): 89
• Net customer growth: +1,158
• Monthly growth rate: 3.2%

Enterprise Customer Details:
Average revenue per enterprise account: $45,000/year
Enterprise segment contribution: 62% of total revenue
Top industries: Technology (34%), Healthcare (22%), Finance (18%)

Geographic Distribution:
• United States: 58%
• United Kingdom: 12%
• Germany: 8%
• Canada: 7%
• Other: 15%`,
    relatedSources: [
      { id: "1", title: "Q3 Financial Report", type: "document" },
      { id: "3", title: "Sales API Response", type: "api" },
    ],
    metadata: [
      { label: "Database", value: "PostgreSQL" },
      { label: "Records", value: "12,450" },
      { label: "Last Sync", value: "5 min ago" },
      { label: "Schema Version", value: "v2.4" },
    ],
  },
  "3": {
    author: "Sales System",
    createdAt: "2024-10-15",
    updatedAt: "2024-10-15",
    path: "api.internal/v2/sales/metrics",
    tags: ["sales", "mrr", "api", "real-time"],
    fullContent: `Sales API Response - Real-time Metrics

Monthly Recurring Revenue (MRR): $2.4M
Annual Recurring Revenue (ARR): $28.8M
Year-over-Year Growth: 47%

Pipeline Status:
• Qualified Leads: 423
• Opportunities: 187
• Proposals Sent: 89
• Closed Won (MTD): 34
• Closed Lost (MTD): 12

Sales Team Performance:
• Average deal size: $12,400
• Sales cycle length: 32 days (down from 41 days)
• Win rate: 74%
• Quota attainment: 112%

Revenue by Product:
• Core Platform: 68%
• Analytics Add-on: 18%
• Enterprise Features: 14%

Forecast (Q4):
Expected revenue: $9.1M
Confidence level: High (based on pipeline coverage of 3.2x)`,
    relatedSources: [
      { id: "1", title: "Q3 Financial Report", type: "document" },
      { id: "2", title: "Customer Database", type: "database" },
    ],
    metadata: [
      { label: "API Version", value: "v2.0" },
      { label: "Response Time", value: "124ms" },
      { label: "Cache Status", value: "Fresh" },
      { label: "Rate Limit", value: "1000/min" },
    ],
  },
}

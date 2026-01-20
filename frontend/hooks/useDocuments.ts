"use client"

import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import { MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from "@/lib/constants"

export interface Document {
  id: string
  name: string
  type: "md" | "txt"
  size: number
  content: string
  uploadedAt: Date
  folderId: string | null
  folderPath?: string
}

function validateFile(file: File): { valid: boolean; error?: string } {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File "${file.name}" exceeds 5MB limit` }
  }

  // Extension check
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (
    !extension ||
    !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])
  ) {
    return { valid: false, error: "Only .md and .txt files are supported" }
  }

  // MIME type check (with fallback for .md files that may have empty type)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type) && file.type !== "") {
    return { valid: false, error: `Invalid file type: ${file.type}` }
  }

  return { valid: true }
}

function sanitizeFilename(filename: string): string {
  return (
    filename
      .replace(/\.\.[\/\\]/g, "") // path traversal
      .replace(/[\/\\]/g, "") // slashes
      .replace(/[\x00-\x1f\x7f]/g, "") // control chars
      .slice(0, 255) || "download"
  )
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsText(file)
  })
}

const mockDocuments: Document[] = [
  {
    id: "doc-q3-financial-2024",
    name: "Q3_Financial_Report.md",
    type: "md",
    size: 24500,
    content: `# Q3 Financial Report

Revenue increased by 23% compared to Q2, driven primarily by enterprise client acquisitions. The quarterly performance exceeded expectations set at the beginning of the fiscal year.

## Key Performance Indicators:
• Total Revenue: $8.2M (up from $6.7M in Q2)
• Gross Margin: 72.4% (improvement of 2.1 percentage points)
• Operating Expenses: $3.1M (controlled growth of 8%)
• Net Income: $2.8M (34% margin)

## Enterprise Segment Analysis:
The enterprise segment showed exceptional growth with 47 new contracts signed. Average contract value increased by 18% to $45,000 annually. Customer retention in this segment remained strong at 96%.

## Regional Performance:
• North America: +28% YoY
• Europe: +19% YoY
• Asia Pacific: +34% YoY

The strong performance in Asia Pacific is attributed to our expanded sales presence in Singapore and Australia.`,
    uploadedAt: new Date(Date.now() - 86400000),
    folderId: "projects",
    folderPath: "/projects",
  },
  {
    id: "doc-customer-analysis",
    name: "customer_analysis.txt",
    type: "txt",
    size: 12300,
    content: `Customer Database Query Results:

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
    uploadedAt: new Date(Date.now() - 172800000),
    folderId: "research",
    folderPath: "/research",
  },
  {
    id: "doc-sales-summary-q3",
    name: "sales_summary.md",
    type: "md",
    size: 8750,
    content: `# Sales API Response - Real-time Metrics

Monthly Recurring Revenue (MRR): $2.4M
Annual Recurring Revenue (ARR): $28.8M
Year-over-Year Growth: 47%

## Pipeline Status:
• Qualified Leads: 423
• Opportunities: 187
• Proposals Sent: 89
• Closed Won (MTD): 34
• Closed Lost (MTD): 12

## Sales Team Performance:
• Average deal size: $12,400
• Sales cycle length: 32 days (down from 41 days)
• Win rate: 74%
• Quota attainment: 112%

## Revenue by Product:
• Core Platform: 68%
• Analytics Add-on: 18%
• Enterprise Features: 14%

## Forecast (Q4):
Expected revenue: $9.1M
Confidence level: High (based on pipeline coverage of 3.2x)`,
    uploadedAt: new Date(Date.now() - 259200000),
    folderId: "ai-project",
    folderPath: "/projects/ai",
  },
  {
    id: "4",
    name: "product_roadmap.md",
    type: "md",
    size: 45200,
    content: "# Product Roadmap 2024\n\n## Q1 Goals\n- Feature A...",
    uploadedAt: new Date(Date.now() - 345600000),
    folderId: "ai-project",
    folderPath: "/projects/ai",
  },
  {
    id: "5",
    name: "meeting_notes.txt",
    type: "txt",
    size: 3200,
    content: "Meeting Notes - Jan 15\n\nAttendees: John, Sarah...",
    uploadedAt: new Date(Date.now() - 432000000),
    folderId: "research",
    folderPath: "/research",
  },
]

export function useDocuments(currentFolderId: string | null = "root") {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter documents by current folder
  const filteredDocuments = documents.filter((doc) => doc.folderId === currentFolderId)

  const totalSize = filteredDocuments.reduce((acc, doc) => acc + doc.size, 0)

  const uploadFiles = useCallback(
    async (files: FileList | null, folderId: string | null = currentFolderId) => {
      if (!files) return

      const uploadPromises = Array.from(files).map(async (file) => {
        const validation = validateFile(file)
        if (!validation.valid) {
          toast.error(validation.error)
          return null
        }

        try {
          const extension = file.name.split(".").pop()?.toLowerCase() as "md" | "txt"
          const content = await readFileAsText(file)

          const newDoc: Document = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: sanitizeFilename(file.name),
            type: extension,
            size: file.size,
            content,
            uploadedAt: new Date(),
            folderId: folderId || "root",
            folderPath: "/", // This would be populated by the backend
          }
          return newDoc
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to read file")
          return null
        }
      })

      const results = await Promise.all(uploadPromises)
      const validDocs = results.filter((doc): doc is Document => doc !== null)

      if (validDocs.length > 0) {
        setDocuments((prev) => [...validDocs, ...prev])
      }
    },
    [currentFolderId]
  )

  const deleteDocument = useCallback(() => {
    if (documentToDelete) {
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentToDelete.id))
      setDocumentToDelete(null)
      setDeleteDialogOpen(false)
    }
  }, [documentToDelete])

  const openPreview = useCallback((doc: Document) => {
    setSelectedDocument(doc)
    setPreviewOpen(true)
  }, [])

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
  }, [])

  const confirmDelete = useCallback((doc: Document) => {
    setDocumentToDelete(doc)
    setDeleteDialogOpen(true)
  }, [])

  const cancelDelete = useCallback(() => {
    setDeleteDialogOpen(false)
    setDocumentToDelete(null)
  }, [])

  const downloadDocument = useCallback((doc: Document) => {
    const blob = new Blob([doc.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = sanitizeFilename(doc.name)
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      uploadFiles(e.dataTransfer.files)
    },
    [uploadFiles]
  )

  const moveDocument = useCallback((documentId: string, targetFolderId: string | null) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId
          ? { ...doc, folderId: targetFolderId || "root", folderPath: "/" }
          : doc
      )
    )
  }, [])

  const findDocumentById = useCallback(
    (documentId: string) => {
      return documents.find((doc) => doc.id === documentId) || null
    },
    [documents]
  )

  return {
    // State
    documents: filteredDocuments,
    allDocuments: documents,
    selectedDocument,
    previewOpen,
    deleteDialogOpen,
    documentToDelete,
    isDragging,
    fileInputRef,
    totalSize,

    // Actions
    uploadFiles,
    deleteDocument,
    openPreview,
    closePreview,
    confirmDelete,
    cancelDelete,
    downloadDocument,
    openFilePicker,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    moveDocument,
    findDocumentById,
  }
}

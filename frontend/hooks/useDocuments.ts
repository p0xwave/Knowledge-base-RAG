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
    id: "1",
    name: "Q3_Financial_Report.md",
    type: "md",
    size: 24500,
    content: "# Q3 Financial Report\n\nRevenue increased by 23% compared to Q2...",
    uploadedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "2",
    name: "customer_analysis.txt",
    type: "txt",
    size: 12300,
    content: "Customer Analysis\n\nTotal active customers: 12,450...",
    uploadedAt: new Date(Date.now() - 172800000),
  },
  {
    id: "3",
    name: "sales_summary.md",
    type: "md",
    size: 8750,
    content: "# Sales Summary\n\nMonthly recurring revenue: $2.4M...",
    uploadedAt: new Date(Date.now() - 259200000),
  },
  {
    id: "4",
    name: "product_roadmap.md",
    type: "md",
    size: 45200,
    content: "# Product Roadmap 2024\n\n## Q1 Goals\n- Feature A...",
    uploadedAt: new Date(Date.now() - 345600000),
  },
  {
    id: "5",
    name: "meeting_notes.txt",
    type: "txt",
    size: 3200,
    content: "Meeting Notes - Jan 15\n\nAttendees: John, Sarah...",
    uploadedAt: new Date(Date.now() - 432000000),
  },
]

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalSize = documents.reduce((acc, doc) => acc + doc.size, 0)

  const uploadFiles = useCallback(async (files: FileList | null) => {
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
  }, [])

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

  return {
    // State
    documents,
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
  }
}

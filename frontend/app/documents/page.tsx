"use client"

import type React from "react"
import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Upload,
  FileText,
  File,
  Search,
  MoreVertical,
  Trash2,
  Eye,
  Download,
  Clock,
  HardDrive,
  Plus,
  FolderOpen,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Loading from "./loading"
import { toast } from "sonner"

// File validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_EXTENSIONS = ["md", "txt"] as const
const ALLOWED_MIME_TYPES = ["text/plain", "text/markdown", "text/x-markdown"]

function validateFile(file: File): { valid: boolean; error?: string } {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File "${file.name}" exceeds 5MB limit` }
  }

  // Extension check
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension as typeof ALLOWED_EXTENSIONS[number])) {
    return { valid: false, error: "Only .md and .txt files are supported" }
  }

  // MIME type check (with fallback for .md files that may have empty type)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type) && file.type !== "") {
    return { valid: false, error: `Invalid file type: ${file.type}` }
  }

  return { valid: true }
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\.[\/\\]/g, "")  // path traversal
    .replace(/[\/\\]/g, "")       // slashes
    .replace(/[\x00-\x1f\x7f]/g, "") // control chars
    .slice(0, 255) || "download"
}

interface Document {
  id: string
  name: string
  type: "md" | "txt"
  size: number
  content: string
  uploadedAt: Date
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

export default function DocumentsPage() {
  const searchParams = useSearchParams()
  const [documents, setDocuments] = useState<Document[]>(mockDocuments)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalSize = documents.reduce((acc, doc) => acc + doc.size, 0)

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsText(file)
    })
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return

    const uploadPromises = Array.from(files).map(async (file) => {
      // Validate file
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
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleDelete = () => {
    if (documentToDelete) {
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentToDelete.id))
      setDocumentToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  const handlePreview = (doc: Document) => {
    setSelectedDocument(doc)
    setPreviewOpen(true)
  }

  const handleDownload = (doc: Document) => {
    const blob = new Blob([doc.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = sanitizeFilename(doc.name)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go back to chat">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50" aria-label="Back to chat">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Documents</h1>
              <p className="text-sm text-muted-foreground">
                Upload and manage your knowledge base
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
              aria-label="Upload new document"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl bg-muted/30 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{documents.length}</p>
                    <p className="text-sm text-muted-foreground">Documents</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-muted/30 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    <HardDrive className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{formatFileSize(totalSize)}</p>
                    <p className="text-sm text-muted-foreground">Total size</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-muted/30 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Clock className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">
                      {documents.length > 0 ? formatDate(documents[0].uploadedAt) : "N/A"}
                    </p>
                    <p className="text-sm text-muted-foreground">Last upload</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "rounded-2xl border-2 border-dashed p-8 mb-6 text-center transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20 hover:border-muted-foreground/40"
              )}
              role="region"
              aria-label="File upload area"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Drop files here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports .md and .txt files
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-2 bg-transparent"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select files
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4" role="search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                  aria-label="Search documents"
                />
              </div>
            </div>

            {/* Documents List */}
            <ScrollArea className="flex-1" role="region" aria-label="Documents list">
              {filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    {searchQuery ? "No documents found" : "No documents yet"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchQuery
                      ? "Try a different search term"
                      : "Upload your first document to get started"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredDocuments.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      document={doc}
                      onPreview={handlePreview}
                      onDownload={handleDownload}
                      onDelete={(doc) => {
                        setDocumentToDelete(doc)
                        setDeleteDialogOpen(true)
                      }}
                      formatFileSize={formatFileSize}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedDocument?.name}
              </DialogTitle>
              <DialogDescription>
                {selectedDocument && formatFileSize(selectedDocument.size)} • Uploaded{" "}
                {selectedDocument && formatDate(selectedDocument.uploadedAt)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] mt-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono bg-muted/30 rounded-xl p-4">
                {selectedDocument?.content}
              </pre>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)} className="bg-transparent">
                Close
              </Button>
              {selectedDocument && (
                <Button onClick={() => handleDownload(selectedDocument)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete document</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{documentToDelete?.name}"? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="bg-transparent">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Suspense>
  )
}

interface DocumentRowProps {
  document: Document
  onPreview: (doc: Document) => void
  onDownload: (doc: Document) => void
  onDelete: (doc: Document) => void
  formatFileSize: (bytes: number) => string
  formatDate: (date: Date) => string
}

function DocumentRow({
  document,
  onPreview,
  onDownload,
  onDelete,
  formatFileSize,
  formatDate,
}: DocumentRowProps) {
  const Icon = document.type === "md" ? FileText : File

  const typeColors = {
    md: "bg-blue-500/10 text-blue-500",
    txt: "bg-emerald-500/10 text-emerald-500",
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors group">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          typeColors[document.type]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{document.name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/50 border-0">
            {document.type.toUpperCase()}
          </Badge>
          <span>{formatFileSize(document.size)}</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDate(document.uploadedAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={() => onPreview(document)}
          aria-label={`Preview ${document.name}`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          onClick={() => onDownload(document)}
          aria-label={`Download ${document.name}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              aria-label={`More actions for ${document.name}`}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(document)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(document)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(document)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

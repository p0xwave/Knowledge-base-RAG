"use client"

import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { DocumentRow, UploadArea, DocumentStats } from "@/components/documents"
import { ThemeToggle } from "@/components/theme-toggle"
import { useDocuments } from "@/hooks/useDocuments"
import { useSearch } from "@/hooks/useSearch"
import { useDateFormat } from "@/hooks/useDateFormat"
import { ArrowLeft, FileText, Search, Plus, FolderOpen, Download } from "lucide-react"
import Loading from "./loading"

export default function DocumentsPage() {
  const {
    documents,
    selectedDocument,
    previewOpen,
    deleteDialogOpen,
    documentToDelete,
    isDragging,
    fileInputRef,
    totalSize,
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
  } = useDocuments()

  const { searchQuery, setSearchQuery, filteredItems } = useSearch(
    documents,
    (doc, query) => doc.name.toLowerCase().includes(query)
  )

  const { formatRelativeDate, formatFileSize } = useDateFormat()

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go back to chat">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-muted/50"
                aria-label="Back to chat"
              >
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
            <Button onClick={openFilePicker} className="gap-2" aria-label="Upload new document">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              multiple
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            {/* Stats */}
            <DocumentStats
              documentCount={documents.length}
              totalSize={formatFileSize(totalSize)}
              lastUpload={documents.length > 0 ? formatRelativeDate(documents[0].uploadedAt) : "N/A"}
            />

            {/* Upload Area */}
            <UploadArea
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onBrowse={openFilePicker}
            />

            {/* Search */}
            <div className="mb-4" role="search">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
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
              {filteredItems.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title={searchQuery ? "No documents found" : "No documents yet"}
                  description={
                    searchQuery
                      ? "Try a different search term"
                      : "Upload your first document to get started"
                  }
                  className="py-16"
                  iconClassName="h-16 w-16 rounded-2xl mb-4"
                />
              ) : (
                <div className="space-y-1">
                  {filteredItems.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      document={doc}
                      onPreview={openPreview}
                      onDownload={downloadDocument}
                      onDelete={confirmDelete}
                      formatFileSize={formatFileSize}
                      formatDate={formatRelativeDate}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={closePreview}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedDocument?.name}
              </DialogTitle>
              <DialogDescription>
                {selectedDocument && formatFileSize(selectedDocument.size)} • Uploaded{" "}
                {selectedDocument && formatRelativeDate(selectedDocument.uploadedAt)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] mt-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono bg-muted/30 rounded-xl p-4">
                {selectedDocument?.content}
              </pre>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={closePreview} className="bg-transparent">
                Close
              </Button>
              {selectedDocument && (
                <Button onClick={() => downloadDocument(selectedDocument)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={cancelDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete document</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDelete} className="bg-transparent">
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteDocument}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Suspense>
  )
}

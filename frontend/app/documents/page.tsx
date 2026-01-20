"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
import {
  DocumentRow,
  FolderRow,
  UploadArea,
  DocumentStats,
  FolderTree,
  FolderBreadcrumb,
} from "@/components/documents"
import { ThemeToggle } from "@/components/theme-toggle"
import { useDocuments, type Document } from "@/hooks/useDocuments"
import { useSearch } from "@/hooks/useSearch"
import { useDateFormat } from "@/hooks/useDateFormat"
import {
  useFolderStore,
  selectCurrentFolder,
  type Folder,
} from "@/lib/store/folder-store"
import { ArrowLeft, FileText, Search, Plus, FolderOpen, Download } from "lucide-react"
import { toast } from "sonner"
import Loading from "./loading"

export default function DocumentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const documentIdFromUrl = searchParams.get("id")
  const hasProcessedDocId = useRef(false)

  const folders = useFolderStore((s) => s.folders)
  const currentFolderId = useFolderStore((s) => s.currentFolderId)
  const currentFolder = useFolderStore(selectCurrentFolder)
  const updateFolder = useFolderStore((s) => s.updateFolder)
  const deleteFolder = useFolderStore((s) => s.deleteFolder)
  const setCurrentFolder = useFolderStore((s) => s.setCurrentFolder)

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
    renameDocument,
    openPreview,
    closePreview,
    confirmDelete,
    cancelDelete,
    downloadDocument,
    openFilePicker,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    findDocumentById,
  } = useDocuments(currentFolderId)

  // Handle document ID from URL (only once)
  useEffect(() => {
    if (documentIdFromUrl && !hasProcessedDocId.current) {
      hasProcessedDocId.current = true
      const doc = findDocumentById(documentIdFromUrl)
      if (doc) {
        // Set current folder to document's folder
        if (doc.folderId && doc.folderId !== currentFolderId) {
          setCurrentFolder(doc.folderId)
        }
        // Open preview after a short delay to ensure folder is set
        setTimeout(() => {
          openPreview(doc)
          // Clear the URL parameter after opening
          router.replace("/documents", { scroll: false })
        }, 100)
      } else {
        // Document not found, clear the parameter
        router.replace("/documents", { scroll: false })
      }
    }
  }, [documentIdFromUrl, findDocumentById, openPreview, setCurrentFolder, currentFolderId, router])

  // Folder dialogs state
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false)
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false)
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null)
  const [newFolderName, setNewFolderName] = useState("")

  // Document rename dialog state
  const [renameDocumentDialogOpen, setRenameDocumentDialogOpen] = useState(false)
  const [documentToRename, setDocumentToRename] = useState<Document | null>(null)
  const [newDocumentName, setNewDocumentName] = useState("")

  // Get child folders of current folder
  const childFolders = folders.filter((f) => f.parentId === currentFolderId)

  const { searchQuery, setSearchQuery, filteredItems } = useSearch(documents, (doc, query) =>
    doc.name.toLowerCase().includes(query)
  )

  const { formatRelativeDate, formatFileSize } = useDateFormat()

  // Folder actions
  const handleRenameFolder = (folder: Folder) => {
    setFolderToEdit(folder)
    setNewFolderName(folder.name)
    setRenameFolderDialogOpen(true)
  }

  const handleDeleteFolder = (folder: Folder) => {
    setFolderToEdit(folder)
    setDeleteFolderDialogOpen(true)
  }

  const confirmRenameFolder = () => {
    if (folderToEdit && newFolderName.trim() && newFolderName !== folderToEdit.name) {
      updateFolder(folderToEdit.id, newFolderName.trim())
      toast.success("Folder renamed")
    }
    setRenameFolderDialogOpen(false)
    setFolderToEdit(null)
    setNewFolderName("")
  }

  const confirmDeleteFolder = () => {
    if (folderToEdit) {
      deleteFolder(folderToEdit.id)
      toast.success("Folder deleted")
    }
    setDeleteFolderDialogOpen(false)
    setFolderToEdit(null)
  }

  const cancelFolderAction = () => {
    setRenameFolderDialogOpen(false)
    setDeleteFolderDialogOpen(false)
    setFolderToEdit(null)
    setNewFolderName("")
  }

  // Document rename actions
  const handleRenameDocument = (doc: Document) => {
    setDocumentToRename(doc)
    setNewDocumentName(doc.name)
    setRenameDocumentDialogOpen(true)
  }

  const confirmRenameDocument = () => {
    if (documentToRename && newDocumentName.trim() && newDocumentName !== documentToRename.name) {
      renameDocument(documentToRename.id, newDocumentName.trim())
      toast.success("Document renamed")
    }
    setRenameDocumentDialogOpen(false)
    setDocumentToRename(null)
    setNewDocumentName("")
  }

  const cancelRenameDocument = () => {
    setRenameDocumentDialogOpen(false)
    setDocumentToRename(null)
    setNewDocumentName("")
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="bg-background flex h-screen flex-col">
        {/* Header */}
        <header className="border-border/50 flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go back to chat">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted/50 h-8 w-8"
                aria-label="Back to chat"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <div>
              <h1 className="text-foreground text-xl font-semibold">Documents</h1>
              <p className="text-muted-foreground text-sm">
                {currentFolder?.name || "All Documents"} - {documents.length} documents
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
        <div className="flex flex-1 overflow-hidden">
          {/* Folder Sidebar */}
          <div className="border-border/50 w-64 shrink-0 border-r">
            <div className="flex h-full flex-col p-4">
              <FolderTree />
            </div>
          </div>

          {/* Documents Area */}
          <div className="flex-1 overflow-hidden p-6">
            <div className="mx-auto flex h-full max-w-4xl flex-col">
            {/* Stats */}
            <DocumentStats
              documentCount={documents.length}
              totalSize={formatFileSize(totalSize)}
              lastUpload={
                documents.length > 0 ? formatRelativeDate(documents[0].uploadedAt) : "N/A"
              }
            />

            {/* Breadcrumb */}
            <FolderBreadcrumb />

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
                  className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted/30 focus-visible:ring-primary/30 border-0 pl-9 focus-visible:ring-1"
                  aria-label="Search documents"
                />
              </div>
            </div>

            {/* Documents List */}
            <ScrollArea className="flex-1" role="region" aria-label="Documents list">
              {!searchQuery && childFolders.length === 0 && filteredItems.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No documents yet"
                  description="Upload your first document to get started"
                  className="py-16"
                  iconClassName="h-16 w-16 rounded-2xl mb-4"
                />
              ) : searchQuery && filteredItems.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No documents found"
                  description="Try a different search term"
                  className="py-16"
                  iconClassName="h-16 w-16 rounded-2xl mb-4"
                />
              ) : (
                <div className="space-y-1">
                  {/* Show folders first (only when not searching) */}
                  {!searchQuery &&
                    childFolders.map((folder) => (
                      <FolderRow
                        key={folder.id}
                        folder={folder}
                        onRename={handleRenameFolder}
                        onDelete={handleDeleteFolder}
                        formatDate={formatRelativeDate}
                      />
                    ))}

                  {/* Then show documents */}
                  {filteredItems.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      document={doc}
                      onPreview={openPreview}
                      onDownload={downloadDocument}
                      onRename={handleRenameDocument}
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
        </div>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={closePreview}>
          <DialogContent className="max-h-[80vh] max-w-2xl">
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
            <ScrollArea className="mt-4 max-h-[50vh]">
              <pre className="text-foreground bg-muted/30 rounded-xl p-4 font-mono text-sm whitespace-pre-wrap">
                {selectedDocument?.content}
              </pre>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={closePreview} className="bg-transparent">
                Close
              </Button>
              {selectedDocument && (
                <Button onClick={() => downloadDocument(selectedDocument)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Document Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={cancelDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete document</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{documentToDelete?.name}&quot;? This action
                cannot be undone.
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

        {/* Rename Folder Dialog */}
        <Dialog open={renameFolderDialogOpen} onOpenChange={cancelFolderAction}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename folder</DialogTitle>
              <DialogDescription>Enter a new name for the folder.</DialogDescription>
            </DialogHeader>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRenameFolder()
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={cancelFolderAction} className="bg-transparent">
                Cancel
              </Button>
              <Button onClick={confirmRenameFolder} disabled={!newFolderName.trim()}>
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Folder Dialog */}
        <Dialog open={deleteFolderDialogOpen} onOpenChange={cancelFolderAction}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete folder</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{folderToEdit?.name}&quot;? This will also
                delete all subfolders and documents inside. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={cancelFolderAction} className="bg-transparent">
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteFolder}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Document Dialog */}
        <Dialog open={renameDocumentDialogOpen} onOpenChange={cancelRenameDocument}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename document</DialogTitle>
              <DialogDescription>Enter a new name for the document.</DialogDescription>
            </DialogHeader>
            <Input
              value={newDocumentName}
              onChange={(e) => setNewDocumentName(e.target.value)}
              placeholder="Document name"
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRenameDocument()
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={cancelRenameDocument} className="bg-transparent">
                Cancel
              </Button>
              <Button onClick={confirmRenameDocument} disabled={!newDocumentName.trim()}>
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Suspense>
  )
}

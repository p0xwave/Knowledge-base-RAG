"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileText, File, MoreVertical, Trash2, Eye, Download } from "lucide-react"
import { FILE_EXTENSION_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { Document } from "@/hooks/useDocuments"

interface DocumentRowProps {
  document: Document
  onPreview: (doc: Document) => void
  onDownload: (doc: Document) => void
  onDelete: (doc: Document) => void
  formatFileSize: (bytes: number) => string
  formatDate: (date: Date) => string
}

export function DocumentRow({
  document,
  onPreview,
  onDownload,
  onDelete,
  formatFileSize,
  formatDate,
}: DocumentRowProps) {
  const Icon = document.type === "md" ? FileText : File
  const colorClass = FILE_EXTENSION_COLORS[document.type] || FILE_EXTENSION_COLORS.md

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors group">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          colorClass
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

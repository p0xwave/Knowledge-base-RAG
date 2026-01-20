"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileText, File, MoreVertical, Trash2, Eye, Download, Edit } from "lucide-react"
import { FILE_EXTENSION_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { Document } from "@/hooks/useDocuments"

interface DocumentRowProps {
  document: Document
  onPreview: (doc: Document) => void
  onDownload: (doc: Document) => void
  onRename: (doc: Document) => void
  onDelete: (doc: Document) => void
  formatFileSize: (bytes: number) => string
  formatDate: (date: Date) => string
}

export function DocumentRow({
  document,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  formatFileSize,
  formatDate,
}: DocumentRowProps) {
  const Icon = document.type === "md" ? FileText : File
  const colorClass = FILE_EXTENSION_COLORS[document.type] || FILE_EXTENSION_COLORS.md

  return (
    <div className="hover:bg-muted/30 group flex items-center gap-4 rounded-xl p-3 transition-colors">
      <div
        className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", colorClass)}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">{document.name}</p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="bg-muted/50 border-0 px-1.5 py-0 text-[10px]">
            {document.type.toUpperCase()}
          </Badge>
          <span>{formatFileSize(document.size)}</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDate(document.uploadedAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8"
          onClick={() => onPreview(document)}
          aria-label={`Preview ${document.name}`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8"
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
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8"
              aria-label={`More actions for ${document.name}`}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(document)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(document)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(document)}>
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(document)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

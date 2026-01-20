"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Folder, MoreVertical, Edit, Trash2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Folder as FolderType } from "@/lib/store/folder-store"
import { useFolderStore } from "@/lib/store/folder-store"

interface FolderRowProps {
  folder: FolderType
  onRename: (folder: FolderType) => void
  onDelete: (folder: FolderType) => void
  formatDate: (date: Date) => string
}

export function FolderRow({ folder, onRename, onDelete, formatDate }: FolderRowProps) {
  const setCurrentFolder = useFolderStore((s) => s.setCurrentFolder)

  const handleOpen = () => {
    setCurrentFolder(folder.id)
  }

  return (
    <div
      className="hover:bg-muted/30 group flex cursor-pointer items-center gap-4 rounded-xl p-3 transition-colors"
      onClick={handleOpen}
    >
      <div
        className={cn(
          "bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        )}
      >
        <Folder className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">{folder.name}</p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="bg-muted/50 border-0 px-1.5 py-0 text-[10px]">
            FOLDER
          </Badge>
          <span>
            {folder.documentCount} {folder.documentCount === 1 ? "document" : "documents"}
          </span>
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDate(folder.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        {folder.id !== "root" && (
          <div
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 w-8"
                  aria-label={`More actions for ${folder.name}`}
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onRename(folder)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(folder)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}

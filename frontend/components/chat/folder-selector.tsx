"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useFolderStore, type Folder } from "@/lib/store/folder-store"
import { useChatStore } from "@/lib/store/chat-store"
import { FolderOpen, FolderClosed, Check, Database } from "lucide-react"

interface FolderCheckboxItemProps {
  folder: Folder
  isSelected: boolean
  onToggle: (folderId: string) => void
  level?: number
}

function FolderCheckboxItem({
  folder,
  isSelected,
  onToggle,
  level = 0,
}: FolderCheckboxItemProps) {
  const allFolders = useFolderStore((s) => s.folders)
  const selectedFolderIds = useChatStore((s) => s.selectedFolderIds)

  const children = React.useMemo(
    () => allFolders.filter((f) => f.parentId === folder.id),
    [allFolders, folder.id]
  )

  // Recursively get all descendant folder IDs
  const getAllDescendantIds = React.useCallback((folderId: string): string[] => {
    const directChildren = allFolders.filter((f) => f.parentId === folderId)
    return [
      ...directChildren.map((c) => c.id),
      ...directChildren.flatMap((c) => getAllDescendantIds(c.id)),
    ]
  }, [allFolders])

  // Check if folder has children and calculate their selection state
  const hasChildren = children.length > 0
  const descendantIds = React.useMemo(
    () => (hasChildren ? getAllDescendantIds(folder.id) : []),
    [hasChildren, folder.id, getAllDescendantIds]
  )

  const selectedDescendants = React.useMemo(
    () => descendantIds.filter((id) => selectedFolderIds.includes(id)),
    [descendantIds, selectedFolderIds]
  )

  // Determine checkbox state
  const isIndeterminate = hasChildren && selectedDescendants.length > 0 && selectedDescendants.length < descendantIds.length
  const isFullySelected = hasChildren ? selectedDescendants.length === descendantIds.length && descendantIds.length > 0 : isSelected

  return (
    <>
      <div
        className={cn(
          "hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors border",
          isFullySelected && "bg-primary/10 border-transparent",
          isIndeterminate && "bg-primary/5 border-dashed border-primary/30",
          !isFullySelected && !isIndeterminate && "border-transparent"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <Checkbox
          checked={isFullySelected || isIndeterminate}
          indeterminate={isIndeterminate || undefined}
          onCheckedChange={() => onToggle(folder.id)}
          className="cursor-pointer"
        />
        <div
          className="flex flex-1 items-center gap-2 cursor-pointer"
          onClick={() => onToggle(folder.id)}
        >
          {isFullySelected ? (
            <FolderOpen className="text-primary h-4 w-4 shrink-0" />
          ) : isIndeterminate ? (
            <FolderOpen className="text-primary/70 h-4 w-4 shrink-0" />
          ) : (
            <FolderClosed className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
          <span
            className={cn(
              "flex-1 truncate text-sm",
              isFullySelected && "text-foreground font-medium",
              isIndeterminate && "text-foreground/90",
              !isFullySelected && !isIndeterminate && "text-foreground"
            )}
          >
            {folder.name}
          </span>
          <span className="text-muted-foreground text-xs">{folder.documentCount}</span>
        </div>
      </div>

      {children.map((child) => (
        <FolderCheckboxItem
          key={child.id}
          folder={child}
          isSelected={selectedFolderIds.includes(child.id)}
          onToggle={onToggle}
          level={level + 1}
        />
      ))}
    </>
  )
}

interface FolderSelectorProps {
  variant?: "default" | "large"
}

export function FolderSelector({ variant = "default" }: FolderSelectorProps) {
  const [open, setOpen] = useState(false)
  const folders = useFolderStore((s) => s.folders)
  const selectedFolderIds = useChatStore((s) => s.selectedFolderIds)
  const setSelectedFolders = useChatStore((s) => s.setSelectedFolders)
  const clearFolderSelection = useChatStore((s) => s.clearFolderSelection)

  const isLarge = variant === "large"

  // Recursively get all descendant folder IDs
  const getAllDescendantIds = React.useCallback((folderId: string): string[] => {
    const directChildren = folders.filter((f) => f.parentId === folderId)
    return [
      ...directChildren.map((c) => c.id),
      ...directChildren.flatMap((c) => getAllDescendantIds(c.id)),
    ]
  }, [folders])

  // Handle folder toggle with parent-child synchronization
  const handleToggle = React.useCallback((folderId: string) => {
    const descendantIds = getAllDescendantIds(folderId)
    const allRelatedIds = [folderId, ...descendantIds]

    // Check if folder is currently selected (or partially selected)
    const selectedDescendants = descendantIds.filter((id) => selectedFolderIds.includes(id))
    const isFullySelected = selectedDescendants.length === descendantIds.length && descendantIds.length > 0
    const isFolderSelected = selectedFolderIds.includes(folderId)

    if (isFullySelected || (isFolderSelected && descendantIds.length === 0)) {
      // If fully selected or is a leaf folder that's selected, deselect all
      setSelectedFolders(selectedFolderIds.filter((id) => !allRelatedIds.includes(id)))
    } else {
      // Otherwise, select all (folder + descendants)
      const newSelection = new Set([...selectedFolderIds, ...allRelatedIds])
      setSelectedFolders(Array.from(newSelection))
    }
  }, [folders, selectedFolderIds, getAllDescendantIds, setSelectedFolders])

  const rootFolders = folders.filter((f) => f.id === "root")
  const isAllSelected = selectedFolderIds.length === 0

  const selectedFolders = folders.filter((f) => selectedFolderIds.includes(f.id))

  const handleSelectAll = () => {
    clearFolderSelection()
  }

  const getSearchScopeText = () => {
    if (isAllSelected) {
      return "All folders"
    }
    if (selectedFolders.length === 1) {
      return selectedFolders[0].name
    }
    return `${selectedFolders.length} folders`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={isLarge ? "default" : "sm"}
          className={cn(
            "border-dashed transition-colors",
            isLarge
              ? "h-10 gap-2.5 px-4"
              : "h-8 gap-2",
            isLarge
              ? "hover:bg-muted/70"
              : "hover:bg-muted/70",
            !isAllSelected && "border-primary/50 bg-primary/5"
          )}
        >
          <Database className={cn(isLarge ? "h-4 w-4" : "h-3.5 w-3.5")} />
          <span className={cn("font-medium", isLarge ? "text-sm" : "text-xs")}>
            {isLarge ? `Search in: ${getSearchScopeText()}` : getSearchScopeText()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align={isLarge ? "center" : "start"}>
        <div className="flex items-center justify-between p-3">
          <div>
            <h4 className="text-foreground text-sm font-semibold">Search Scope</h4>
            <p className="text-muted-foreground text-xs">
              Select folders to search in
            </p>
          </div>
          {!isAllSelected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-7 text-xs"
            >
              Clear
            </Button>
          )}
        </div>

        <Separator />

        <div className="p-2">
          <div
            className={cn(
              "hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
              isAllSelected && "bg-primary/10"
            )}
          >
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              className="cursor-pointer"
            />
            <div
              className="flex flex-1 items-center gap-2 cursor-pointer"
              onClick={handleSelectAll}
            >
              <Database className="text-primary h-4 w-4 shrink-0" />
              <span className="text-foreground flex-1 text-sm font-medium">
                All Documents
              </span>
              {isAllSelected && <Check className="text-primary h-4 w-4" />}
            </div>
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-64">
          <div className="space-y-0.5 p-2">
            {rootFolders.map((folder) => {
              const children = folders.filter((f) => f.parentId === folder.id)
              return (
                <div key={folder.id} className="space-y-0.5">
                  {children.map((child) => (
                    <FolderCheckboxItem
                      key={child.id}
                      folder={child}
                      isSelected={selectedFolderIds.includes(child.id)}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <Separator />

        <div className="bg-muted/30 p-2">
          <p className="text-muted-foreground text-xs">
            {isAllSelected
              ? "Searching across all folders"
              : `Searching in ${selectedFolders.length} selected ${selectedFolders.length === 1 ? "folder" : "folders"}`}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

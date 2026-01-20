"use client"

import { useFolderStore } from "@/lib/store/folder-store"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

export function FolderBreadcrumb() {
  const folders = useFolderStore((s) => s.folders)
  const currentFolderId = useFolderStore((s) => s.currentFolderId)
  const setCurrentFolder = useFolderStore((s) => s.setCurrentFolder)

  // Build breadcrumb trail
  const breadcrumbs: Array<{ id: string; name: string }> = []
  let folderId = currentFolderId

  while (folderId) {
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) break

    breadcrumbs.unshift({ id: folder.id, name: folder.name })

    if (folder.id === "root") break
    folderId = folder.parentId
  }

  // If no breadcrumbs, add root
  if (breadcrumbs.length === 0) {
    breadcrumbs.push({ id: "root", name: "All Documents" })
  }

  return (
    <div className="mb-4 flex items-center gap-1.5 overflow-x-auto">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1
        const isRoot = crumb.id === "root"

        return (
          <div key={crumb.id} className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setCurrentFolder(crumb.id)}
              disabled={isLast}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
                isLast
                  ? "text-foreground cursor-default font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {isRoot && <Home className="h-3.5 w-3.5" />}
              <span className="max-w-[120px] truncate sm:max-w-[200px]">{crumb.name}</span>
            </button>
            {!isLast && (
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

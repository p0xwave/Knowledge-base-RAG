import { create } from "zustand"
import { devtools } from "zustand/middleware"

export interface Folder {
  id: string
  name: string
  path: string
  parentId: string | null
  createdAt: Date
  documentCount: number
}

interface FolderState {
  folders: Folder[]
  currentFolderId: string | null
  expandedFolders: string[]
}

interface FolderActions {
  createFolder: (name: string, parentId?: string | null) => void
  updateFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  moveFolder: (id: string, targetParentId: string | null) => void
  setCurrentFolder: (id: string | null) => void
  toggleFolderExpanded: (id: string) => void
  incrementDocumentCount: (folderId: string | null) => void
  decrementDocumentCount: (folderId: string | null) => void
}

type FolderStore = FolderState & FolderActions

// Mock initial folders
const mockFolders: Folder[] = [
  {
    id: "root",
    name: "All Documents",
    path: "/",
    parentId: null,
    createdAt: new Date(),
    documentCount: 5,
  },
  {
    id: "projects",
    name: "Projects",
    path: "/projects",
    parentId: "root",
    createdAt: new Date(Date.now() - 86400000 * 7),
    documentCount: 2,
  },
  {
    id: "research",
    name: "Research",
    path: "/research",
    parentId: "root",
    createdAt: new Date(Date.now() - 86400000 * 5),
    documentCount: 1,
  },
  {
    id: "ai-project",
    name: "AI",
    path: "/projects/ai",
    parentId: "projects",
    createdAt: new Date(Date.now() - 86400000 * 3),
    documentCount: 1,
  },
]

function buildPath(folders: Folder[], folderId: string): string {
  const folder = folders.find((f) => f.id === folderId)
  if (!folder || !folder.parentId) return "/"

  const parent = folders.find((f) => f.id === folder.parentId)
  if (!parent || parent.id === "root") return `/${folder.name}`

  return `${buildPath(folders, parent.id)}/${folder.name}`
}

export const useFolderStore = create<FolderStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      folders: mockFolders,
      currentFolderId: "root",
      expandedFolders: ["root", "projects"],

      // Actions
      createFolder: (name, parentId = "root") => {
        const id = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const folders = get().folders
        const path = parentId ? `${buildPath(folders, parentId)}/${name}` : `/${name}`

        const newFolder: Folder = {
          id,
          name,
          path,
          parentId: parentId || "root",
          createdAt: new Date(),
          documentCount: 0,
        }

        set((state) => ({
          folders: [...state.folders, newFolder],
        }))
      },

      updateFolder: (id, name) => {
        set((state) => {
          const folders = state.folders.map((f) => {
            if (f.id === id) {
              const parentPath =
                f.parentId && f.parentId !== "root" ? buildPath(state.folders, f.parentId) : ""
              return {
                ...f,
                name,
                path: parentPath ? `${parentPath}/${name}` : `/${name}`,
              }
            }
            return f
          })

          // Update paths of all children
          const updatedFolders = folders.map((f) => {
            if (f.parentId === id) {
              return {
                ...f,
                path: buildPath(folders, f.id),
              }
            }
            return f
          })

          return { folders: updatedFolders }
        })
      },

      deleteFolder: (id) => {
        set((state) => {
          // Recursively get all folder IDs to delete (folder + all descendants)
          const getDescendantIds = (folderId: string): string[] => {
            const children = state.folders.filter((f) => f.parentId === folderId)
            return [
              folderId,
              ...children.flatMap((child) => getDescendantIds(child.id)),
            ]
          }

          const idsToDelete = getDescendantIds(id)
          return {
            folders: state.folders.filter((f) => !idsToDelete.includes(f.id)),
            currentFolderId:
              state.currentFolderId && idsToDelete.includes(state.currentFolderId)
                ? "root"
                : state.currentFolderId,
          }
        })
      },

      moveFolder: (id, targetParentId) => {
        set((state) => ({
          folders: state.folders.map((f) => {
            if (f.id === id) {
              const newPath = targetParentId
                ? `${buildPath(state.folders, targetParentId)}/${f.name}`
                : `/${f.name}`
              return {
                ...f,
                parentId: targetParentId || "root",
                path: newPath,
              }
            }
            return f
          }),
        }))
      },

      setCurrentFolder: (id) => {
        set({ currentFolderId: id })
      },

      toggleFolderExpanded: (id) => {
        set((state) => {
          const isExpanded = state.expandedFolders.includes(id)
          return {
            expandedFolders: isExpanded
              ? state.expandedFolders.filter((folderId) => folderId !== id)
              : [...state.expandedFolders, id],
          }
        })
      },

      incrementDocumentCount: (folderId) => {
        if (!folderId) folderId = "root"
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId ? { ...f, documentCount: f.documentCount + 1 } : f
          ),
        }))
      },

      decrementDocumentCount: (folderId) => {
        if (!folderId) folderId = "root"
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId
              ? { ...f, documentCount: Math.max(0, f.documentCount - 1) }
              : f
          ),
        }))
      },
    }),
    { name: "folder-store" }
  )
)

// Selectors
export const selectFolders = (state: FolderStore) => state.folders
export const selectCurrentFolderId = (state: FolderStore) => state.currentFolderId
export const selectExpandedFolders = (state: FolderStore) => state.expandedFolders
export const selectCurrentFolder = (state: FolderStore) =>
  state.folders.find((f) => f.id === state.currentFolderId) || null

// Helper to get children of a folder
export const selectFolderChildren = (folderId: string) => (state: FolderStore) =>
  state.folders.filter((f) => f.parentId === folderId)

// Helper to get folder by id
export const selectFolderById = (id: string) => (state: FolderStore) =>
  state.folders.find((f) => f.id === id) || null

# Folder-Based Document Organization System

This document describes the newly implemented folder system for organizing documents and enabling selective RAG search.

## Overview

Documents can now be organized into folders, and users can select specific folders to search when querying the RAG system.

## Features

### 1. Folder Management (Documents Page)

- **Folder Tree Sidebar**: View and navigate all folders in a hierarchical tree structure
- **Create Folders**: Create new folders and subfolders to organize documents
- **Rename/Delete Folders**: Manage existing folders with context menu options
- **Folder Statistics**: See document count for each folder
- **Document Upload**: Upload documents directly to the current folder

### 2. Selective RAG Search (Chat Page)

- **Folder Selector**: Button in chat header to select which folders to search
- **Search Modes**:
  - **All Folders**: Default mode - searches across all documents
  - **Specific Folders**: Select one or more folders to limit search scope
- **Visual Indicators**: Badge showing number of selected folders

## Implementation Details

### Type Definitions

**`types/api.ts`**:
- Added `Folder` interface with path and parent/child relationships
- Extended `DocumentListItem` with `folderId` and `folderPath`
- Added `folderIds` to `SendMessageRequest` for RAG filtering

### State Management

**`lib/store/folder-store.ts`**:
- Zustand store managing folder hierarchy
- Actions: create, update, delete, move folders
- Selectors for efficient component updates

**`lib/store/chat-store.ts`**:
- Added `selectedFolderIds` state
- Actions: `setSelectedFolders`, `toggleFolderSelection`, `clearFolderSelection`
- Empty array = search all folders

### Components

**`components/documents/folder-tree.tsx`**:
- Hierarchical folder tree with expand/collapse
- Inline editing, context menu for actions
- Visual feedback for current folder

**`components/chat/folder-selector.tsx`**:
- Popover with folder checkboxes
- "All Documents" option to search everything
- Shows selected folder count

### Updated Pages

**`app/documents/page.tsx`**:
- Added folder sidebar (256px width)
- Documents filtered by current folder
- Upload targets current folder by default

**`components/chat/chat-header.tsx`**:
- Integrated `FolderSelector` component
- Displays current search scope

## Usage

### For Users

#### Managing Folders:
1. Go to Documents page (`/documents`)
2. Use the folder tree sidebar to:
   - Click "+" to create a new folder
   - Click folder name to view its documents
   - Right-click folder for options (rename, delete)
   - Drag & drop documents between folders (future enhancement)

#### Searching with Folders:
1. In the chat interface, click the "Search: All folders" button
2. Select specific folders to limit your search scope
3. Click "Clear" to search all folders again
4. Ask your question - RAG will only search selected folders

### For Backend Integration

When the backend receives a chat message:

```typescript
interface SendMessageRequest {
  conversationId?: string
  content: string
  parentMessageId?: string
  folderIds?: string[] // <-- New field
}
```

**Backend should**:
- If `folderIds` is empty/undefined: search all documents
- If `folderIds` has values: only search documents in those folders (including subfolders)

## Mock Data Structure

```typescript
// Sample folder structure
/                          (root)
├── Projects/              (id: "projects")
│   └── AI/               (id: "ai-project")
└── Research/             (id: "research")

// Sample documents with folder assignment
{
  id: "4",
  name: "product_roadmap.md",
  folderId: "ai-project",
  folderPath: "/projects/ai"
}
```

## Future Enhancements

1. **Drag & Drop**: Move documents between folders via drag & drop
2. **Folder Search**: Search within folder tree
3. **Folder Icons**: Custom icons for different folder types
4. **Bulk Operations**: Select multiple documents to move
5. **Folder Permissions**: Access control for sensitive folders
6. **Smart Folders**: Auto-organize based on tags or content
7. **Breadcrumb Navigation**: Show folder path in documents view

## API Endpoints (Backend TODO)

```typescript
// Folders API
GET    /api/folders              // List all folders
POST   /api/folders              // Create folder
PUT    /api/folders/:id          // Update folder
DELETE /api/folders/:id          // Delete folder (and all contents)
POST   /api/folders/:id/move     // Move folder to new parent

// Documents API Updates
GET    /api/documents?folderId=:id  // Get documents in folder
POST   /api/documents               // Upload (with folderId in body)
PUT    /api/documents/:id/move      // Move document to folder

// Chat API Updates
POST   /api/chat/send              // Include folderIds in request
```

## Notes

- Deleting a folder will also delete all subfolders and documents (with confirmation)
- Folder paths are auto-generated based on hierarchy
- Root folder (`id: "root"`) cannot be deleted or renamed
- Empty `selectedFolderIds` array means "search everywhere"

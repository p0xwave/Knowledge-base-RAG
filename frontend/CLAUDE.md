# CLAUDE.md - AI Assistant Instructions

This file provides context and guidelines for AI assistants (Claude, Cursor, etc.) working on this codebase.

## Project Overview

**DataMind AI** - A private database RAG (Retrieval-Augmented Generation) chat application built with Next.js 16+ (App Router), React 19, TypeScript, and Tailwind CSS v4.

### Tech Stack

- **Framework**: Next.js 16.1.3 (App Router)
- **Language**: TypeScript 5.x (strict mode)
- **UI Library**: React 19.2.3
- **Styling**: Tailwind CSS 4.x with `tw-animate-css`
- **UI Components**: Radix UI primitives + shadcn/ui
- **State Management**: Zustand 5.x
- **Forms**: React Hook Form + Zod validation
- **Package Manager**: pnpm

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── documents/         # Documents management page
│   ├── login/             # Auth page
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home (chat) page
├── components/
│   ├── chat/              # Chat-related components
│   ├── documents/         # Document management components
│   ├── ui/                # shadcn/ui base components
│   └── *.tsx              # Feature components
├── hooks/                 # Custom React hooks
├── lib/
│   ├── api/               # API client and request utilities
│   │   ├── client.ts      # Base API client with error handling
│   │   ├── queries/       # GET request functions
│   │   └── mutations/     # POST/PUT/DELETE request functions
│   ├── constants/         # App constants
│   ├── security/          # Security utilities
│   ├── store/             # Zustand stores
│   └── *.ts               # Utility modules
├── types/                 # TypeScript type definitions
│   ├── api.ts             # API request/response types
│   ├── components.ts      # Component prop types
│   └── messages.ts        # Chat message types
└── public/                # Static assets
```

## Code Style & Conventions

### TypeScript

- **Strict mode enabled** - no implicit `any`, strict null checks
- Use `type` for object types, `interface` for component props
- Prefer explicit return types for exported functions
- Use discriminated unions for API responses (`ApiResult<T>`)

```typescript
// Good: Explicit types
export function formatDate(date: Date): string { ... }

// Good: Interface for props
interface ButtonProps {
  variant?: "default" | "destructive" | "outline"
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
}

// Good: Discriminated union
type ApiResult<T> =
  | { data: T; success: true }
  | { error: string; code: string; success: false }
```

### React Components

- Use **functional components** with hooks only
- Mark client components with `"use client"` directive
- Prefer **named exports** for components
- Use **compound component pattern** for complex UI
- Extract reusable logic into custom hooks (`hooks/`)

```typescript
// Good: Client component with proper structure
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ComponentProps {
  className?: string
  children: React.ReactNode
}

export function Component({ className, children }: ComponentProps) {
  const [state, setState] = useState(false)

  return (
    <div className={cn("base-styles", className)}>
      {children}
    </div>
  )
}
```

### Styling (Tailwind CSS v4)

- Use **Tailwind utility classes** exclusively
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Follow **mobile-first** responsive design
- Use CSS custom properties for theming (defined in `globals.css`)
- Class order: layout → spacing → sizing → typography → colors → effects

```typescript
// Good: Proper class organization
<div className={cn(
  "flex items-center gap-4",           // Layout
  "p-4 mx-auto",                       // Spacing
  "w-full max-w-2xl",                  // Sizing
  "text-sm font-medium",               // Typography
  "bg-card text-foreground",           // Colors
  "rounded-lg shadow-sm",              // Effects
  className
)}>
```

### State Management (Zustand)

- Store files go in `lib/store/`
- Use **selectors** to prevent unnecessary re-renders
- Separate state and actions in store types
- Use `devtools` middleware for debugging

```typescript
// Good: Store with selectors
import { create } from "zustand"
import { devtools } from "zustand/middleware"

interface StoreState {
  items: Item[]
  isLoading: boolean
}

interface StoreActions {
  addItem: (item: Item) => void
  removeItem: (id: string) => void
}

type Store = StoreState & StoreActions

export const useStore = create<Store>()(
  devtools((set) => ({
    items: [],
    isLoading: false,
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
    removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  }))
)

// Selectors
export const selectItems = (state: Store) => state.items
export const selectIsLoading = (state: Store) => state.isLoading
```

### API Layer

- Base client in `lib/api/client.ts`
- Queries (GET) in `lib/api/queries/`
- Mutations (POST/PUT/DELETE) in `lib/api/mutations/`
- Use `safeRequest()` wrapper for error handling
- Types in `types/api.ts`

```typescript
// Good: API function with proper error handling
import { api, safeRequest, ApiRequestError } from "@/lib/api/client"
import type { DocumentListItem, ApiResult } from "@/types/api"

export async function getDocuments(): Promise<ApiResult<DocumentListItem[]>> {
  return safeRequest(() => api.get<DocumentListItem[]>("/documents"))
}
```

### Custom Hooks

- Prefix with `use` (e.g., `useDocuments`, `useSearch`)
- Export from `hooks/index.ts`
- Handle loading, error, and success states
- Return consistent interface

```typescript
// Good: Custom hook pattern
export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const result = await getDocuments()

    if (result.success) {
      setDocuments(result.data)
    } else {
      setError(result.error)
    }

    setIsLoading(false)
  }, [])

  return { documents, isLoading, error, fetchDocuments }
}
```

## File Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `ChatMessage.tsx`)
- **Hooks**: `camelCase.ts` with `use` prefix (e.g., `useDocuments.ts`)
- **Utilities**: `kebab-case.ts` (e.g., `code-executor.ts`)
- **Types**: `kebab-case.ts` (e.g., `api.ts`, `messages.ts`)
- **Constants**: `kebab-case.ts` or `SCREAMING_SNAKE_CASE` for values

## Import Conventions

Use path aliases defined in `tsconfig.json`:

```typescript
// Good: Use aliases
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/lib/store/chat-store"
import type { Message } from "@/lib/types"

// Avoid: Relative imports for shared code
import { Button } from "../../../components/ui/button"
```

Import order:
1. React/Next.js
2. Third-party libraries
3. Internal aliases (`@/`)
4. Types (with `type` keyword)
5. Styles

## Commands

```bash
# Development
pnpm dev           # Start dev server (http://localhost:3000)

# Build & Production
pnpm build         # Production build
pnpm start         # Start production server

# Code Quality
pnpm lint          # Run ESLint
pnpm lint:fix      # Fix ESLint issues
pnpm format        # Format with Prettier
pnpm format:check  # Check formatting
```

## Best Practices

### Performance

- Use `React.memo()` for expensive components
- Implement proper `key` props for lists
- Lazy load heavy components with `next/dynamic`
- Use Zustand selectors to minimize re-renders
- Prefer `useCallback` and `useMemo` for callbacks/computed values passed to children

### Accessibility

- Use semantic HTML elements
- Include proper ARIA attributes
- Ensure keyboard navigation support
- Maintain sufficient color contrast
- Test with screen readers

### Error Handling

- Use `ErrorBoundary` component for React errors
- Handle API errors with `ApiResult` type
- Display user-friendly error messages via toast
- Log errors for debugging (use `lib/logger.ts`)

### Security

- Sanitize user inputs
- Validate API responses with Zod
- Use CSP headers in production
- Never expose sensitive data in client code

## Common Patterns

### Conditional Rendering

```typescript
// Good: Early returns
if (!data) return <Skeleton />
if (error) return <ErrorMessage error={error} />
return <Content data={data} />
```

### Event Handlers

```typescript
// Good: Named handlers with proper types
const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  // ...
}, [dependencies])
```

### Loading States

```typescript
// Good: Consistent loading pattern
{isLoading ? (
  <Skeleton className="h-10 w-full" />
) : (
  <Content />
)}
```

## Things to Avoid

- `any` type - use `unknown` and narrow types
- Inline styles - use Tailwind classes
- Direct DOM manipulation - use React state
- Hardcoded strings - use constants
- Console.log in production - use logger utility
- Giant components - extract into smaller pieces
- Prop drilling - use Zustand or context
- Synchronous blocking operations in render

## Notes for AI Assistants

1. **Always read existing code** before making changes
2. **Follow existing patterns** - consistency over personal preference
3. **Keep changes minimal** - don't refactor unrelated code
4. **Write type-safe code** - no implicit any
5. **Test edge cases** - null, undefined, empty arrays
6. **Use existing utilities** - check `lib/` and `hooks/` first
7. **Prefer composition** - small, focused components
8. **Document complex logic** - add comments for non-obvious code

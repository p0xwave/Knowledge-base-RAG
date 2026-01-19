// Shared component prop interfaces

import type { ReactNode } from "react"

// ============================================
// Common props
// ============================================

export interface BaseComponentProps {
  className?: string
  children?: ReactNode
}

export interface WithLoadingProps {
  isLoading?: boolean
  loadingText?: string
}

export interface WithErrorProps {
  error?: string | null
  onRetry?: () => void
}

// ============================================
// Empty state props
// ============================================

export interface EmptyStateProps extends BaseComponentProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

// ============================================
// Modal/Dialog props
// ============================================

export interface ModalProps extends BaseComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
}

export interface ConfirmDialogProps extends ModalProps {
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: "default" | "destructive"
}

// ============================================
// List item props
// ============================================

export interface ListItemProps<T> extends BaseComponentProps {
  item: T
  isSelected?: boolean
  isDisabled?: boolean
  onClick?: (item: T) => void
}

export interface SelectableListProps<T> extends BaseComponentProps {
  items: T[]
  selectedId?: string
  onSelect?: (item: T) => void
  renderItem: (item: T, isSelected: boolean) => ReactNode
  keyExtractor: (item: T) => string
  emptyState?: ReactNode
}

// ============================================
// Form field props
// ============================================

export interface FormFieldProps extends BaseComponentProps {
  label?: string
  description?: string
  error?: string
  required?: boolean
  disabled?: boolean
}

export interface InputFieldProps extends FormFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: "text" | "email" | "password" | "number"
}

export interface TextareaFieldProps extends FormFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
}

// ============================================
// Button variants
// ============================================

export interface ActionButtonProps extends BaseComponentProps {
  label?: string
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "lg" | "icon"
}

export interface IconButtonProps extends BaseComponentProps {
  icon: ReactNode
  label: string // for accessibility
  onClick?: () => void
  disabled?: boolean
  size?: "sm" | "md" | "lg"
}

// ============================================
// Tooltip props
// ============================================

export interface TooltipButtonProps extends BaseComponentProps {
  tooltip: string
  icon: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "default" | "lg" | "icon"
}

// ============================================
// Badge/Tag props
// ============================================

export interface BadgeProps extends BaseComponentProps {
  label: string
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "error"
  size?: "sm" | "md"
  removable?: boolean
  onRemove?: () => void
}

// ============================================
// Card props
// ============================================

export interface CardProps extends BaseComponentProps {
  title?: string
  description?: string
  footer?: ReactNode
  actions?: ReactNode
}

export interface StatCardProps extends BaseComponentProps {
  icon?: ReactNode
  value: string | number
  label: string
  trend?: {
    value: number
    direction: "up" | "down" | "neutral"
  }
  color?: string
}

// ============================================
// Search props
// ============================================

export interface SearchProps extends BaseComponentProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  onClear?: () => void
}

// ============================================
// Pagination props
// ============================================

export interface PaginationProps extends BaseComponentProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showFirstLast?: boolean
  maxVisiblePages?: number
}

// ============================================
// File upload props
// ============================================

export interface FileUploadProps extends BaseComponentProps {
  accept?: string[]
  maxSize?: number
  multiple?: boolean
  onUpload: (files: File[]) => void | Promise<void>
  disabled?: boolean
  uploading?: boolean
}

export interface DropzoneProps extends FileUploadProps {
  isDragActive?: boolean
  onDragEnter?: () => void
  onDragLeave?: () => void
}

// ============================================
// Data display props
// ============================================

export interface DataTableColumn<T> {
  key: keyof T | string
  header: string
  width?: string
  sortable?: boolean
  render?: (item: T) => ReactNode
}

export interface DataTableProps<T> extends BaseComponentProps {
  data: T[]
  columns: DataTableColumn<T>[]
  keyExtractor: (item: T) => string
  sortBy?: string
  sortDirection?: "asc" | "desc"
  onSort?: (column: string) => void
  loading?: boolean
  emptyState?: ReactNode
}

// ============================================
// Code block props
// ============================================

export interface CodeBlockProps extends BaseComponentProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
  maxHeight?: string
  copyable?: boolean
  executable?: boolean
  onExecute?: () => void
}

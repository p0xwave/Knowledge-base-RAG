// UI-related constants: timeouts, sizes, delays

// Message constraints
export const MAX_MESSAGE_LENGTH = 10000

// UI timeouts (in milliseconds)
export const COPY_FEEDBACK_TIMEOUT = 2000
export const SIMULATED_RESPONSE_DELAY = 2000
export const EDIT_RESPONSE_DELAY = 1000

// Time constants (in milliseconds)
export const ONE_DAY_MS = 86400000
export const TWO_DAYS_MS = 172800000
export const THREE_DAYS_MS = 259200000

// File type colors for UI
export const FILE_EXTENSION_COLORS: Record<string, string> = {
  MD: "bg-blue-500/10 text-blue-500",
  TXT: "bg-emerald-500/10 text-emerald-500",
  DOC: "bg-amber-500/10 text-amber-500",
  md: "bg-blue-500/10 text-blue-500",
  txt: "bg-emerald-500/10 text-emerald-500",
}

// Source type colors
export const SOURCE_TYPE_COLORS: Record<string, string> = {
  document: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  database: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  api: "bg-chart-3/10 text-chart-3 border-chart-3/20",
}

// Source type labels
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  document: "Document",
  database: "Database",
  api: "API",
}

// Code execution timeouts
export const PYTHON_EXECUTION_TIMEOUT = 60000 // 60 seconds
export const JS_EXECUTION_TIMEOUT = 30000 // 30 seconds
export const SANDBOX_EXECUTION_TIMEOUT = 60000 // 60 seconds

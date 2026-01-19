type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || "info"

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatMessage(entry: LogEntry): string {
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${ctx}`
}

function createEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (!shouldLog("debug")) return
    const entry = createEntry("debug", message, context)
    console.debug(formatMessage(entry))
  },

  info(message: string, context?: Record<string, unknown>) {
    if (!shouldLog("info")) return
    const entry = createEntry("info", message, context)
    console.info(formatMessage(entry))
  },

  warn(message: string, context?: Record<string, unknown>) {
    if (!shouldLog("warn")) return
    const entry = createEntry("warn", message, context)
    console.warn(formatMessage(entry))
  },

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>) {
    if (!shouldLog("error")) return
    const errorContext = error instanceof Error
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
      : { error: String(error) }
    const entry = createEntry("error", message, { ...errorContext, ...context })
    console.error(formatMessage(entry))
  },
}

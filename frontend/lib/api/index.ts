// Main API module - re-exports everything

// Base client
export {
  api,
  safeRequest,
  streamRequest,
  uploadFile,
  ApiRequestError,
  type RequestConfig,
  type StreamCallbacks,
} from "./client"

// Queries (GET)
export * from "./queries"

// Mutations (POST/PUT/DELETE)
export * from "./mutations"

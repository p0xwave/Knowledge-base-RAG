// Centralized security validation for code execution

import {
  MAX_CODE_LENGTH,
  DANGEROUS_PYTHON_MODULE_PATTERNS,
  DANGEROUS_PYTHON_PATTERNS,
  DANGEROUS_JS_PATTERNS,
} from "@/lib/constants/security"

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates Python code for security issues
 * Used in: app/api/execute-python/route.ts
 */
export function validatePythonCode(code: string): ValidationResult {
  if (code.length > MAX_CODE_LENGTH) {
    return { valid: false, error: `Code exceeds ${MAX_CODE_LENGTH} characters` }
  }

  // Normalize code to catch obfuscation attempts
  const normalizedCode = code
    .replace(/\\\n/g, "") // Remove line continuations
    .replace(/\s+/g, " ") // Normalize whitespace

  // Check dangerous module imports
  for (const pattern of DANGEROUS_PYTHON_MODULE_PATTERNS) {
    if (pattern.test(code) || pattern.test(normalizedCode)) {
      return { valid: false, error: "Dangerous module import detected" }
    }
  }

  // Check other dangerous patterns
  for (const pattern of DANGEROUS_PYTHON_PATTERNS) {
    if (pattern.test(code) || pattern.test(normalizedCode)) {
      return { valid: false, error: "Dangerous operation detected" }
    }
  }

  return { valid: true }
}

/**
 * Validates JavaScript code for security issues
 * Used in: lib/webgpu-executor.ts
 */
export function validateJavaScriptCode(code: string): ValidationResult {
  if (code.length > MAX_CODE_LENGTH) {
    return { valid: false, error: `Code exceeds ${MAX_CODE_LENGTH} characters` }
  }

  for (const pattern of DANGEROUS_JS_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, error: "Potentially unsafe operation detected in code" }
    }
  }

  return { valid: true }
}

/**
 * Generic code validator that selects the appropriate validator based on language
 */
export function validateCode(
  code: string,
  language: "python" | "javascript"
): ValidationResult {
  if (language === "python") {
    return validatePythonCode(code)
  }
  return validateJavaScriptCode(code)
}

/**
 * Sanitizes filename to prevent path traversal and other attacks
 * Used in: hooks/useDocuments.ts, app/documents/page.tsx
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\.[\/\\]/g, "") // path traversal
    .replace(/[\/\\]/g, "") // slashes
    .replace(/[\x00-\x1f\x7f]/g, "") // control chars
    .slice(0, 255) || "download"
}

/**
 * Validates file for upload
 * Used in: hooks/useDocuments.ts
 */
export function validateFileForUpload(
  file: File,
  maxSize: number,
  allowedExtensions: readonly string[],
  allowedMimeTypes: string[]
): ValidationResult {
  // Size check
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`,
    }
  }

  // Extension check
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Only ${allowedExtensions.map((e) => `.${e}`).join(" and ")} files are supported`,
    }
  }

  // MIME type check (with fallback for .md files that may have empty type)
  if (file.type && !allowedMimeTypes.includes(file.type) && file.type !== "") {
    return { valid: false, error: `Invalid file type: ${file.type}` }
  }

  return { valid: true }
}

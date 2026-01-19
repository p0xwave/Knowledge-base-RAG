// Security-related constants: limits, dangerous patterns

// Code length limits
export const MAX_CODE_LENGTH = 50000
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// File validation
export const ALLOWED_EXTENSIONS = ["md", "txt"] as const
export const ALLOWED_MIME_TYPES = ["text/plain", "text/markdown", "text/x-markdown"]

// Execution timeouts for backend
export const BACKEND_EXECUTION_TIMEOUT = 10000 // 10 seconds

// Dangerous Python modules
export const DANGEROUS_PYTHON_MODULES = [
  "os",
  "subprocess",
  "sys",
  "socket",
  "requests",
  "urllib",
  "shutil",
  "pickle",
  "importlib",
  "builtins",
  "ctypes",
  "multiprocessing",
  "threading",
  "pty",
  "fcntl",
  "signal",
  "resource",
  "grp",
  "pwd",
  "spwd",
  "crypt",
  "termios",
  "tty",
  "nis",
  "syslog",
  "commands",
  "popen2",
] as const

// Build regex patterns for dangerous Python modules
export const DANGEROUS_PYTHON_MODULE_PATTERNS = DANGEROUS_PYTHON_MODULES.flatMap((mod) => [
  new RegExp(`\\bimport\\s+${mod}\\b`), // import os
  new RegExp(`\\bimport\\s+${mod}\\s+as\\b`), // import os as x
  new RegExp(`\\bimport\\s+${mod}\\.`), // import os.path
  new RegExp(`\\bfrom\\s+${mod}\\b`), // from os import / from os.path import
])

// Other dangerous Python patterns
export const DANGEROUS_PYTHON_PATTERNS = [
  // Dynamic import and code execution
  /\b__import__\s*\(/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bcompile\s*\(/,

  // File system access
  /\bopen\s*\(/,
  /\bfile\s*\(/,

  // Attribute access tricks
  /\bgetattr\s*\(\s*__builtins__/,
  /\bgetattr\s*\(\s*globals\s*\(\s*\)/,
  /\b__builtins__\s*\[/,
  /\b__globals__\b/,
  /\b__code__\b/,
  /\b__class__\b.*\b__bases__\b/,
  /\b__subclasses__\s*\(\s*\)/,
  /\b__mro__\b/,

  // Environment and system access
  /\benviron\b/,
  /\bgetenv\b/,
  /\bputenv\b/,

  // Network access patterns
  /\bconnect\s*\(/,
  /\bbind\s*\(/,
  /\blisten\s*\(/,

  // Code object manipulation
  /\bCodeType\b/,
  /\bFunctionType\b/,

  // Dangerous string patterns that might be used to bypass
  /\\x[0-9a-fA-F]{2}/, // Hex escape sequences
  /\\u[0-9a-fA-F]{4}/, // Unicode escape sequences (in suspicious context)
]

// Dangerous JavaScript patterns
export const DANGEROUS_JS_PATTERNS = [
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bsetTimeout\s*\(\s*["'`]/, // setTimeout with string
  /\bsetInterval\s*\(\s*["'`]/, // setInterval with string
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bimport\s*\(/, // dynamic import
  /\brequire\s*\(/,
  /\bprocess\b/,
  /\b__proto__\b/,
  /\bconstructor\s*\[/,
  /\bwindow\b/,
  /\bdocument\b/,
  /\bglobalThis\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bcookie\b/,
]

// Packages that require server-side execution (not available in Pyodide)
export const SERVER_ONLY_PACKAGES = [
  "torch",
  "tensorflow",
  "keras",
  "transformers",
  "diffusers",
] as const

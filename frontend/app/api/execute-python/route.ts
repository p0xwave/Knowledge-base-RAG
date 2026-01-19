import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"

// Security constants
const MAX_CODE_LENGTH = 50000
const EXECUTION_TIMEOUT = 10000 // 10 seconds

// Dangerous module patterns - catches various import styles:
// - import os
// - from os import ...
// - from os.path import ...
// - import os.path
// - import os as something
const DANGEROUS_MODULES = [
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
]

// Build regex patterns for dangerous modules
const DANGEROUS_MODULE_PATTERNS = DANGEROUS_MODULES.flatMap(mod => [
  new RegExp(`\\bimport\\s+${mod}\\b`),           // import os
  new RegExp(`\\bimport\\s+${mod}\\s+as\\b`),     // import os as x
  new RegExp(`\\bimport\\s+${mod}\\.`),           // import os.path
  new RegExp(`\\bfrom\\s+${mod}\\b`),             // from os import / from os.path import
])

// Other dangerous patterns
const DANGEROUS_PATTERNS = [
  ...DANGEROUS_MODULE_PATTERNS,
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
  /\\x[0-9a-fA-F]{2}/,  // Hex escape sequences
  /\\u[0-9a-fA-F]{4}/,  // Unicode escape sequences (in suspicious context)
]

function validateCode(code: string): { valid: boolean; error?: string } {
  if (code.length > MAX_CODE_LENGTH) {
    return { valid: false, error: `Code exceeds ${MAX_CODE_LENGTH} characters` }
  }

  // Normalize code to catch obfuscation attempts
  const normalizedCode = code
    .replace(/\\\n/g, '')  // Remove line continuations
    .replace(/\s+/g, ' ')  // Normalize whitespace

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code) || pattern.test(normalizedCode)) {
      return { valid: false, error: "Dangerous operation detected" }
    }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      )
    }

    // Validate code for security
    const validation = validateCode(code)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, output: "" },
        { status: 400 }
      )
    }

    // Execute Python code
    const result = await executePythonCode(code)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed", output: "" },
      { status: 500 }
    )
  }
}

function executePythonCode(code: string): Promise<{ output: string; error?: string }> {
  return new Promise((resolve) => {
    let output = ""
    let errorOutput = ""
    let resolved = false

    // Restricted environment variables for security (only expose necessary env vars)
    const restrictedEnv = {
      PYTHONUNBUFFERED: "1",
      PATH: process.env.PATH,
      LANG: "en_US.UTF-8",
    } as unknown as NodeJS.ProcessEnv

    // Spawn Python process
    // Use PYTHON_PATH env variable if set, otherwise fallback to python3
    const pythonPath = process.env.PYTHON_PATH || "python3"
    const python = spawn(pythonPath, ["-c", code], {
      timeout: EXECUTION_TIMEOUT,
      env: restrictedEnv,
    })

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        python.kill()
        resolve({ output: "", error: `Execution timed out (${EXECUTION_TIMEOUT / 1000}s limit)` })
      }
    }, EXECUTION_TIMEOUT)

    python.stdout.on("data", (data: Buffer) => {
      output += data.toString()
    })

    python.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString()
    })

    python.on("close", (exitCode: number | null) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)

      if (exitCode === 0) {
        resolve({ output: output || "Code executed successfully (no output)" })
      } else {
        resolve({ output: errorOutput || output, error: "Execution failed" })
      }
    })

    python.on("error", (err: Error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)

      resolve({
        output: "",
        error: `Failed to start Python: ${err.message}. Make sure Python is installed.`
      })
    })
  })
}

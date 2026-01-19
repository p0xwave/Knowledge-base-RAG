import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { validatePythonCode } from "@/lib/security/validators"
import { BACKEND_EXECUTION_TIMEOUT } from "@/lib/constants/security"

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    // Validate code for security
    const validation = validatePythonCode(code)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error, output: "" }, { status: 400 })
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
      timeout: BACKEND_EXECUTION_TIMEOUT,
      env: restrictedEnv,
    })

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        python.kill()
        resolve({
          output: "",
          error: `Execution timed out (${BACKEND_EXECUTION_TIMEOUT / 1000}s limit)`,
        })
      }
    }, BACKEND_EXECUTION_TIMEOUT)

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
        error: `Failed to start Python: ${err.message}. Make sure Python is installed.`,
      })
    })
  })
}

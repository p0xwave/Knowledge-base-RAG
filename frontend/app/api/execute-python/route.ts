import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Code is required" },
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
    const timeout = 30000 // 30 second timeout
    let output = ""
    let errorOutput = ""
    let resolved = false

    // Spawn Python process
    // Use PYTHON_PATH env variable if set, otherwise fallback to python3
    const pythonPath = process.env.PYTHON_PATH || "python3"
    const python = spawn(pythonPath, ["-c", code], {
      timeout,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    })

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        python.kill()
        resolve({ output: "", error: "Execution timed out (30s limit)" })
      }
    }, timeout)

    python.stdout.on("data", (data) => {
      output += data.toString()
    })

    python.stderr.on("data", (data) => {
      errorOutput += data.toString()
    })

    python.on("close", (exitCode) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)

      if (exitCode === 0) {
        resolve({ output: output || "Code executed successfully (no output)" })
      } else {
        resolve({ output: errorOutput || output, error: "Execution failed" })
      }
    })

    python.on("error", (err) => {
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

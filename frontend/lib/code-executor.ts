// Code execution utilities for Python (Pyodide) and JavaScript (sandboxed iframe)

export interface ExecutionResult {
  output: string
  status: "success" | "error"
}

// Pyodide singleton for reuse
let pyodideInstance: any = null
let pyodideLoading: Promise<any> | null = null

// Callback for Pyodide loading status
type LoadingCallback = (status: "loading" | "ready") => void
let loadingCallbacks: LoadingCallback[] = []

export function onPyodideLoading(callback: LoadingCallback): () => void {
  loadingCallbacks.push(callback)
  return () => {
    loadingCallbacks = loadingCallbacks.filter(cb => cb !== callback)
  }
}

function notifyLoading(status: "loading" | "ready") {
  loadingCallbacks.forEach(cb => cb(status))
}

async function loadPyodideRuntime(): Promise<any> {
  // Dynamically load Pyodide from CDN
  if (typeof window === "undefined") {
    throw new Error("Pyodide can only run in browser environment")
  }

  // Check if loadPyodide is already available
  if ((window as any).loadPyodide) {
    return (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
    })
  }

  // Load Pyodide script
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"
    script.onload = async () => {
      try {
        const pyodide = await (window as any).loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        })
        resolve(pyodide)
      } catch (error) {
        reject(error)
      }
    }
    script.onerror = () => reject(new Error("Failed to load Pyodide"))
    document.head.appendChild(script)
  })
}

// Packages that require server-side execution (not available in Pyodide)
const SERVER_ONLY_PACKAGES = ["torch", "tensorflow", "keras", "transformers", "diffusers"]

// Check if code requires server-side execution
function requiresServerExecution(code: string): string | null {
  for (const pkg of SERVER_ONLY_PACKAGES) {
    if (code.includes(`import ${pkg}`) || code.includes(`from ${pkg}`)) {
      return pkg
    }
  }
  return null
}

// Detect required packages from code
function detectPackages(code: string): string[] {
  const packages: Set<string> = new Set()

  const packageMap: Record<string, string> = {
    numpy: "numpy",
    pandas: "pandas",
    matplotlib: "matplotlib",
    scipy: "scipy",
    sklearn: "scikit-learn",
  }

  for (const [pkg, pipName] of Object.entries(packageMap)) {
    if (code.includes(pkg)) {
      packages.add(pipName)
    }
  }

  return Array.from(packages)
}

// Track installed packages
const installedPackages: Set<string> = new Set()

// Execute Python code on backend server (for PyTorch, TensorFlow, etc.)
async function executeOnBackend(code: string, detectedPackage: string): Promise<ExecutionResult> {
  try {
    const response = await fetch("/api/execute-python", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      // If backend is not available, show helpful message
      if (response.status === 404) {
        return {
          output: `⚠️ Пакет "${detectedPackage}" требует серверного выполнения.\n\nДля запуска PyTorch/TensorFlow кода необходим Python бэкенд.\n\nЗапустите бэкенд сервер:\n  cd ../backend && python server.py`,
          status: "error"
        }
      }
      const error = await response.text()
      return { output: error, status: "error" }
    }

    const result = await response.json()
    return {
      output: result.output || "Code executed successfully",
      status: result.error ? "error" : "success"
    }
  } catch (error) {
    return {
      output: `⚠️ Пакет "${detectedPackage}" требует серверного выполнения.\n\nБэкенд сервер недоступен. Запустите:\n  cd ../backend && python server.py\n\nОшибка: ${error instanceof Error ? error.message : String(error)}`,
      status: "error"
    }
  }
}

export async function executePython(
  code: string,
  timeout: number = 60000 // Increased timeout for package installation
): Promise<ExecutionResult> {
  // Check if code requires server-side execution (PyTorch, TensorFlow, etc.)
  const serverOnlyPkg = requiresServerExecution(code)
  if (serverOnlyPkg) {
    // Try backend execution
    return executeOnBackend(code, serverOnlyPkg)
  }

  // Lazy load Pyodide on first run
  if (!pyodideInstance) {
    if (!pyodideLoading) {
      notifyLoading("loading")
      pyodideLoading = loadPyodideRuntime()
    }
    try {
      pyodideInstance = await pyodideLoading
      notifyLoading("ready")
    } catch (error) {
      pyodideLoading = null
      notifyLoading("ready")
      return {
        output: `Failed to load Python runtime: ${error instanceof Error ? error.message : String(error)}`,
        status: "error"
      }
    }
  }

  // Execute with timeout
  const timeoutPromise = new Promise<ExecutionResult>((_, reject) => {
    setTimeout(() => reject(new Error("Execution timed out (60s limit)")), timeout)
  })

  const executionPromise = (async (): Promise<ExecutionResult> => {
    try {
      // Detect and install required packages
      const requiredPackages = detectPackages(code)
      const packagesToInstall = requiredPackages.filter(pkg => !installedPackages.has(pkg))

      if (packagesToInstall.length > 0) {
        console.log("Installing packages:", packagesToInstall)

        // Load micropip and install packages
        await pyodideInstance.loadPackage("micropip")
        const micropip = pyodideInstance.pyimport("micropip")

        for (const pkg of packagesToInstall) {
          try {
            await micropip.install(pkg)
            installedPackages.add(pkg)
            console.log(`Installed ${pkg}`)
          } catch (e) {
            console.warn(`Failed to install ${pkg}:`, e)
          }
        }
      }

      // Setup matplotlib for non-interactive backend if needed
      if (code.includes("matplotlib")) {
        pyodideInstance.runPython(`
import matplotlib
matplotlib.use('AGG')
`)
      }

      // Setup stdout/stderr capture
      pyodideInstance.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
_stderr_capture = StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
_plot_base64 = None
`)

      // If matplotlib is used, setup plot capture
      if (code.includes("plt.show()")) {
        // Replace plt.show() with our capture code
        code = code.replace(/plt\.show\(\)/g, `
import base64
from io import BytesIO
_buf = BytesIO()
plt.savefig(_buf, format='png', dpi=100, bbox_inches='tight', facecolor='white')
_buf.seek(0)
_plot_base64 = base64.b64encode(_buf.read()).decode('utf-8')
plt.close()
print(f"[PLOT_DATA]{_plot_base64}[/PLOT_DATA]")
`)
      }

      // Execute user code
      let result
      try {
        result = await pyodideInstance.runPythonAsync(code)
      } catch (pyError: any) {
        // Get captured stderr
        const stderr = pyodideInstance.runPython("_stderr_capture.getvalue()")
        const errorMessage = pyError.message || String(pyError)

        // Restore stdout/stderr
        pyodideInstance.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`)
        return {
          output: stderr || errorMessage,
          status: "error"
        }
      }

      // Get captured stdout
      const stdout = pyodideInstance.runPython("_stdout_capture.getvalue()")

      // Restore stdout/stderr
      pyodideInstance.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`)

      // Return output (prefer stdout, fall back to result)
      const output = stdout || (result !== undefined && result !== null ? String(result) : "")
      return {
        output: output || "Code executed successfully (no output)",
        status: "success"
      }
    } catch (error) {
      return {
        output: error instanceof Error ? error.message : String(error),
        status: "error"
      }
    }
  })()

  try {
    return await Promise.race([executionPromise, timeoutPromise])
  } catch (error) {
    return {
      output: error instanceof Error ? error.message : String(error),
      status: "error"
    }
  }
}

// Detect required JS libraries from code
function detectJSLibraries(code: string): string[] {
  const libs: string[] = []

  // TensorFlow.js
  if (code.includes("tf.") || code.includes("@tensorflow/tfjs")) {
    libs.push("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js")
  }

  // Chart.js
  if (code.includes("Chart(") || code.includes("chart.js")) {
    libs.push("https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js")
  }

  // D3.js
  if (code.includes("d3.") || code.includes("d3js")) {
    libs.push("https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js")
  }

  // ONNX Runtime Web
  if (code.includes("ort.") || code.includes("onnxruntime")) {
    libs.push("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js")
  }

  return libs
}

// Cache for fetched library code
const libraryCache: Map<string, string> = new Map()

async function fetchLibraryCode(url: string): Promise<string> {
  if (libraryCache.has(url)) {
    return libraryCache.get(url)!
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }
    const code = await response.text()
    libraryCache.set(url, code)
    return code
  } catch (error) {
    console.error(`Failed to load library ${url}:`, error)
    throw error
  }
}

export async function executeJavaScript(
  code: string,
  timeout: number = 30000 // Increased for library loading
): Promise<ExecutionResult> {
  if (typeof window === "undefined") {
    return {
      output: "JavaScript execution is only available in browser",
      status: "error"
    }
  }

  const libraries = detectJSLibraries(code)

  // Fetch all required libraries
  let libraryCode = ""
  if (libraries.length > 0) {
    try {
      const codes = await Promise.all(libraries.map(fetchLibraryCode))
      libraryCode = codes.join("\n;\n")
    } catch (error) {
      return {
        output: `Failed to load libraries: ${error instanceof Error ? error.message : String(error)}`,
        status: "error"
      }
    }
  }

  return new Promise((resolve) => {
    // Create sandboxed iframe
    const iframe = document.createElement("iframe")
    iframe.sandbox.add("allow-scripts")
    iframe.style.display = "none"
    document.body.appendChild(iframe)

    // Timeout handler
    const timeoutId = setTimeout(() => {
      cleanup()
      resolve({
        output: "Execution timed out (60s limit)",
        status: "error"
      })
    }, timeout)

    // Message handler
    const messageHandler = (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (event.source !== iframe.contentWindow) return

      cleanup()

      if (event.data.type === "result") {
        const output = event.data.logs.join("\n")
        resolve({
          output: output || "Code executed successfully (no output)",
          status: "success"
        })
      } else if (event.data.type === "error") {
        resolve({
          output: event.data.message,
          status: "error"
        })
      }
    }

    const cleanup = () => {
      clearTimeout(timeoutId)
      window.removeEventListener("message", messageHandler)
      iframe.remove()
    }

    window.addEventListener("message", messageHandler)

    // Script to execute in iframe with console.log capture
    // Supports async/await for TensorFlow.js and other async operations
    const script = `
      const logs = [];

      console.log = (...args) => logs.push(args.map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
          try {
            // Handle TensorFlow tensors
            if (a.constructor && a.constructor.name === 'Tensor') {
              return 'Tensor: ' + JSON.stringify(a.arraySync());
            }
            return JSON.stringify(a, null, 2);
          } catch(e) {
            return String(a);
          }
        }
        return String(a);
      }).join(' '));
      console.error = (...args) => logs.push('Error: ' + args.join(' '));
      console.warn = (...args) => logs.push('Warning: ' + args.join(' '));

      (async function() {
        try {
          ${libraries.length > 0 ? 'console.log("Libraries loaded: ' + libraries.map(l => l.split('/').pop()).join(', ') + '");' : ''}
          const result = await (async function() {
            ${code}
          })();
          if (result !== undefined) {
            if (result && result.constructor && result.constructor.name === 'Tensor') {
              logs.push('Result Tensor: ' + JSON.stringify(result.arraySync()));
            } else {
              logs.push(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
            }
          }
          parent.postMessage({ type: 'result', logs }, '*');
        } catch (e) {
          parent.postMessage({ type: 'error', message: e.message || String(e) }, '*');
        }
      })();
    `

    // Build HTML content with inlined libraries
    // Use srcdoc attribute instead of document.write to avoid sandbox access issues
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body>
<script>
// Inlined libraries
${libraryCode.replace(/<\/script>/gi, '<\\/script>')}
</script>
<script>
// User code execution
${script.replace(/<\/script>/gi, '<\\/script>')}
</script>
</body>
</html>`

    // Set content via srcdoc (works with sandbox without allow-same-origin)
    iframe.srcdoc = html
  })
}

// Check if language is supported for execution
export function isExecutableLanguage(language: string): boolean {
  const normalizedLang = language.toLowerCase()
  return ["python", "py", "javascript", "js", "typescript", "ts"].includes(normalizedLang)
}

// Get execution function for language
export async function executeCode(
  code: string,
  language: string,
  timeout: number = 60000
): Promise<ExecutionResult> {
  const normalizedLang = language.toLowerCase()

  if (normalizedLang === "python" || normalizedLang === "py") {
    return executePython(code, timeout)
  }

  if (["javascript", "js", "typescript", "ts"].includes(normalizedLang)) {
    return executeJavaScript(code, timeout)
  }

  return {
    output: `Language "${language}" is not supported for execution. Supported: Python, JavaScript`,
    status: "error"
  }
}

// Check if Pyodide is currently loading
export function isPyodideLoading(): boolean {
  return pyodideLoading !== null && pyodideInstance === null
}

// Check if Pyodide is ready
export function isPyodideReady(): boolean {
  return pyodideInstance !== null
}

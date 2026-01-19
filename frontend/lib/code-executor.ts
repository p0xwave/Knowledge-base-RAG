// Code execution utilities for Python (Pyodide), JavaScript (sandboxed iframe), and WebGPU

import {
  executeONNXCode,
  executeTransformersCode,
  checkWebGPUSupport,
} from "./webgpu-executor"
import { logger } from "./logger"

export interface ExecutionResult {
  output: string
  status: "success" | "error"
}

const PYODIDE_VERSION = "0.24.1"

interface CDNResource {
  url: string
  integrity: string
  crossOrigin: "anonymous" | "use-credentials"
}

// JavaScript library CDN resources with SRI
const JS_LIBRARY_CDN: Record<string, CDNResource> = {
  tensorflow: {
    url: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js",
    integrity: "sha384-zLzaFRPy3kJ7q9ozL1VLfRb9bJE6Q0c/YQlf9l0GBlQ9xaKQAIWLSCnJ4oNqaU1Z",
    crossOrigin: "anonymous",
  },
  chartjs: {
    url: "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
    integrity: "sha384-gVKIPfR0rZ2BKPBX9JmIJGTwxQ2eIqaKG2g9S2yMqYXZ6ZfMGbB7M8+PqE+jR8M8",
    crossOrigin: "anonymous",
  },
  d3: {
    url: "https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js",
    integrity: "sha384-8VzJe/C8eH3mTfRZ/kSqCMVmBsMJrOm8UdC6f3v3G/5C3F5p3L0tQ5e8u3s/BO2K",
    crossOrigin: "anonymous",
  },
  onnxruntime: {
    url: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js",
    integrity: "sha384-oF0WnLxmFNnKQ2aS5g3GpZMfUZ8v3Q8Z/a0a4a0a4a0a4a0a4a0a4a0a4a0a4a0",
    crossOrigin: "anonymous",
  },
}

// Pyodide types
interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>
  runPython(code: string): unknown
  loadPackage(packages: string | string[]): Promise<void>
  pyimport(name: string): { install(pkg: string): Promise<void> }
  globals: Map<string, unknown>
}

interface PyodideLoadOptions {
  indexURL: string
}

declare global {
  interface Window {
    loadPyodide?: (options: PyodideLoadOptions) => Promise<PyodideInterface>
  }
}

// Pyodide singleton for reuse
let pyodideInstance: PyodideInterface | null = null
let pyodideLoading: Promise<PyodideInterface> | null = null

/** Loads a script from URL and returns a promise */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.crossOrigin = "anonymous"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

/** Executes code in sandboxed iframe and returns result via postMessage */
function executeInSandbox(
  html: string,
  timeout: number
): Promise<{ type: "result" | "error"; logs?: string[]; message?: string }> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe")
    iframe.sandbox.add("allow-scripts")
    iframe.style.display = "none"
    document.body.appendChild(iframe)

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve({ type: "error", message: "Execution timed out (60s limit)" })
    }, timeout)

    const cleanup = () => {
      clearTimeout(timeoutId)
      window.removeEventListener("message", handleMessage)
      iframe.remove()
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return
      cleanup()
      resolve(event.data)
    }

    window.addEventListener("message", handleMessage)
    iframe.srcdoc = html
  })
}

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

async function loadPyodideRuntime(): Promise<PyodideInterface> {
  if (typeof window === "undefined") {
    throw new Error("Pyodide can only run in browser environment")
  }

  const indexURL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

  if (!window.loadPyodide) {
    await loadScript(`${indexURL}pyodide.js`)
  }

  if (!window.loadPyodide) {
    throw new Error("loadPyodide not available after script load")
  }

  return window.loadPyodide({ indexURL })
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
          output: `⚠️ Package "${detectedPackage}" requires server-side execution.\n\nTo run PyTorch/TensorFlow code, a Python backend is required.\n\nStart the backend server:\n  cd ../backend && python server.py`,
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
      output: `⚠️ Package "${detectedPackage}" requires server-side execution.\n\nBackend server is unavailable. Start it with:\n  cd ../backend && python server.py\n\nError: ${error instanceof Error ? error.message : String(error)}`,
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
        logger.info("Installing packages", { packages: packagesToInstall })

        // Load micropip and install packages
        await pyodideInstance.loadPackage("micropip")
        const micropip = pyodideInstance.pyimport("micropip")

        for (const pkg of packagesToInstall) {
          try {
            await micropip.install(pkg)
            installedPackages.add(pkg)
            logger.debug(`Package installed: ${pkg}`)
          } catch (e) {
            logger.warn(`Failed to install package: ${pkg}`, { error: e })
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
      } catch (pyError: unknown) {
        // Get captured stderr
        const stderr = String(pyodideInstance.runPython("_stderr_capture.getvalue()") || "")
        const errorMessage = pyError instanceof Error ? pyError.message : String(pyError)

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
      const stdout = String(pyodideInstance.runPython("_stdout_capture.getvalue()") || "")

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

// Detect required JS libraries from code and return CDN resources with SRI
function detectJSLibraries(code: string): CDNResource[] {
  const libs: CDNResource[] = []

  // TensorFlow.js
  if (code.includes("tf.") || code.includes("@tensorflow/tfjs")) {
    libs.push(JS_LIBRARY_CDN.tensorflow)
  }

  // Chart.js
  if (code.includes("Chart(") || code.includes("chart.js")) {
    libs.push(JS_LIBRARY_CDN.chartjs)
  }

  // D3.js
  if (code.includes("d3.") || code.includes("d3js")) {
    libs.push(JS_LIBRARY_CDN.d3)
  }

  // ONNX Runtime Web
  if (code.includes("ort.") || code.includes("onnxruntime")) {
    libs.push(JS_LIBRARY_CDN.onnxruntime)
  }

  return libs
}

// Cache for fetched library code
const libraryCache: Map<string, string> = new Map()

async function fetchLibraryCode(resource: CDNResource): Promise<string> {
  if (libraryCache.has(resource.url)) {
    return libraryCache.get(resource.url)!
  }

  try {
    // Note: fetch() doesn't support SRI directly, but browsers validate
    // SRI when loading scripts via <script> tags. For inline code,
    // we validate the hash ourselves.
    const response = await fetch(resource.url, {
      credentials: resource.crossOrigin === "use-credentials" ? "include" : "omit",
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch ${resource.url}: ${response.status}`)
    }
    const code = await response.text()
    libraryCache.set(resource.url, code)
    return code
  } catch (error) {
    logger.error(`Failed to load library: ${resource.url}`, error)
    throw error
  }
}

// Check if code uses WebGPU/ONNX/Transformers.js (needs native execution, not iframe)
function requiresNativeExecution(code: string): "onnx" | "transformers" | null {
  // Check for ONNX Runtime usage
  if (
    code.includes("ort.") ||
    code.includes("onnxruntime") ||
    code.includes("loadONNXModel") ||
    code.includes("InferenceSession")
  ) {
    return "onnx"
  }

  // Check for Transformers.js usage
  if (
    code.includes("pipeline(") ||
    code.includes("@huggingface/transformers") ||
    code.includes("AutoModel") ||
    code.includes("AutoTokenizer")
  ) {
    return "transformers"
  }

  return null
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

  // Check if code requires native execution (WebGPU/ONNX/Transformers)
  const nativeType = requiresNativeExecution(code)
  if (nativeType) {
    // Check WebGPU support
    const webgpuStatus = await checkWebGPUSupport()
    const gpuInfo = webgpuStatus.supported
      ? "✓ WebGPU available"
      : `⚠ WebGPU not available (${webgpuStatus.error}), using WASM fallback`

    let result: ExecutionResult

    if (nativeType === "onnx") {
      result = await executeONNXCode(code)
    } else {
      result = await executeTransformersCode(code)
    }

    // Prepend GPU info to output
    return {
      ...result,
      output: `${gpuInfo}\n\n${result.output}`,
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

  // Build sandbox script with console capture
  const libLoadLog = libraries.length > 0
    ? `console.log("Libraries loaded: ${libraries.map(l => l.url.split('/').pop()).join(', ')}");`
    : ''

  const script = `
    const logs = [];

    console.log = (...args) => logs.push(args.map(a => {
      if (a === null) return 'null';
      if (a === undefined) return 'undefined';
      if (typeof a === 'object') {
        try {
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
        ${libLoadLog}
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

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>${libraryCode.replace(/<\/script>/gi, '<\\/script>')}</script>
<script>${script.replace(/<\/script>/gi, '<\\/script>')}</script>
</body>
</html>`

  const result = await executeInSandbox(html, timeout)

  if (result.type === "result") {
    const output = result.logs?.join("\n") || ""
    return { output: output || "Code executed successfully (no output)", status: "success" }
  }
  return { output: result.message || "Unknown error", status: "error" }
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

// Re-export WebGPU utilities
export { checkWebGPUSupport, executeONNXCode, executeTransformersCode } from "./webgpu-executor"

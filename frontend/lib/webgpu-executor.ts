// WebGPU executor for running ML models in the browser
import * as ort from "onnxruntime-web"

export interface WebGPUExecutionResult {
  output: string
  status: "success" | "error"
  data?: any
}

// Check if WebGPU is available
export async function checkWebGPUSupport(): Promise<{
  supported: boolean
  adapter?: GPUAdapter
  error?: string
}> {
  if (typeof window === "undefined") {
    return { supported: false, error: "WebGPU is only available in browser" }
  }

  if (!navigator.gpu) {
    return { supported: false, error: "WebGPU is not supported in this browser" }
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      return { supported: false, error: "No WebGPU adapter found" }
    }
    return { supported: true, adapter }
  } catch (error) {
    return {
      supported: false,
      error: error instanceof Error ? error.message : "Failed to initialize WebGPU"
    }
  }
}

// Get available execution providers based on browser capabilities
export async function getAvailableProviders(): Promise<string[]> {
  const providers: string[] = ["wasm"] // WASM is always available

  const webgpu = await checkWebGPUSupport()
  if (webgpu.supported) {
    providers.unshift("webgpu") // Prefer WebGPU if available
  }

  return providers
}

// ONNX Runtime session cache
const sessionCache = new Map<string, ort.InferenceSession>()

// Load an ONNX model
export async function loadONNXModel(
  modelPath: string,
  options?: { forceReload?: boolean }
): Promise<{ session: ort.InferenceSession; provider: string }> {
  const cacheKey = modelPath

  if (!options?.forceReload && sessionCache.has(cacheKey)) {
    return { session: sessionCache.get(cacheKey)!, provider: "cached" }
  }

  const providers = await getAvailableProviders()

  // Configure ONNX Runtime
  ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4
  ort.env.wasm.simd = true

  let session: ort.InferenceSession | null = null
  let usedProvider = ""

  // Try each provider in order
  for (const provider of providers) {
    try {
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: [provider as ort.InferenceSession.ExecutionProviderConfig],
        graphOptimizationLevel: "all",
      })
      usedProvider = provider
      break
    } catch (error) {
      console.warn(`Failed to load model with ${provider}:`, error)
      continue
    }
  }

  if (!session) {
    throw new Error("Failed to load ONNX model with any available provider")
  }

  sessionCache.set(cacheKey, session)
  return { session, provider: usedProvider }
}

// Run inference on an ONNX model
export async function runONNXInference(
  session: ort.InferenceSession,
  inputs: Record<string, ort.Tensor>
): Promise<Record<string, ort.Tensor>> {
  const results = await session.run(inputs)
  return results
}

// Helper to create tensors from JavaScript arrays
export function createTensor(
  data: number[] | Float32Array | Int32Array | BigInt64Array,
  dims: number[],
  type: "float32" | "int32" | "int64" = "float32"
): ort.Tensor {
  return new ort.Tensor(type, data, dims)
}

// Execute ONNX-related code in browser
export async function executeONNXCode(code: string): Promise<WebGPUExecutionResult> {
  try {
    // Create a sandboxed execution context with ONNX Runtime available
    const context = {
      ort,
      loadONNXModel,
      runONNXInference,
      createTensor,
      checkWebGPUSupport,
      getAvailableProviders,
      console: {
        log: (...args: any[]) => logs.push(args.map(formatValue).join(" ")),
        error: (...args: any[]) => logs.push("Error: " + args.map(formatValue).join(" ")),
        warn: (...args: any[]) => logs.push("Warning: " + args.map(formatValue).join(" ")),
      },
    }

    const logs: string[] = []

    function formatValue(val: any): string {
      if (val === null) return "null"
      if (val === undefined) return "undefined"
      if (val instanceof ort.Tensor) {
        return `Tensor(${val.type}, [${val.dims.join(", ")}]): ${JSON.stringify(Array.from(val.data as any).slice(0, 10))}${val.data.length > 10 ? "..." : ""}`
      }
      if (typeof val === "object") {
        try {
          return JSON.stringify(val, null, 2)
        } catch {
          return String(val)
        }
      }
      return String(val)
    }

    // Wrap code in async function
    const wrappedCode = `
      return (async () => {
        ${code}
      })()
    `

    // Create function with context variables
    const fn = new Function(...Object.keys(context), wrappedCode)
    const result = await fn(...Object.values(context))

    if (result !== undefined) {
      logs.push(formatValue(result))
    }

    return {
      output: logs.join("\n") || "Code executed successfully (no output)",
      status: "success",
      data: result,
    }
  } catch (error) {
    return {
      output: error instanceof Error ? error.message : String(error),
      status: "error",
    }
  }
}

// Transformers.js integration for Hugging Face models
let transformersModule: any = null

async function loadTransformers() {
  if (!transformersModule) {
    transformersModule = await import("@huggingface/transformers")
  }
  return transformersModule
}

// Execute Transformers.js code
export async function executeTransformersCode(code: string): Promise<WebGPUExecutionResult> {
  try {
    const transformers = await loadTransformers()
    const logs: string[] = []

    function formatValue(val: any): string {
      if (val === null) return "null"
      if (val === undefined) return "undefined"
      if (typeof val === "object") {
        try {
          return JSON.stringify(val, null, 2)
        } catch {
          return String(val)
        }
      }
      return String(val)
    }

    const context = {
      ...transformers,
      console: {
        log: (...args: any[]) => logs.push(args.map(formatValue).join(" ")),
        error: (...args: any[]) => logs.push("Error: " + args.map(formatValue).join(" ")),
        warn: (...args: any[]) => logs.push("Warning: " + args.map(formatValue).join(" ")),
      },
    }

    const wrappedCode = `
      return (async () => {
        ${code}
      })()
    `

    const fn = new Function(...Object.keys(context), wrappedCode)
    const result = await fn(...Object.values(context))

    if (result !== undefined) {
      logs.push(formatValue(result))
    }

    return {
      output: logs.join("\n") || "Code executed successfully (no output)",
      status: "success",
      data: result,
    }
  } catch (error) {
    return {
      output: error instanceof Error ? error.message : String(error),
      status: "error",
    }
  }
}

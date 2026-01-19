// Feature flags and runtime configuration

// Pyodide configuration
export const PYODIDE_VERSION = "0.24.1"
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

// Package mappings for Pyodide (code import name -> pip package name)
export const PYODIDE_PACKAGE_MAP: Record<string, string> = {
  numpy: "numpy",
  pandas: "pandas",
  matplotlib: "matplotlib",
  scipy: "scipy",
  sklearn: "scikit-learn",
}

// JavaScript library CDN resources with SRI
export interface CDNResource {
  url: string
  integrity: string
  crossOrigin: "anonymous" | "use-credentials"
}

export const JS_LIBRARY_CDN: Record<string, CDNResource> = {
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

// Supported languages for code execution
export const EXECUTABLE_LANGUAGES = [
  "python",
  "py",
  "javascript",
  "js",
  "typescript",
  "ts",
] as const

// Feature toggles (can be used for A/B testing or gradual rollout)
export const FEATURES = {
  enableCodeExecution: true,
  enableWebGPU: true,
  enablePyodide: true,
  enableServerExecution: true,
} as const

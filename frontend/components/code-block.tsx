"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, Copy, Play, Loader2, XCircle, CheckCircle2, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { executeCode, isExecutableLanguage, onPyodideLoading, isPyodideLoading } from "@/lib/code-executor"

interface CodeBlockProps {
  code: string
  language?: string
}

type ExecutionStatus = "idle" | "loading-runtime" | "running" | "success" | "error"

// Token types for syntax highlighting
type TokenType = "keyword" | "string" | "number" | "comment" | "function" | "builtin" | "boolean" | "operator" | "punctuation" | "plain"

interface Token {
  type: TokenType
  value: string
}

// Simple tokenizer for syntax highlighting
function tokenize(code: string, language: string): Token[] {
  const tokens: Token[] = []
  
  const keywords = {
    javascript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of)\b/,
    typescript: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|type|interface|enum|implements|private|public|protected|readonly|static|abstract|as|is)\b/,
    python: /\b(def|class|if|elif|else|for|while|try|except|finally|with|return|import|from|as|pass|break|continue|raise|yield|lambda|and|or|not|in|is)\b/,
    sql: /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|DISTINCT|NULL|NOT|IN|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END)\b/i,
    bash: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|cd|ls|pwd|mkdir|rm|cp|mv|cat|grep|sed|awk|export|source)\b/,
  }
  
  const builtins = {
    javascript: /\b(console|Math|Array|Object|String|Number|Boolean|Date|JSON|Promise|Map|Set|RegExp|Error|parseInt|parseFloat|isNaN|isFinite)\b/,
    typescript: /\b(console|Math|Array|Object|String|Number|Boolean|Date|JSON|Promise|Map|Set|RegExp|Error|Record|Partial|Required|Pick|Omit|Exclude|Extract)\b/,
    python: /\b(print|len|range|str|int|float|list|dict|tuple|set|open|input|True|False|None)\b/,
    sql: /\b(COUNT|SUM|AVG|MAX|MIN|COALESCE|CAST|CONVERT)\b/i,
    bash: /\b(true|false)\b/,
  }
  
  const booleans = /\b(true|false|null|undefined|NaN|Infinity|True|False|None)\b/

  const lang = language.toLowerCase()
  const keywordRegex = keywords[lang as keyof typeof keywords] || keywords.javascript
  const builtinRegex = builtins[lang as keyof typeof builtins] || builtins.javascript

  // Split code into lines to handle comments properly
  const lines = code.split('\n')
  
  lines.forEach((line, lineIndex) => {
    let remaining = line
    let pos = 0
    
    while (remaining.length > 0) {
      let matched = false
      
      // Check for single-line comments
      const commentMatch = remaining.match(/^(\/\/.*|#.*|--.*)/);
      if (commentMatch) {
        tokens.push({ type: "comment", value: commentMatch[0] })
        remaining = remaining.slice(commentMatch[0].length)
        matched = true
        continue
      }
      
      // Check for strings
      const stringMatch = remaining.match(/^(['"`])(?:\\.|[^\\])*?\1/)
      if (stringMatch) {
        tokens.push({ type: "string", value: stringMatch[0] })
        remaining = remaining.slice(stringMatch[0].length)
        matched = true
        continue
      }
      
      // Check for numbers
      const numberMatch = remaining.match(/^\b\d+\.?\d*\b/)
      if (numberMatch) {
        tokens.push({ type: "number", value: numberMatch[0] })
        remaining = remaining.slice(numberMatch[0].length)
        matched = true
        continue
      }
      
      // Check for keywords
      const keywordMatch = remaining.match(new RegExp(`^${keywordRegex.source}`))
      if (keywordMatch) {
        tokens.push({ type: "keyword", value: keywordMatch[0] })
        remaining = remaining.slice(keywordMatch[0].length)
        matched = true
        continue
      }
      
      // Check for builtins
      const builtinMatch = remaining.match(new RegExp(`^${builtinRegex.source}`))
      if (builtinMatch) {
        tokens.push({ type: "builtin", value: builtinMatch[0] })
        remaining = remaining.slice(builtinMatch[0].length)
        matched = true
        continue
      }
      
      // Check for booleans
      const booleanMatch = remaining.match(new RegExp(`^${booleans.source}`))
      if (booleanMatch) {
        tokens.push({ type: "boolean", value: booleanMatch[0] })
        remaining = remaining.slice(booleanMatch[0].length)
        matched = true
        continue
      }
      
      // Check for function calls
      const funcMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/)
      if (funcMatch) {
        tokens.push({ type: "function", value: funcMatch[1] })
        remaining = remaining.slice(funcMatch[1].length)
        matched = true
        continue
      }
      
      // Check for operators
      const operatorMatch = remaining.match(/^(===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|^~])/)
      if (operatorMatch) {
        tokens.push({ type: "operator", value: operatorMatch[0] })
        remaining = remaining.slice(operatorMatch[0].length)
        matched = true
        continue
      }
      
      // Check for punctuation
      const punctMatch = remaining.match(/^[{}[\]();:,.]/)
      if (punctMatch) {
        tokens.push({ type: "punctuation", value: punctMatch[0] })
        remaining = remaining.slice(punctMatch[0].length)
        matched = true
        continue
      }
      
      // Plain text (identifiers, whitespace, etc)
      if (!matched) {
        const plainMatch = remaining.match(/^(\s+|[a-zA-Z_$][a-zA-Z0-9_$]*|.)/)
        if (plainMatch) {
          tokens.push({ type: "plain", value: plainMatch[0] })
          remaining = remaining.slice(plainMatch[0].length)
        } else {
          tokens.push({ type: "plain", value: remaining[0] })
          remaining = remaining.slice(1)
        }
      }
    }
    
    // Add newline between lines (except last line)
    if (lineIndex < lines.length - 1) {
      tokens.push({ type: "plain", value: "\n" })
    }
  })
  
  return tokens
}

// Color classes for each token type
const tokenColors: Record<TokenType, string> = {
  keyword: "text-pink-400",
  string: "text-emerald-400",
  number: "text-amber-400",
  comment: "text-neutral-500 italic",
  function: "text-blue-400",
  builtin: "text-yellow-400",
  boolean: "text-amber-400",
  operator: "text-neutral-300",
  punctuation: "text-neutral-400",
  plain: "text-neutral-200",
}

// Highlighted code component using React elements
function HighlightedCode({ code, language }: { code: string; language: string }) {
  const tokens = tokenize(code, language)
  
  return (
    <code className="text-sm font-mono">
      {tokens.map((token, i) => (
        <span key={i} className={tokenColors[token.type]}>
          {token.value}
        </span>
      ))}
    </code>
  )
}

// Component to render output with support for matplotlib plots
function OutputRenderer({ output }: { output: string }) {
  // Check for embedded plot data (use [\s\S] instead of . with s flag for compatibility)
  const plotMatch = output.match(/\[PLOT_DATA\]([\s\S]*?)\[\/PLOT_DATA\]/)

  if (plotMatch) {
    const base64Data = plotMatch[1]
    const textOutput = output.replace(/\[PLOT_DATA\][\s\S]*?\[\/PLOT_DATA\]/, "").trim()

    return (
      <div className="mt-1 space-y-2">
        {textOutput && (
          <div className="overflow-x-auto">
            <pre className="text-xs text-neutral-300 font-mono whitespace-pre">{textOutput}</pre>
          </div>
        )}
        <div className="rounded-lg overflow-hidden bg-white">
          <img
            src={`data:image/png;base64,${base64Data}`}
            alt="Plot output"
            className="max-w-full h-auto"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto mt-1">
      <pre className="text-xs text-neutral-300 font-mono whitespace-pre">{output}</pre>
    </div>
  )
}

export function CodeBlock({ code, language = "javascript" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("idle")
  const [executionOutput, setExecutionOutput] = useState<string>("")
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const canExecute = isExecutableLanguage(language)
  const isPython = language.toLowerCase() === "python" || language.toLowerCase() === "py"

  // Listen for Pyodide loading status
  useEffect(() => {
    if (!isPython) return

    const unsubscribe = onPyodideLoading((status) => {
      if (status === "loading" && executionStatus === "running") {
        setExecutionStatus("loading-runtime")
      } else if (status === "ready" && executionStatus === "loading-runtime") {
        setExecutionStatus("running")
      }
    })

    return unsubscribe
  }, [isPython, executionStatus])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setExecutionStatus("error")
      setExecutionOutput("Execution stopped by user")
    }
  }

  const handleRun = async () => {
    if (!canExecute) {
      setExecutionStatus("error")
      setExecutionOutput(`Language "${language}" is not supported for execution`)
      return
    }

    // Check if Pyodide is loading for Python
    if (isPython && isPyodideLoading()) {
      setExecutionStatus("loading-runtime")
      setExecutionOutput("")
    } else {
      setExecutionStatus("running")
      setExecutionOutput("")
    }

    const controller = new AbortController()
    setAbortController(controller)

    try {
      const result = await executeCode(code, language)

      // Check if aborted
      if (controller.signal.aborted) return

      setExecutionStatus(result.status)
      setExecutionOutput(result.output)
    } catch (error) {
      if (controller.signal.aborted) return

      setExecutionStatus("error")
      setExecutionOutput(error instanceof Error ? error.message : String(error))
    } finally {
      setAbortController(null)
    }
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-border/50 bg-neutral-900 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 dark:bg-neutral-900 border-b border-neutral-700/50">
        <span className="text-xs font-medium text-neutral-400 tracking-wide">
          {language}
        </span>
        <div className="flex items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied!" : "Copy code"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {canExecute && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {(executionStatus === "running" || executionStatus === "loading-runtime") ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-400 hover:text-red-400 hover:bg-neutral-700/50"
                      onClick={handleStop}
                    >
                      <Square className="h-3 w-3 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7",
                        executionStatus === "success" && "text-emerald-400",
                        executionStatus === "error" && "text-red-400",
                        executionStatus === "idle" && "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
                      )}
                      onClick={handleRun}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {(executionStatus === "running" || executionStatus === "loading-runtime") ? "Stop" : "Run code"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 min-w-fit">
          <HighlightedCode code={code} language={language} />
        </pre>
      </div>

      {/* Execution Result */}
      {executionStatus !== "idle" && (
        <div
          className={cn(
            "px-4 py-3 border-t border-neutral-700/50 flex items-start gap-2",
            executionStatus === "success" && "bg-emerald-500/10",
            executionStatus === "error" && "bg-red-500/10",
            (executionStatus === "running" || executionStatus === "loading-runtime") && "bg-blue-500/10"
          )}
        >
          {executionStatus === "loading-runtime" && (
            <>
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin mt-0.5" />
              <div className="flex-1">
                <span className="text-sm text-blue-400">Loading runtime...</span>
                <span className="text-xs text-neutral-500 block mt-0.5">
                  {language.toLowerCase().includes("python")
                    ? "First run loads Pyodide + packages (numpy, pandas, etc.)"
                    : "Loading WebGPU/ML runtime (ONNX, Transformers.js)"}
                </span>
              </div>
            </>
          )}
          {executionStatus === "running" && (
            <>
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin mt-0.5" />
              <span className="text-sm text-blue-400">Running...</span>
            </>
          )}
          {executionStatus === "success" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-emerald-400">Output</span>
                <OutputRenderer output={executionOutput} />
              </div>
            </>
          )}
          {executionStatus === "error" && (
            <>
              <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-red-400">Error</span>
                <div className="overflow-x-auto mt-1">
                  <pre className="text-xs text-red-400/80 font-mono whitespace-pre">{executionOutput}</pre>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

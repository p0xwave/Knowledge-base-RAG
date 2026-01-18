"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, Copy, Play, Loader2, XCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CodeBlockProps {
  code: string
  language?: string
}

type ExecutionStatus = "idle" | "running" | "success" | "error"

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

export function CodeBlock({ code, language = "javascript" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("idle")
  const [executionOutput, setExecutionOutput] = useState<string>("")

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRun = async () => {
    setExecutionStatus("running")
    setExecutionOutput("")

    setTimeout(() => {
      try {
        const hasError = code.includes("throw") || code.includes("error") || code.includes("undefined_var")
        
        if (hasError) {
          setExecutionStatus("error")
          setExecutionOutput("Error: Unexpected token or undefined variable")
        } else {
          setExecutionStatus("success")
          if (code.includes("console.log")) {
            const match = code.match(/console\.log\(['"](.*)['"]\)/)
            setExecutionOutput(match ? match[1] : "Code executed successfully")
          } else if (code.includes("return")) {
            setExecutionOutput("Returned: [result]")
          } else {
            setExecutionOutput("Code executed successfully")
          }
        }
      } catch {
        setExecutionStatus("error")
        setExecutionOutput("Execution failed")
      }
    }, 1500)
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    executionStatus === "running" && "text-blue-400",
                    executionStatus === "success" && "text-emerald-400",
                    executionStatus === "error" && "text-red-400",
                    executionStatus === "idle" && "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
                  )}
                  onClick={handleRun}
                  disabled={executionStatus === "running"}
                >
                  {executionStatus === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run code</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Code */}
      <pre className="p-4 overflow-x-auto">
        <HighlightedCode code={code} language={language} />
      </pre>

      {/* Execution Result */}
      {executionStatus !== "idle" && (
        <div
          className={cn(
            "px-4 py-3 border-t border-neutral-700/50 flex items-start gap-2",
            executionStatus === "success" && "bg-emerald-500/10",
            executionStatus === "error" && "bg-red-500/10",
            executionStatus === "running" && "bg-blue-500/10"
          )}
        >
          {executionStatus === "running" && (
            <>
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin mt-0.5" />
              <span className="text-sm text-blue-400">Running...</span>
            </>
          )}
          {executionStatus === "success" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-emerald-400">Success</span>
                <pre className="text-xs text-neutral-400 mt-1 font-mono">{executionOutput}</pre>
              </div>
            </>
          )}
          {executionStatus === "error" && (
            <>
              <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-red-400">Error</span>
                <pre className="text-xs text-red-400/80 mt-1 font-mono">{executionOutput}</pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

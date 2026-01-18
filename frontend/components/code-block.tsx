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

    // Simulate code execution
    setTimeout(() => {
      try {
        // For demo purposes, we'll simulate execution
        // In a real app, this would send to a backend or use a sandboxed environment
        const hasError = code.includes("throw") || code.includes("error") || code.includes("undefined_var")
        
        if (hasError) {
          setExecutionStatus("error")
          setExecutionOutput("Error: Unexpected token or undefined variable")
        } else {
          setExecutionStatus("success")
          // Simulate some output based on code content
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
    <div className="my-3 rounded-lg border border-border bg-muted/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {language}
        </span>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-chart-5" />
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
                    executionStatus === "running" && "text-primary",
                    executionStatus === "success" && "text-chart-5",
                    executionStatus === "error" && "text-destructive",
                    executionStatus === "idle" && "text-muted-foreground hover:text-foreground"
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
        <code className="text-sm font-mono text-foreground">{code}</code>
      </pre>

      {/* Execution Result */}
      {executionStatus !== "idle" && (
        <div
          className={cn(
            "px-4 py-3 border-t border-border flex items-start gap-2",
            executionStatus === "success" && "bg-chart-5/10",
            executionStatus === "error" && "bg-destructive/10",
            executionStatus === "running" && "bg-primary/10"
          )}
        >
          {executionStatus === "running" && (
            <>
              <Loader2 className="h-4 w-4 text-primary animate-spin mt-0.5" />
              <span className="text-sm text-primary">Running...</span>
            </>
          )}
          {executionStatus === "success" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-chart-5 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-chart-5">Success</span>
                <pre className="text-xs text-muted-foreground mt-1 font-mono">{executionOutput}</pre>
              </div>
            </>
          )}
          {executionStatus === "error" && (
            <>
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-destructive">Error</span>
                <pre className="text-xs text-destructive/80 mt-1 font-mono">{executionOutput}</pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

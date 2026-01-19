"use client"

import type React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TooltipButtonProps extends ButtonProps {
  tooltip: string
  children: React.ReactNode
}

/**
 * Button wrapped with Tooltip - reduces boilerplate
 * Used across: chat-main, code-block, and other components
 */
export function TooltipButton({ tooltip, children, ...buttonProps }: TooltipButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button {...buttonProps}>{children}</Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

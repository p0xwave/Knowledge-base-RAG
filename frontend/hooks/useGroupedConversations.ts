"use client"

import { useMemo } from "react"
import type { Conversation } from "@/lib/types"
import { ONE_DAY_MS } from "@/lib/constants"

export interface GroupedConversations {
  today: Conversation[]
  yesterday: Conversation[]
  older: Conversation[]
}

/**
 * Groups conversations by time period (today, yesterday, older)
 * and optionally filters by search query
 */
export function useGroupedConversations(
  conversations: Conversation[],
  searchQuery: string = ""
): GroupedConversations {
  return useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    const filtered = query
      ? conversations.filter((c) => c.title.toLowerCase().includes(query))
      : conversations

    const now = Date.now()
    const today = new Date()
    const yesterday = new Date(now - ONE_DAY_MS)

    return {
      today: filtered.filter((c) => c.updatedAt.toDateString() === today.toDateString()),
      yesterday: filtered.filter((c) => c.updatedAt.toDateString() === yesterday.toDateString()),
      older: filtered.filter((c) => {
        const isToday = c.updatedAt.toDateString() === today.toDateString()
        const isYesterday = c.updatedAt.toDateString() === yesterday.toDateString()
        return !isToday && !isYesterday
      }),
    }
  }, [conversations, searchQuery])
}

/**
 * Utility to check if any group has conversations
 */
export function hasConversations(groups: GroupedConversations): boolean {
  return groups.today.length > 0 || groups.yesterday.length > 0 || groups.older.length > 0
}

/**
 * Get total count of conversations across all groups
 */
export function getTotalCount(groups: GroupedConversations): number {
  return groups.today.length + groups.yesterday.length + groups.older.length
}

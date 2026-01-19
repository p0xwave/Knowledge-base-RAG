"use client"

import { useState, useMemo } from "react"

/**
 * Generic search hook for filtering items by a search query
 * Used across: documents/page, sources-panel, chat-sidebar
 */
export function useSearch<T>(items: T[], searchFn: (item: T, query: string) => boolean) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const lowerQuery = searchQuery.toLowerCase()
    return items.filter((item) => searchFn(item, lowerQuery))
  }, [items, searchQuery, searchFn])

  const clearSearch = () => setSearchQuery("")

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    clearSearch,
    hasResults: filteredItems.length > 0,
    resultCount: filteredItems.length,
  }
}

/**
 * Simple search by name/title field
 */
export function useNameSearch<T extends { name: string }>(items: T[]) {
  return useSearch(items, (item, query) => item.name.toLowerCase().includes(query))
}

/**
 * Search by title field
 */
export function useTitleSearch<T extends { title: string }>(items: T[]) {
  return useSearch(items, (item, query) => item.title.toLowerCase().includes(query))
}

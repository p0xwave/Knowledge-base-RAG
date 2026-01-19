import type { Conversation, Message } from "@/lib/types"

export interface MessageGroup {
  userMessage: Message
  responses: Message[]
}

export function useMessageGroups(conversation: Conversation | null): MessageGroup[] {
  if (!conversation) return []

  const groups: MessageGroup[] = []

  for (let i = 0; i < conversation.messages.length; i++) {
    const msg = conversation.messages[i]
    if (msg.role === "user") {
      const responses: Message[] = []
      for (let j = i + 1; j < conversation.messages.length; j++) {
        const nextMsg = conversation.messages[j]
        if (
          nextMsg.role === "assistant" &&
          (nextMsg.parentMessageId === msg.id || (j === i + 1 && !nextMsg.parentMessageId))
        ) {
          responses.push(nextMsg)
        }
        if (nextMsg.role === "user") break
      }
      groups.push({ userMessage: msg, responses })
    }
  }

  return groups
}

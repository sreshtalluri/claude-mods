export type ReceiptStats = {
  turns: number
  interrupts: number
  toolCalls: number
  failedCalls: number
  deniedCalls: number
  toolCounts: Record<string, number>
  editCounts: Record<string, number>
  longest: { tool: string; ms: number } | null
  tokensIn: number
  tokensOut: number
  cacheRead: number
  cacheWrite: number
  absolutelyRight: number
  apologies: number
}

export type ReceiptLifetime = { sessions: number; usd: number }

declare module 'claude-code' {
  interface PluginState {
    'session-receipt': { stats: ReceiptStats }
  }
}

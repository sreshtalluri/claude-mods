export type GrindStats = { played: number; won: number; streak: number; best: number; lastWin: number }

export type GrindData = {
  /** The day `saves` and `note` belong to (days since 2026-01-01). */
  day: number
  /** Today's save per game id, in whatever shape that game keeps. */
  saves: Record<string, unknown>
  /** Results per game id, kept across days. */
  stats: Record<string, GrindStats>
  /** The game on screen, or null for the menu. */
  open: string | null
  /** One line of feedback under the current game. */
  note: string
  /** The menu tab on screen: the originals, or the familiar formats. */
  tab?: 'new' | 'classics'
}

declare module 'claude-code' {
  interface PluginState {
    'daily-grind': { data: GrindData }
  }
}

import type { GrindData, GrindStats } from '../types'
import type { Game } from './games/types'

const DAY = 86_400_000
const EPOCH = Date.UTC(2026, 0, 1)

/** Days since 2026-01-01 by the local calendar, so everyone's puzzle flips at their own midnight. */
export const dayIndex = (now: number): number => {
  const d = new Date(now)
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / DAY)
}

/** The day's item of a list that repeats once it runs out. */
export const cycle = <T>(list: readonly T[], day: number): T => list[((day % list.length) + list.length) % list.length]!

/** A small seeded PRNG (mulberry32): the same day shuffles the same way everywhere. */
export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ---- Day state, streaks, sharing ----

const freshStats = (): GrindStats => ({ played: 0, won: 0, streak: 0, best: 0, lastWin: -2 })

export const emptyData = (): GrindData => ({ day: -1, saves: {}, stats: {}, open: null, note: '' })

/** The data as of `day`: yesterday's saves and note are dropped. */
export const forDay = (d: GrindData, day: number): GrindData =>
  d.day === day ? d : { ...d, day, saves: {}, note: '' }

/** A game's save for today, fresh when it has none yet. */
export const saveOf = (g: Game, d: GrindData) => (g.id in d.saves ? d.saves[g.id] : g.fresh(g.puzzle(d.day)))

export const statsOf = (g: Game, d: GrindData) => d.stats[g.id] ?? freshStats()

export type Progress = 'new' | 'playing' | 'won' | 'lost'

/** Where a game stands today: untouched, under way, or finished. */
export const progressOf = (g: Game, d: GrindData): Progress => {
  const p = g.puzzle(d.day)
  const s = saveOf(g, d)
  const st = g.status(p, s)
  return st !== 'playing' ? st : JSON.stringify(s) === JSON.stringify(g.fresh(p)) ? 'new' : 'playing'
}

export const record = (s: GrindStats, day: number, won: boolean): GrindStats => {
  const streak = won ? (s.lastWin === day - 1 ? s.streak + 1 : 1) : 0
  return {
    played: s.played + 1,
    won: s.won + (won ? 1 : 0),
    streak,
    best: Math.max(s.best, streak),
    lastWin: won ? day : s.lastWin,
  }
}

/** The streak as it stands today: one not extended yesterday or today has lapsed. */
export const liveStreak = (s: GrindStats, day: number) => (s.lastWin >= day - 1 ? s.streak : 0)

/** Applies a move to game `g`: stores the new save and records the result the first time the game ends. */
export const settle = (d: GrindData, g: Game, save: unknown): GrindData => {
  const p = g.puzzle(d.day)
  const was = g.status(p, saveOf(g, d))
  const now = g.status(p, save)
  const next = { ...d, saves: { ...d.saves, [g.id]: save } }
  if (was !== 'playing' || now === 'playing') return next
  return { ...next, stats: { ...next.stats, [g.id]: record(statsOf(g, d), d.day, now === 'won') } }
}

/** The share card of a finished game, or null while it is still being played. */
export const shareText = (g: Game, d: GrindData): string | null => {
  const p = g.puzzle(d.day)
  const s = saveOf(g, d)
  return g.status(p, s) === 'playing' ? null : `Daily Grind · ${g.name} #${d.day + 1}  ${g.share(p, s)}`
}

/** Text made safe for SVG markup. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The font desktop SVGs draw with. */
export const FONT = `font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"`

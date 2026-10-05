/**
 * Codebreaker: deduce a hidden code of 4 symbols (repeats allowed) from 6 in 8 guesses.
 * Classic bulls-and-cows code deduction. Pure logic, no Date, no UI.
 *
 * Codes are 4-letter strings over LETTERS ("ROTB"); SYMBOLS maps letters to names.
 *
 *   meta                          { id, name, category, tagline }
 *   SYMBOLS, LETTERS, LEN, COLORS, TRIES
 *   score(code, guess)            { exact, near }   (repeats counted once each)
 *   parse(text)                   code | null       ("rotb", "R O T B", "r,o,t,b")
 *   puzzle(day)                   the day's code, same for everyone
 *   start(day, hard?)             fresh State
 *   guess(state, g)               new State | { error }   (g: code or raw text)
 *   consistent(state, g)          true if g fits every previous feedback (hard mode rule)
 *   isWon / isDone(state)
 *   remaining(state)              how many of the 1296 codes still fit the feedback
 *   share(state)                  "Codebreaker #12 4/8" + one ●○· row per guess (X/8 on a loss)
 */

export const meta = {
  id: 'codebreaker',
  name: 'Codebreaker',
  category: 'Everyone',
  tagline: 'Crack the color code in eight guesses',
} as const
export const { id, name, category, tagline } = meta

export const SYMBOLS = { R: 'red', O: 'orange', T: 'teal', B: 'blue', V: 'violet', P: 'pink' } as const
export type Letter = keyof typeof SYMBOLS
export const LETTERS = Object.keys(SYMBOLS).join('') // 'ROTBVP'
export const LEN = 4
export const COLORS = LETTERS.length
export const TRIES = 8

export type Feedback = { exact: number; near: number }
export type Row = Feedback & { guess: string }
export type State = { day: number; code: string; hard: boolean; rows: Row[] }

export const score = (code: string, guess: string): Feedback => {
  let exact = 0
  const left: Record<string, number> = {}
  const rest: string[] = []
  for (let i = 0; i < LEN; i++) {
    if (code[i] === guess[i]) exact++
    else {
      left[code[i]!] = (left[code[i]!] ?? 0) + 1
      rest.push(guess[i]!)
    }
  }
  let near = 0
  for (const c of rest) if (left[c]) { left[c]--; near++ }
  return { exact, near }
}

export const parse = (text: string): string | null => {
  const s = text.toUpperCase().replace(/[\s,]+/g, '')
  return s.length === LEN && [...s].every(c => LETTERS.includes(c)) ? s : null
}

/** mulberry32, salted so Codebreaker doesn't share a stream with other games. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const puzzle = (day: number): string => {
  const r = rng(Math.imul(day, 0x9e3779b1) ^ 0xc0deb4e)
  let s = ''
  for (let i = 0; i < LEN; i++) s += LETTERS[Math.floor(r() * COLORS)]
  return s
}

export const start = (day: number, hard = false): State => ({ day, code: puzzle(day), hard, rows: [] })

export const isWon = (s: State) => s.rows.some(r => r.exact === LEN)
export const isDone = (s: State) => isWon(s) || s.rows.length >= TRIES

export const consistent = (s: State, g: string) =>
  s.rows.every(r => { const f = score(g, r.guess); return f.exact === r.exact && f.near === r.near })

export const guess = (s: State, g: string): State | { error: string } => {
  if (isDone(s)) return { error: 'Game over.' }
  const code = parse(g)
  if (!code) return { error: `Four of ${LETTERS}, e.g. ROTB.` }
  if (s.rows.some(r => r.guess === code)) return { error: `Already tried ${code}.` }
  if (s.hard && !consistent(s, code)) return { error: `Hard mode: ${code} doesn't fit earlier clues.` }
  return { ...s, rows: [...s.rows, { guess: code, ...score(s.code, code) }] }
}

const ALL: string[] = (() => {
  let out = ['']
  for (let i = 0; i < LEN; i++) out = out.flatMap(p => [...LETTERS].map(c => p + c))
  return out
})()

export const remaining = (s: State) => ALL.filter(c => consistent(s, c)).length

export const share = (s: State): string => {
  const head = `Codebreaker #${s.day} ${isWon(s) ? s.rows.length : 'X'}/${TRIES}${s.hard ? '*' : ''}`
  const rows = s.rows.map(r => '●'.repeat(r.exact) + '○'.repeat(r.near) + '·'.repeat(LEN - r.exact - r.near))
  return [head, ...rows].join('\n')
}

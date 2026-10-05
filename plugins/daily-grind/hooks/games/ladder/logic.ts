/**
 * Ladder: Lewis Carroll's "doublets". Turn the start word into the target word one letter at a time;
 * every rung must be a real word. Par is the fewest possible moves (BFS over WORDS).
 *
 * API (pure, no I/O; state is a plain JSON-safe object):
 *   meta                          { id: 'ladder', name: 'Ladder', category: 'Everyone', tagline }
 *   isWord(w)                     true when w is in the dictionary
 *   neighbors(w)                  dictionary words exactly one letter away from w
 *   shortestPath(a, b)            a shortest ladder [a, ..., b], or null if none
 *   puzzle(day)                   { day, start, target, par } for a day index (cycles PAIRS)
 *   newGame(day)                  fresh LadderState: path = [start]
 *   step(state, word)             new state with word appended, or { error } saying why not
 *   undo(state)                   state minus its last rung (never removes the start word)
 *   isDone(state)                 last rung is the target
 *   moves(state)                  rungs climbed so far (path.length - 1)
 *   vsPar(state)                  moves - par (negative is impossible; 0 is par)
 *   hint(state)                   next word on a shortest path from the current word, or null
 *   marks(state)                  one marker per move: ▲ closer to the target, ■ same distance, ▼ further away
 *   shareText(state)              e.g. "Ladder #12 🪜 5 (par 5) ⛳" plus a line of marks
 */
import { PAIRS, WORDS } from './data'

export const meta = { id: 'ladder', name: 'Ladder', category: 'Everyone', tagline: 'One letter at a time, cold to warm' } as const

export type LadderPuzzle = { day: number; start: string; target: string; par: number }
export type LadderState = LadderPuzzle & { path: string[] }

const DICT = new Set(WORDS)
const ABC = 'abcdefghijklmnopqrstuvwxyz'

export const isWord = (w: string): boolean => DICT.has(w)

export const neighbors = (w: string): string[] => {
  const out: string[] = []
  for (let i = 0; i < w.length; i++)
    for (const c of ABC) {
      if (c === w[i]) continue
      const n = w.slice(0, i) + c + w.slice(i + 1)
      if (DICT.has(n)) out.push(n)
    }
  return out
}

/** BFS distances from `from` to every reachable word. Cached: puzzles only ever ask about a few targets. */
const distCache = new Map<string, Map<string, number>>()
const distancesFrom = (from: string): Map<string, number> => {
  let d = distCache.get(from)
  if (d) return d
  d = new Map([[from, 0]])
  const queue = [from]
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i]!
    for (const v of neighbors(u)) if (!d.has(v)) { d.set(v, d.get(u)! + 1); queue.push(v) }
  }
  distCache.set(from, d)
  return d
}

/** Next rung toward `target`: the alphabetically first neighbor one step closer. */
const nextToward = (w: string, target: string): string | null => {
  const d = distancesFrom(target)
  const here = d.get(w)
  if (here === undefined || here === 0) return null
  return neighbors(w).filter(n => d.get(n) === here - 1).sort()[0] ?? null
}

export const shortestPath = (a: string, b: string): string[] | null => {
  if (!isWord(a) || !isWord(b) || distancesFrom(b).get(a) === undefined) return null
  const path = [a]
  while (path[path.length - 1] !== b) path.push(nextToward(path[path.length - 1]!, b)!)
  return path
}

export const puzzle = (day: number): LadderPuzzle => {
  const [start, target, par] = PAIRS[((day % PAIRS.length) + PAIRS.length) % PAIRS.length]!
  return { day, start, target, par }
}

export const newGame = (day: number): LadderState => {
  const p = puzzle(day)
  return { ...p, path: [p.start] }
}

const current = (s: LadderState) => s.path[s.path.length - 1]!
const lettersChanged = (a: string, b: string) => [...a].filter((c, i) => c !== b[i]).length

export const isDone = (s: LadderState): boolean => current(s) === s.target

export const step = (s: LadderState, raw: string): LadderState | { error: string } => {
  const word = raw.trim().toLowerCase()
  if (isDone(s)) return { error: 'Already solved.' }
  if (!/^[a-z]{4}$/.test(word)) return { error: 'Words are exactly four letters.' }
  const changed = lettersChanged(current(s), word)
  if (changed === 0) return { error: 'Change one letter.' }
  if (changed > 1) return { error: `Change only one letter (that's ${changed}).` }
  if (!isWord(word)) return { error: `"${word}" isn't in the word list.` }
  if (s.path.includes(word)) return { error: `"${word}" is already on your ladder.` }
  return { ...s, path: [...s.path, word] }
}

export const undo = (s: LadderState): LadderState => (s.path.length > 1 ? { ...s, path: s.path.slice(0, -1) } : s)

export const moves = (s: LadderState): number => s.path.length - 1
export const vsPar = (s: LadderState): number => moves(s) - s.par

export const hint = (s: LadderState): string | null => nextToward(current(s), s.target)

export type Mark = '▲' | '■' | '▼'

export const marks = (s: LadderState): Mark[] => {
  const d = distancesFrom(s.target)
  const far = (w: string) => d.get(w) ?? Infinity
  return s.path.slice(1).map((w, i) => {
    const before = far(s.path[i]!), after = far(w)
    return after < before ? '▲' : after === before ? '■' : '▼'
  })
}

export const shareText = (s: LadderState): string => {
  const over = vsPar(s)
  const badge = !isDone(s) ? '…' : over === 0 ? '⛳' : `+${over}`
  return `Ladder #${s.day + 1} 🪜 ${moves(s)} (par ${s.par}) ${badge}\n${marks(s).join('')}`
}

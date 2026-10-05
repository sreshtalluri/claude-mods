/**
 * Install Order: a daily deduction puzzle. Put 5-7 packages in the one install order that satisfies every clue.
 *
 * API (pure, no Date, no I/O):
 *   meta                          { id: 'installorder', name, category: 'Developer', tagline }
 *   puzzle(day) -> Puzzle         deterministic for a day index: { day, packages (shuffled start order), clues, answer }
 *   generate(seed) -> Puzzle      the generator puzzle() uses (day = seed)
 *   satisfies(order, clue)        does an order meet one clue
 *   solutions(packages, clues)    every order meeting all clues (brute force; fine for <= 7)
 *   clueText(clue)                human-readable clue, e.g. "cli installs after ui but before docs"
 *   judge(puzzle, order)          -> { solved, violated: clue indexes broken by this order }
 *   move(order, from, to)         returns a new order with one item moved (for up/down or place-by-position)
 *   shareText(puzzle, history)    history = violated-index lists per submit, last one [] when solved
 *   SOLVED_WITHIN                 submits that still count as "solved" for streak scoring (3)
 */

export const meta = {
  id: 'installorder',
  name: 'Install Order',
  category: 'Developer',
  tagline: 'Order packages to satisfy every clue',
} as const

export const SOLVED_WITHIN = 3

export type Clue =
  | { kind: 'needs'; a: string; b: string } // b installs before a
  | { kind: 'between'; a: string; lo: string; hi: string } // lo < a < hi
  | { kind: 'within'; a: string; k: number; end: 'first' | 'last' }
  | { kind: 'adjacent'; a: string; b: string }
  | { kind: 'ends'; a: string }
  | { kind: 'gap'; a: string; b: string; k: number } // exactly k packages between a and b

export type Puzzle = { day: number; packages: string[]; clues: Clue[]; answer: string[] }

const POOL = [
  'core', 'left-pad', 'theme', 'icons', 'ui', 'cli', 'docs', 'is-odd', 'is-even', 'router',
  'logger', 'config', 'polyfill', 'hot-reload', 'yolo-cache', 'tiny-uuid', 'auth', 'lint',
]

export const satisfies = (order: readonly string[], c: Clue): boolean => {
  const p = (x: string) => order.indexOf(x)
  const n = order.length
  switch (c.kind) {
    case 'needs': return p(c.b) < p(c.a)
    case 'between': return p(c.lo) < p(c.a) && p(c.a) < p(c.hi)
    case 'within': return c.end === 'first' ? p(c.a) < c.k : p(c.a) >= n - c.k
    case 'adjacent': return Math.abs(p(c.a) - p(c.b)) === 1
    case 'ends': return p(c.a) === 0 || p(c.a) === n - 1
    case 'gap': return Math.abs(p(c.a) - p(c.b)) === c.k + 1
  }
}

const permutations = <T>(xs: readonly T[]): T[][] =>
  xs.length <= 1 ? [[...xs]] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(r => [x, ...r]))

export const solutions = (packages: readonly string[], clues: readonly Clue[]): string[][] =>
  permutations(packages).filter(o => clues.every(c => satisfies(o, c)))

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven']

export const clueText = (c: Clue): string => {
  switch (c.kind) {
    case 'needs': return `${c.a} needs ${c.b}`
    case 'between': return `${c.a} installs after ${c.lo} but before ${c.hi}`
    case 'within': return `${c.a} is in the ${c.end} ${WORDS[c.k]}`
    case 'adjacent': return `nothing installs between ${c.a} and ${c.b}`
    case 'ends': return `${c.a} is first or last`
    case 'gap': return `exactly ${WORDS[c.k]} package${c.k === 1 ? '' : 's'} install${c.k === 1 ? 's' : ''} between ${c.a} and ${c.b}`
  }
}

/** mulberry32 */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const shuffle = <T>(xs: readonly T[], r: () => number): T[] => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Every clue that holds for the answer. Indirect clues are listed twice so they're drawn twice as often as plain deps. */
const candidates = (s: readonly string[]): Clue[] => {
  const n = s.length
  const out: Clue[] = []
  const twice = (c: Clue) => out.push(c, c)
  s.forEach((a, i) => {
    if (i === 0 || i === n - 1) twice({ kind: 'ends', a })
    for (const k of [2, 3]) {
      if (i < k) twice({ kind: 'within', a, k, end: 'first' })
      if (i >= n - k) twice({ kind: 'within', a, k, end: 'last' })
    }
    s.forEach((b, j) => {
      if (j < i) out.push({ kind: 'needs', a, b })
      if (j === i + 1) twice({ kind: 'adjacent', a, b })
      if (j - i === 2 || j - i === 3) twice({ kind: 'gap', a, b, k: j - i - 1 })
      s.forEach((hi, h) => { if (j < i && i < h) twice({ kind: 'between', a, lo: b, hi }) })
    })
  })
  return out
}

/** Draw true clues until only the answer survives, then drop any clue the rest make redundant (keeping at least 4).
 *  A draw that pins the answer in under 4 clues is too easy: reroll from the same stream. */
export const generate = (seed: number): Puzzle => {
  const r = rng(seed * 2654435761 + 0x1234567)
  for (;;) {
    const p = attempt(seed, r)
    if (p.clues.length >= 4) return p
  }
}

const attempt = (seed: number, r: () => number): Puzzle => {
  const n = 5 + Math.floor(r() * 3)
  const answer = shuffle(POOL, r).slice(0, n)
  const all = permutations(answer)
  const pool = shuffle(candidates(answer), r)
  let alive = all
  let clues: Clue[] = []
  for (const c of pool) {
    if (alive.length === 1) break
    const next = alive.filter(o => satisfies(o, c))
    if (next.length < alive.length) { clues.push(c); alive = next }
  }
  for (const c of shuffle(clues, r)) {
    if (clues.length <= 4) break
    const rest = clues.filter(x => x !== c)
    if (all.filter(o => rest.every(x => satisfies(o, x))).length === 1) clues = rest
  }
  let packages = shuffle(answer, r)
  if (packages.join() === answer.join()) packages = [...packages.slice(1), packages[0]!]
  return { day: seed, packages, clues: shuffle(clues, r), answer }
}

export const puzzle = (day: number): Puzzle => generate(day)

export const judge = (p: Puzzle, order: readonly string[]) => {
  const violated = p.clues.flatMap((c, i) => (satisfies(order, c) ? [] : [i]))
  return { solved: violated.length === 0, violated }
}

export const move = (order: readonly string[], from: number, to: number): string[] => {
  const a = [...order]
  const [x] = a.splice(from, 1)
  a.splice(Math.max(0, Math.min(to, a.length)), 0, x!)
  return a
}

/** One row per submit: a link per clue kept, a crack per clue broken. Last row is all links when solved. */
export const shareText = (p: Puzzle, history: readonly (readonly number[])[]): string => {
  const solved = history.length > 0 && history[history.length - 1]!.length === 0
  const head = `Install Order #${p.day} 📦 ${solved ? `${history.length} ${history.length === 1 ? 'try' : 'tries'}` : 'dependency hell'}`
  const rows = history.map(v => p.clues.map((_, i) => (v.includes(i) ? '💥' : '🔗')).join(''))
  return [head, ...rows].join('\n')
}

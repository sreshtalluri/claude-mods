/**
 * Pixel Logic — fill cells to match the row and column clues and reveal a small picture.
 *
 * API (pure, no I/O; boards are flat arrays, index = row * size + col):
 *   meta                                  { id: 'pixellogic', name: 'Pixel Logic', category: 'Everyone', tagline }
 *   type Cell = 0 | 1 | 2                 0 blank, 1 filled, 2 marked empty (X)
 *   clues(rows)                           { rows: number[][], cols: number[][] } from '#'/'.' rows; an empty line is []
 *   countSolutions(rowClues, colClues, limit = 2)
 *                                         grids satisfying the clues, stopping at `limit` (line logic + backtracking)
 *   puzzle(day)                           today's Puzzle: 5×5 on Mondays, 10×10 otherwise; number = day + 1
 *   emptyBoard(p)                         all blank
 *   toggle(board, i, to)                  sets cell i to `to` (1 fill / 2 mark), or back to blank if it already is; new array
 *   isSolved(p, board)                    filled cells exactly match the picture (X and blank are both "empty")
 *   wrongCells(p, board)                  the "check" hint: filled cells that should be empty, X cells that should be filled
 *   isMistake(p, i, to)                   whether setting cell i to `to` contradicts the picture (for a mistake counter)
 *   shareText(p, { hints, mistakes?, seconds? })
 *                                         e.g. "Pixel Logic #12 🖼️ 10×10 · 0 hints" + a no-spoiler stats line
 *
 * `day` is days since 2026-01-01 (a Thursday) by the local calendar, as in the parent mod.
 */
import { FIVES, TENS, type Picture } from './data'

export const meta = { id: 'pixellogic', name: 'Pixel Logic', category: 'Everyone', tagline: 'Fill from the clues, reveal a picture' } as const

export type Cell = 0 | 1 | 2
export type Clues = { rows: number[][]; cols: number[][] }
export type Puzzle = { day: number; number: number; size: number; title: string; rows: string[]; clues: Clues }

const runs = (line: string): number[] => line.split('.').filter(Boolean).map(s => s.length)

export const clues = (rows: readonly string[]): Clues => ({
  rows: rows.map(runs),
  cols: [...rows[0]!].map((_, c) => runs(rows.map(r => r[c]).join(''))),
})

// ---- Solver ----

/** Every way to lay `clue` into `n` cells, as 0/1 arrays. */
const arrangements = (clue: number[], n: number): number[][] => {
  const out: number[][] = []
  const go = (k: number, at: number, line: number[]) => {
    if (k === clue.length) return void out.push([...line, ...Array(n - line.length).fill(0)])
    const rest = clue.slice(k + 1).reduce((a, b) => a + b + 1, 0)
    for (let s = at; s + clue[k]! + rest <= n; s++) {
      const next = [...line, ...Array(s - line.length).fill(0), ...Array(clue[k]!).fill(1)]
      go(k + 1, s + clue[k]! + 1, k + 1 < clue.length ? [...next, 0] : next)
    }
  }
  go(0, 0, [])
  return out
}

/** Grid cells: -1 unknown, 0 empty, 1 filled. */
export const countSolutions = (rowClues: number[][], colClues: number[][], limit = 2): number => {
  const h = rowClues.length
  const w = colClues.length
  const rowOpts = rowClues.map(c => arrangements(c, w))
  const colOpts = colClues.map(c => arrangements(c, h))
  let found = 0

  // Narrows each line's arrangements to those fitting the grid, then fixes cells all of them agree on.
  const propagate = (g: number[], ro: number[][][], co: number[][][]): boolean => {
    let changed = true
    while (changed) {
      changed = false
      for (let line = 0; line < h + w; line++) {
        const isRow = line < h
        const idx = isRow ? line : line - h
        const n = isRow ? w : h
        const at = (k: number) => (isRow ? idx * w + k : k * w + idx)
        const opts = (isRow ? ro : co)[idx]!.filter(a => a.every((v, k) => g[at(k)] === -1 || g[at(k)] === v))
        if (!opts.length) return false
        ;(isRow ? ro : co)[idx] = opts
        for (let k = 0; k < n; k++) {
          if (g[at(k)] !== -1) continue
          const v = opts[0]![k]!
          if (opts.every(a => a[k] === v)) {
            g[at(k)] = v
            changed = true
          }
        }
      }
    }
    return true
  }

  const search = (g: number[], ro: number[][][], co: number[][][]) => {
    if (found >= limit || !propagate(g, ro, co)) return
    const i = g.indexOf(-1)
    if (i < 0) return void (found += 1)
    for (const v of [1, 0]) {
      const next = [...g]
      next[i] = v
      search(next, [...ro], [...co])
    }
  }

  search(Array(h * w).fill(-1), rowOpts, colOpts)
  return found
}

// ---- Daily puzzle ----

const cycle = <T>(list: readonly T[], i: number): T => list[((i % list.length) + list.length) % list.length]!
const MONDAY = 4 // 2026-01-05 is day 4

export const isEasyDay = (day: number) => ((day % 7) + 7) % 7 === MONDAY

export const puzzle = (day: number): Puzzle => {
  const pic: Picture = isEasyDay(day) ? cycle(FIVES, Math.floor((day - MONDAY) / 7)) : cycle(TENS, day)
  return { day, number: day + 1, size: pic.rows.length, title: pic.title, rows: pic.rows, clues: clues(pic.rows) }
}

// ---- Play ----

const want = (p: Puzzle, i: number) => p.rows[Math.floor(i / p.size)]![i % p.size] === '#'

export const emptyBoard = (p: Puzzle): Cell[] => Array(p.size * p.size).fill(0)

export const toggle = (board: readonly Cell[], i: number, to: 1 | 2): Cell[] => {
  const next = [...board]
  next[i] = board[i] === to ? 0 : to
  return next
}

export const isSolved = (p: Puzzle, board: readonly Cell[]) => board.every((c, i) => (c === 1) === want(p, i))

export const wrongCells = (p: Puzzle, board: readonly Cell[]): number[] =>
  board.flatMap((c, i) => ((c === 1 && !want(p, i)) || (c === 2 && want(p, i)) ? [i] : []))

export const isMistake = (p: Puzzle, i: number, to: 1 | 2) => (to === 1) !== want(p, i)

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export const shareText = (p: Puzzle, r: { hints: number; mistakes?: number; seconds?: number }): string => {
  const head = `Pixel Logic #${p.number} 🖼️ ${p.size}×${p.size} · ${r.hints} hint${r.hints === 1 ? '' : 's'}`
  const bits = [
    r.mistakes === undefined ? '' : `✏️ ${r.mistakes} mistake${r.mistakes === 1 ? '' : 's'}`,
    r.seconds === undefined ? '' : `⏱️ ${clock(r.seconds)}`,
  ].filter(Boolean)
  return bits.length ? `${head}\n${bits.join('  ')}` : head
}

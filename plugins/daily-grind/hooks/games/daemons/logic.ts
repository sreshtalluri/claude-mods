import { cycle } from '../../shared'
import { DAEMONS } from './data'

export const N = 7
/** Cells holding a daemon (row-major index) and how many toggles it took. */
export type DaemonsSave = { cells: number[]; moves: number }

/** The day's board: each cell's region, 0-6. */
export const boardFor = (day: number) => [...cycle(DAEMONS, day)].map(c => c.charCodeAt(0) - 97)

/** `c4` is column c, row 4; null for anything else. */
export const parseCell = (s: string): number | null => {
  const m = /^([a-g])([1-7])$/.exec(s.trim().toLowerCase())
  return m ? (Number(m[2]) - 1) * N + (m[1]!.charCodeAt(0) - 97) : null
}

export const cellName = (i: number) => `${String.fromCharCode(97 + (i % N))}${Math.floor(i / N) + 1}`

/** Daemons that share a row, column or region with another, or touch one (diagonals too). */
export const clashes = (board: number[], cells: number[]): Set<number> => {
  const bad = new Set<number>()
  for (const a of cells)
    for (const b of cells) {
      if (a === b) continue
      const [ra, ca, rb, cb] = [Math.floor(a / N), a % N, Math.floor(b / N), b % N]
      const touch = Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1
      if (ra === rb || ca === cb || board[a] === board[b] || touch) bad.add(a)
    }
  return bad
}

export const isSolved = (board: number[], cells: number[]) => cells.length === N && clashes(board, cells).size === 0

/** Toggles each cell in turn. */
export const toggle = (s: DaemonsSave, cells: number[]): DaemonsSave => ({
  cells: cells.reduce((acc, c) => (acc.includes(c) ? acc.filter(y => y !== c) : [...acc, c]), s.cells),
  moves: s.moves + cells.length,
})

/** How many placements satisfy the board, stopping at `limit`. */
export const countSolutions = (board: number[], limit = 2): number => {
  let found = 0
  const cols: number[] = []
  const regions = new Set<number>()
  const place = (r: number) => {
    if (found >= limit) return
    if (r === N) return void (found += 1)
    for (let c = 0; c < N; c++) {
      const region = board[r * N + c]!
      if (cols.includes(c) || regions.has(region) || (r > 0 && Math.abs(cols[r - 1]! - c) <= 1)) continue
      cols.push(c)
      regions.add(region)
      place(r + 1)
      cols.pop()
      regions.delete(region)
    }
  }
  place(0)
  return found
}

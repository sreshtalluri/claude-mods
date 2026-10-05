import { expect, test } from 'claude-code/testing'

import { FIVES, TENS } from '../hooks/games/pixellogic/data'
import {
  clues, countSolutions, emptyBoard, isEasyDay, isMistake, isSolved, meta, puzzle, shareText, toggle, wrongCells,
} from '../hooks/games/pixellogic/logic'

test('meta names the game without trademarks', async () => {
  expect(meta.id).toBe('pixellogic')
  expect(meta.name).toBe('Pixel Logic')
  expect(meta.category).toBe('Everyone')
  expect(/picross|nonogram/i.test(`${meta.name} ${meta.tagline}`)).toBe(false)
})

test('every shipped picture is square, well-formed and uniquely solvable', async () => {
  expect(FIVES.length + TENS.length >= 60).toBe(true)
  const started = Date.now()
  for (const p of [...FIVES, ...TENS]) {
    const n = p.rows.length
    expect([5, 10].includes(n)).toBe(true)
    for (const r of p.rows) expect(/^[#.]+$/.test(r) && r.length === n).toBe(true)
    const c = clues(p.rows)
    expect(`${p.title}: ${countSolutions(c.rows, c.cols)}`).toBe(`${p.title}: 1`)
  }
  for (const p of FIVES) expect(p.rows.length).toBe(5)
  for (const p of TENS) expect(p.rows.length).toBe(10)
  expect(Date.now() - started < 2000).toBe(true)
})

test('clues count runs per row and column', async () => {
  const c = clues(['##.#.', '.....', '#####', '#...#', '.#.##'])
  expect(c.rows).toEqual([[2, 1], [], [5], [1, 1], [1, 2]])
  expect(c.cols).toEqual([[1, 2], [1, 1, 1], [1], [1, 1, 1], [3]])
})

test('the solver finds ambiguity', async () => {
  // A 2×2 checkerboard: two diagonals satisfy [1],[1] / [1],[1].
  expect(countSolutions([[1], [1]], [[1], [1]])).toBe(2)
  expect(countSolutions([[1], [1]], [[1], [1]], 1)).toBe(1)
  expect(countSolutions([[2], [2]], [[2], [2]])).toBe(1)
  expect(countSolutions([[2], []], [[2], [2]])).toBe(0)
})

test('Mondays are 5×5, other days 10×10, numbered from 1', async () => {
  expect(isEasyDay(4)).toBe(true) // 2026-01-05
  expect(puzzle(4).size).toBe(5)
  expect(puzzle(5).size).toBe(10)
  expect(puzzle(0).number).toBe(1)
  expect(puzzle(-3).size).toBe(5) // 2025-12-29, also a Monday
  expect(puzzle(5).title).toBe(puzzle(5 + TENS.length * 7).title)
})

test('toggle flow: fill, mark, clear, check and solve', async () => {
  const p = puzzle(4)
  let b = emptyBoard(p)
  expect(isSolved(p, b)).toBe(false)
  b = toggle(b, 0, 1)
  expect(b[0]).toBe(1)
  expect(toggle(b, 0, 1)[0]).toBe(0)
  expect(toggle(b, 0, 2)[0]).toBe(2)
  // Fill everything the picture wants, X a wrong cell and fill another wrongly.
  b = emptyBoard(p)
  p.rows.join('').split('').forEach((ch, i) => { if (ch === '#') b = toggle(b, i, 1) })
  expect(isSolved(p, b)).toBe(true)
  const filled = p.rows.join('').indexOf('#')
  const empty = p.rows.join('').indexOf('.')
  const wrong = toggle(toggle(b, filled, 2), empty, 1)
  expect(isSolved(p, wrong)).toBe(false)
  expect(wrongCells(p, wrong).sort((x, y) => x - y)).toEqual([filled, empty].sort((x, y) => x - y))
  expect(isMistake(p, empty, 1)).toBe(true)
  expect(isMistake(p, filled, 1)).toBe(false)
  // X marks on empty cells still count as solved.
  expect(isSolved(p, toggle(b, empty, 2))).toBe(true)
})

test('share text has the number, size and hints but not the picture', async () => {
  const p = puzzle(12)
  expect(shareText(p, { hints: 0 })).toBe('Pixel Logic #13 🖼️ 10×10 · 0 hints')
  expect(shareText(p, { hints: 1, mistakes: 2, seconds: 272 })).toBe('Pixel Logic #13 🖼️ 10×10 · 1 hint\n✏️ 2 mistakes  ⏱️ 4:32')
  expect(shareText(p, { hints: 0 }).includes(p.title)).toBe(false)
})

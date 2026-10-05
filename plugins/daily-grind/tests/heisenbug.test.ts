import { expect, test } from 'claude-code/testing'

import { PUZZLES } from '../hooks/games/heisenbug/data'
import { cluesShown, guess, isDone, isWon, MAX_GUESSES, meta, puzzle, shareText, start, wrongGuesses } from '../hooks/games/heisenbug/logic'

test('every puzzle is well formed', async () => {
  expect(PUZZLES.length >= 60).toBe(true)
  for (const p of PUZZLES) {
    expect(p.lines.length >= 8 && p.lines.length <= 15).toBe(true)
    expect(p.bugLine >= 0 && p.bugLine < p.lines.length).toBe(true)
    expect(p.lines.some(l => l.startsWith('!'))).toBe(false)
    expect(p.clues.length).toBe(3)
    expect(p.fix.trim().length > 0 && p.fix !== p.lines[p.bugLine]).toBe(true)
    expect(p.why.length > 0).toBe(true)
    for (const c of p.clues) expect(c.expected !== c.actual).toBe(true)
  }
  expect(new Set(PUZZLES.map(p => p.title)).size).toBe(PUZZLES.length)
  expect(meta.id).toBe('heisenbug')
  expect(meta.category).toBe('Developer')
})

test('days cycle through the puzzles', async () => {
  expect(puzzle(PUZZLES.length)).toBe(puzzle(0))
  expect(puzzle(-1)).toBe(PUZZLES[PUZZLES.length - 1])
})

test('wrong guesses reveal clues, the bug line wins', async () => {
  const bug = puzzle(0).bugLine
  const wrong = [0, 1, 2, 3, 4].filter(i => i !== bug)
  let s = start(0)
  expect(cluesShown(s).length).toBe(0)
  s = guess(s, wrong[0]!)
  expect(cluesShown(s)).toEqual(puzzle(0).clues.slice(0, 1))
  expect(guess(s, wrong[0]!)).toBe(s) // repeat ignored
  expect(guess(s, -1)).toBe(s)
  expect(guess(s, 99)).toBe(s)
  s = guess(s, wrong[1]!)
  expect(cluesShown(s).length).toBe(2)
  expect(isDone(s)).toBe(false)
  expect(shareText(s)).toBe(null)
  s = guess(s, bug)
  expect(isWon(s)).toBe(true)
  expect(isDone(s)).toBe(true)
  expect(guess(s, wrong[2]!)).toBe(s)
  expect(cluesShown(s).length).toBe(3)
  expect(shareText(s)).toBe('Heisenbug #1 🐞🐞✅')
})

test('four misses lose', async () => {
  const day = 11
  const bug = puzzle(day).bugLine
  const s = [0, 1, 2, 3, 4, 5].filter(i => i !== bug).slice(0, MAX_GUESSES).reduce(guess, start(day))
  expect(wrongGuesses(s)).toBe(4)
  expect(isWon(s)).toBe(false)
  expect(isDone(s)).toBe(true)
  expect(guess(s, bug)).toBe(s)
  expect(shareText(s)).toBe('Heisenbug #12 🐞🐞🐞🐞❌')
  expect(shareText(guess(start(day), bug))).toBe('Heisenbug #12 ✅')
})

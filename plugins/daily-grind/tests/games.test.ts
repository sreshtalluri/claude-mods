import { expect, test } from 'claude-code/testing'

import { GAMES } from '../hooks/games'
import { BANDS } from '../hooks/games/buckets/data'
import { bucketsFor, bucketsProgress, judge, pick, submit } from '../hooks/games/buckets/logic'
import { buckets } from '../hooks/games/buckets/view'
import { DAEMONS } from '../hooks/games/daemons/data'
import { boardFor, clashes, countSolutions, isSolved, parseCell, toggle } from '../hooks/games/daemons/logic'
import { ANSWERS } from '../hooks/games/lexer/data'
import { answerFor, guessError, isWord, score } from '../hooks/games/lexer/logic'
import { lexer } from '../hooks/games/lexer/view'
import { dayIndex, emptyData, forDay, liveStreak, progressOf, record, settle, shareText, statsOf } from '../hooks/shared'

test('days count from 2026-01-01 by the local calendar', async () => {
  expect(dayIndex(new Date(2026, 0, 1, 0, 1).getTime())).toBe(0)
  expect(dayIndex(new Date(2026, 0, 1, 23, 59).getTime())).toBe(0)
  expect(dayIndex(new Date(2026, 2, 9, 12).getTime())).toBe(67)
  expect(answerFor(ANSWERS.length)).toBe(answerFor(0))
  expect(answerFor(-1)).toBe(ANSWERS[ANSWERS.length - 1])
})

test('scoring counts each answer letter once', async () => {
  expect(score('react', 'react')).toEqual(['hit', 'hit', 'hit', 'hit', 'hit'])
  expect(score('trace', 'react')).toEqual(['near', 'near', 'hit', 'hit', 'near'])
  expect(score('eerie', 'merge')).toEqual(['miss', 'hit', 'hit', 'miss', 'hit'])
  expect(score('aabbb', 'xxxxa')).toEqual(['near', 'miss', 'miss', 'miss', 'miss'])
})

test('lexer word list', async () => {
  expect(ANSWERS.length).toBeGreaterThanOrEqual(60)
  expect(new Set(ANSWERS).size).toBe(ANSWERS.length)
  for (const a of ANSWERS) expect(/^[a-z]{5}$/.test(a)).toBe(true)
  expect(isWord('mutex') && isWord('house')).toBe(true)
  expect(guessError('zzzzz', [])).toContain('not in the word list')
  expect(guessError('abc', [])).toBe('Five letters, a to z.')
  expect(guessError('mutex', ['mutex'])).toContain('Already')
  expect(guessError('mutex', [])).toBe(null)
})

test('every buckets day has 16 distinct terms, and 400 days never repeat', async () => {
  const all = BANDS.flat().flatMap(([, ...t]) => t.map(x => x.toLowerCase()))
  expect(new Set(all).size).toBe(all.length)
  for (const band of BANDS) for (const g of band) expect(g.length).toBe(5)
  const seen = new Set<string>()
  for (let day = 0; day < 400; day++) {
    const b = bucketsFor(day)
    expect(new Set(b.terms).size).toBe(16)
    seen.add(b.groups.map(g => g.name).join('|'))
  }
  expect(seen.size).toBe(400)
})

test('buckets judging and progress', async () => {
  const b = bucketsFor(5)
  const [g0, g1] = [b.groups[0]!.terms, b.groups[1]!.terms]
  expect(judge(b, g0)).toBe('hit')
  expect(judge(b, [...g0.slice(0, 3), g1[0]!])).toBe('close')
  expect(judge(b, [...g0.slice(0, 2), ...g1.slice(0, 2)])).toBe('miss')
  const miss = [...g0.slice(0, 2), ...g1.slice(0, 2)]
  expect(bucketsProgress(b, [g1, miss])).toEqual({ solved: [1], mistakes: 1, status: 'playing' })
  expect(bucketsProgress(b, [miss, miss, miss, miss]).status).toBe('lost')
  expect(bucketsProgress(b, b.groups.map(g => g.terms)).status).toBe('won')
  let save = { tries: [] as string[][], picked: [] as string[] }
  for (const t of g0) save = pick(save, t)
  save = pick(save, g1[0]!) // a fifth is ignored
  expect(save.picked).toEqual(g0)
  expect(submit(b, { ...save, picked: g0.slice(0, 3) })).toEqual({ note: 'Pick four terms first.' })
  expect(submit(b, save)).toEqual({ note: '', save: { tries: [g0], picked: [] } })
})

test('every daemons board has exactly one solution', async () => {
  expect(DAEMONS.length).toBeGreaterThanOrEqual(60)
  for (let day = 0; day < DAEMONS.length; day++) {
    const board = boardFor(day)
    expect(board.length).toBe(49)
    expect(new Set(board).size).toBe(7)
    expect(countSolutions(board)).toBe(1)
  }
})

test('daemons cells and clashes', async () => {
  expect(parseCell('a1')).toBe(0)
  expect(parseCell(' C4 ')).toBe(3 * 7 + 2)
  expect(parseCell('h1')).toBe(null)
  const board = boardFor(0)
  expect([...clashes(board, [0, 8])].sort()).toEqual([0, 8]) // diagonal touch
  expect([...clashes(board, [0, 6])].sort()).toEqual([0, 6]) // same row
  expect(isSolved(board, [])).toBe(false)
  expect(toggle({ cells: [0, 8], moves: 2 }, [8, 9])).toEqual({ cells: [0, 9], moves: 4 })
})

test('streaks, progress and share text', async () => {
  let s = statsOf(lexer, emptyData())
  s = record(s, 10, true)
  s = record(s, 11, true)
  expect([s.streak, s.best]).toEqual([2, 2])
  expect(liveStreak(s, 12)).toBe(2)
  expect(liveStreak(s, 13)).toBe(0)
  s = record(s, 13, true)
  expect([s.streak, s.best, s.played]).toEqual([1, 2, 3])

  const day = 3
  const before = forDay(emptyData(), day)
  expect(progressOf(lexer, before)).toBe('new')
  const mid = settle(before, lexer, { guesses: ['react'] })
  expect(progressOf(lexer, mid)).toBe('playing')
  const after = settle(mid, lexer, { guesses: ['react', answerFor(day)] })
  expect(progressOf(lexer, after)).toBe('won')
  expect(after.stats.lexer!.won).toBe(1)
  expect(settle(after, lexer, { guesses: ['react', answerFor(day)] }).stats.lexer!.won).toBe(1) // only the finishing move records
  const text = shareText(lexer, after)!
  expect(text.startsWith(`Daily Grind · Lexer #${day + 1}  2/6`)).toBe(true)
  expect(text.endsWith('🟣🟣🟣🟣🟣')).toBe(true)
  expect(shareText(buckets, after)).toBe(null)
  expect(forDay(after, day + 1).saves).toEqual({}) // a new day starts fresh
})

test('every game keeps the contract', async () => {
  expect(new Set(GAMES.map(g => g.id)).size).toBe(GAMES.length)
  for (const g of GAMES) {
    const p = g.puzzle(42)
    expect(JSON.stringify(g.puzzle(42))).toBe(JSON.stringify(p))
    expect(g.status(p, g.fresh(p))).toBe('playing')
    expect(['Developer', 'Everyone', 'Classics']).toContain(g.category)
    expect(g.tagline.length).toBeLessThanOrEqual(48)
  }
})

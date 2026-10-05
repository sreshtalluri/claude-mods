import { expect, test } from 'claude-code/testing'

import { PAIRS, WORDS } from '../hooks/games/ladder/data'
import { hint, isDone, isWord, marks, meta, neighbors, newGame, puzzle, shareText, shortestPath, step, undo, vsPar, type LadderState } from '../hooks/games/ladder/logic'

const play = (s: LadderState, ...words: string[]): LadderState =>
  words.reduce((acc, w) => {
    const r = step(acc, w)
    if ('error' in r) throw new Error(`${w}: ${r.error}`)
    return r
  }, s)

test('dictionary is unique four-letter lowercase words', async () => {
  expect(WORDS.length > 1500).toBe(true)
  for (const w of WORDS) expect(/^[a-z]{4}$/.test(w)).toBe(true)
  expect(new Set(WORDS).size).toBe(WORDS.length)
  expect(meta.id).toBe('ladder')
})

test('every shipped pair has its stated par as the BFS optimum', async () => {
  expect(PAIRS.length >= 120).toBe(true)
  expect(new Set(PAIRS.map(([a, b]) => `${a}-${b}`)).size).toBe(PAIRS.length)
  for (const [a, b, par] of PAIRS) {
    expect(par >= 4 && par <= 7).toBe(true)
    const path = shortestPath(a, b)
    expect(path?.length).toBe(par + 1)
    path!.forEach((w, i) => {
      expect(isWord(w)).toBe(true)
      if (i) expect(neighbors(path![i - 1]!).includes(w)).toBe(true)
    })
  }
})

test('puzzles cycle by day', async () => {
  expect(puzzle(PAIRS.length + 3)).toEqual({ ...puzzle(3), day: PAIRS.length + 3 })
  expect(puzzle(-1).start).toBe(PAIRS[PAIRS.length - 1]![0])
})

test('step rejects bad rungs with a reason and accepts good ones', async () => {
  const s: LadderState = { day: 11, start: 'cold', target: 'warm', par: 4, path: ['cold'] }
  const err = (w: string) => { const r = step(s, w); return 'error' in r ? r.error : null }
  expect(err('col')).toContain('four letters')
  expect(err('cold')).toContain('one letter')
  expect(err('bolt')).toContain('only one')
  expect(err('cxld')).toContain('word list')
  expect(err(' CORD ')).toBe(null)
  const two = play(s, 'cord')
  expect(step(two, 'cold')).toEqual({ error: '"cold" is already on your ladder.' })
  expect(undo(two)).toEqual(s)
  expect(undo(s)).toEqual(s)
})

test('a par solve is done and shares with markers', async () => {
  const s: LadderState = { day: 11, start: 'cold', target: 'warm', par: 4, path: ['cold'] }
  const done = play(s, 'cord', 'card', 'ward', 'warm')
  expect(isDone(done)).toBe(true)
  expect(vsPar(done)).toBe(0)
  expect(shareText(done)).toBe('Ladder #12 🪜 4 (par 4) ⛳\n▲▲▲▲')
  expect('error' in step(done, 'worm')).toBe(true)
  const long = play(s, 'bold', 'bolt')
  expect(shareText(long).split('\n')[0]).toBe('Ladder #12 🪜 2 (par 4) …')
  const dist = (w: string) => shortestPath(w, 'warm')!.length
  const wander = play(s, 'bold', 'bolt', 'boat', 'coat')
  expect(marks(wander)).toEqual(wander.path.slice(1).map((w, i) => {
    const [a, b] = [dist(wander.path[i]!), dist(w)]
    return b < a ? '▲' : b === a ? '■' : '▼'
  }))
})

test('hint lies on a shortest path from the current word', async () => {
  for (let day = 0; day < PAIRS.length; day += 7) {
    let s = newGame(day)
    while (!isDone(s)) {
      const h = hint(s)!
      const here = shortestPath(s.path[s.path.length - 1]!, s.target)!.length
      expect(shortestPath(h, s.target)!.length).toBe(here - 1)
      s = play(s, h)
    }
    expect(s.path.length).toBe(s.par + 1)
    expect(hint(s)).toBe(null)
  }
})

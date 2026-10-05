import { expect, test } from 'claude-code/testing'

import { consistent, guess, id, isDone, isWon, parse, puzzle, remaining, score, share, start, type State } from '../hooks/games/codebreaker/logic'

const play = (s: State, ...gs: string[]): State => {
  for (const g of gs) {
    const next = guess(s, g)
    if ('error' in next) throw new Error(next.error)
    s = next
  }
  return s
}
const fixed = (code: string, hard = false): State => ({ day: 12, code, hard, rows: [] })

test('scoring counts repeats once each', async () => {
  expect(score('ROTB', 'ROTB')).toEqual({ exact: 4, near: 0 })
  expect(score('ROTB', 'BTOR')).toEqual({ exact: 0, near: 4 })
  expect(score('RRTT', 'TTRR')).toEqual({ exact: 0, near: 4 })
  expect(score('RBBB', 'RRRR')).toEqual({ exact: 1, near: 0 }) // extra Rs earn nothing
  expect(score('RRBB', 'RBRV')).toEqual({ exact: 1, near: 2 })
  expect(score('ROOO', 'OOOR')).toEqual({ exact: 2, near: 2 })
  expect(score('TVPP', 'PPPT')).toEqual({ exact: 1, near: 2 }) // only two Ps to match
  expect(score('ROTB', 'VPVP')).toEqual({ exact: 0, near: 0 })
  expect(score('RRRO', 'ORRR')).toEqual({ exact: 2, near: 2 })
})

test('parse accepts loose input', async () => {
  expect(parse('rotb')).toBe('ROTB')
  expect(parse('R O T B')).toBe('ROTB')
  expect(parse(' v, p, p, r ')).toBe('VPPR')
  expect(parse('rot')).toBe(null)
  expect(parse('rotx')).toBe(null)
  expect(parse('rotbv')).toBe(null)
})

test('daily code is deterministic and varies', async () => {
  expect(puzzle(12)).toBe(puzzle(12))
  expect(parse(puzzle(12))).toBe(puzzle(12))
  expect(new Set(Array.from({ length: 30 }, (_, d) => puzzle(d))).size > 25).toBe(true)
  expect(id).toBe('codebreaker')
})

test('win, loss, and refused guesses', async () => {
  let s = play(fixed('ROTB'), 'vvpp', 'rotb')
  expect(isWon(s) && isDone(s)).toBe(true)
  expect('error' in guess(s, 'tttt')).toBe(true)
  expect('error' in guess(fixed('ROTB'), 'xyz')).toBe(true)
  expect('error' in guess(play(fixed('ROTB'), 'vvpp'), 'VVPP')).toBe(true)
  s = play(fixed('ROTB'), 'RRRR', 'OOOO', 'TTTT', 'BBBB', 'VVVV', 'PPPP', 'RROO', 'TTBB')
  expect(isDone(s) && !isWon(s)).toBe(true)
})

test('hard mode rejects guesses that ignore clues', async () => {
  const s = play(fixed('ROTB', true), 'RRRR') // 1 exact
  expect(consistent(s, 'OOOO')).toBe(false)
  expect('error' in guess(s, 'OOOO')).toBe(true)
  expect('error' in guess(s, 'ROOO')).toBe(false)
  expect('error' in guess({ ...s, hard: false }, 'OOOO')).toBe(false)
})

test('remaining narrows from 1296', async () => {
  expect(remaining(fixed('ROTB'))).toBe(1296)
  const s = play(fixed('ROTB'), 'RRRR') // exactly one R: 4 spots * 5^3 others
  expect(remaining(s)).toBe(500)
  expect(remaining(play(s, 'rotb'))).toBe(1)
})

test('share text uses dots, not squares', async () => {
  expect(share(play(fixed('ROTB'), 'RBVV', 'ROTB'))).toBe('Codebreaker #12 2/8\n●○··\n●●●●')
  const lost = play(fixed('ROTB', true), 'VVVV')
  expect(share({ ...lost, rows: Array(8).fill(lost.rows[0]) }).split('\n')[0]).toBe('Codebreaker #12 X/8*')
})

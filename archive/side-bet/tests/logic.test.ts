import { expect, test } from 'claude-code/testing'

import { chance, DAY, fileLine, FLOOR, formatSlip, formatStats, isTestCommand, learn, newBook, offers, payout, refill, settle, STAKE } from '../hooks/logic'

test('test commands are spotted at command position only', async () => {
  for (const c of ['npm test', 'pnpm run test:unit', 'yarn test --watch=false', 'cd app && npx vitest run', 'CI=1 pytest -q',
    'python -m pytest tests/', 'cargo test', 'go test ./...', 'bun test', 'uv run pytest', 'make check', 'claude plugin test plugins/x'])
    expect(isTestCommand(c)).toBe(true)
  for (const c of ['git commit -m "add pytest"', 'cat test.py', 'npm run testing', 'grep -r jest src', 'ls tests/', 'npm install'])
    expect(isTestCommand(c)).toBe(false)
})

test('odds come from smoothed base rates with a house edge', async () => {
  expect(chance(0, 0)).toBe(0.5)
  expect(payout(0.5)).toBe(190)
  expect(payout(0.99)).toBe(payout(0.9))
  expect(payout(0.001)).toBe(1900)
  expect(fileLine([])).toBe(2.5)
  expect(fileLine([0, 1, 1, 4])).toBe(1.5)
  const [tests, files, ask] = offers({ tests: { hits: 8, n: 8 }, ask: { hits: 0, n: 8 }, files: [0, 0, 0] })
  expect(tests?.picks[0].payout).toBe(payout(0.9))
  expect(ask?.picks[1].p).toBe(0.9)
  expect(files?.picks[0].line).toBe(0.5)
  expect(files?.title).toBe('Files touched, 0.5')
})

test('settling pays winners, keeps losers, voids an untested tests bet', async () => {
  const [tests, files, ask] = offers(newBook().rates)
  const bets = [tests!.picks[0], files!.picks[1], ask!.picks[0]]
  const start = { ...newBook(), chips: FLOOR - 3 * STAKE }
  const r = settle(start, bets, { tests: null, files: 1, asked: false })
  expect(r.lines).toEqual(['Tests Yes void', `Files Under won +${files!.picks[1].payout - STAKE}`, 'Ask Yes lost -100'])
  expect(r.book.chips).toBe(FLOOR - 2 * STAKE + files!.picks[1].payout)
  expect(r.book.record).toEqual({ wins: 1, losses: 1, voids: 1, streak: -1, bestWin: files!.picks[1].payout - STAKE, implied: bets[1]!.p + bets[2]!.p })
  expect(settle(start, bets, null).book.chips).toBe(FLOOR)
})

test('rates learn and the bankroll tops up once a day', async () => {
  const r = learn(newBook().rates, { tests: true, files: 3, asked: true })
  expect(r).toEqual({ tests: { hits: 1, n: 1 }, ask: { hits: 1, n: 1 }, files: [3] })
  expect(learn(r, { tests: null, files: 0, asked: false }).tests).toEqual({ hits: 1, n: 1 })
  const broke = { ...newBook(), chips: 40, day: 10 }
  expect(refill(broke, 10 * DAY + 5).chips).toBe(40)
  expect(refill(broke, 11 * DAY).chips).toBe(FLOOR)
  expect(refill({ ...broke, chips: 5000 }, 11 * DAY).chips).toBe(5000)
  const stats = formatStats(newBook())
  expect(stats[0]).toContain('PLAY MONEY')
  expect(new Set(stats.map(l => l.length)).size).toBe(1) // a closed frame
  const [tests] = offers(newBook().rates)
  const slip = formatSlip({ results: [{ bet: tests!.picks[0], outcome: 'won', delta: 90 }], net: 90, chips: 1090, isVoid: false })
  expect(slip.join('\n')).toMatch(/✓ Tests pass +YES +@ 50¢ +\+90[\s\S]*Net \+90 · bankroll 1,090/)
})

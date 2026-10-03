import { expect, test } from 'claude-code/testing'

import { countAbsolutelyRight, CREDIT, DAY, emptyStats, formatReceipt, formatWeek, prettyModel, row, shortTool, summarize, WIDTH } from '../hooks/format'

const base = {
  usd: 4.123,
  startedAt: 0,
  now: 3_725_000,
  cwd: '/Users/me/code/goldfish',
  sessionId: 'abc-123',
  number: 42,
  model: 'claude-opus-5-5[1m]',
}

test('every receipt line is exactly the slip width', async () => {
  const stats = {
    ...emptyStats(),
    turns: 12,
    toolCalls: 41,
    toolCounts: { Read: 14, Bash: 9, Edit: 6, mcp__github__create_issue: 2 },
    editCounts: { '/Users/me/code/goldfish/src/compactor_with_a_long_name.py': 5 },
    longest: { tool: 'Bash', ms: 133_000 },
    tokensIn: 50_000,
    cacheRead: 760_000,
    tokensOut: 34_000,
    absolutelyRight: 3,
  }
  const lines = formatReceipt({ ...base, stats })
  for (const line of lines) expect(line.length).toBe(WIDTH)
  expect(lines.some(l => l.startsWith('TOTAL') && l.endsWith('$4.12'))).toBe(true)
  expect(lines.some(l => l.includes('RECEIPT #0042'))).toBe(true)
  expect(lines.some(l => l.includes('YOU WERE ABSOLUTELY RIGHT'))).toBe(true)
  expect(lines.some(l => l.includes('SERVED BY OPUS 5.5'))).toBe(true)
  expect(lines[lines.length - 1]?.trim()).toBe(CREDIT)
})

test('an empty session still prints a receipt', async () => {
  const lines = formatReceipt({ ...base, usd: null, stats: emptyStats() })
  expect(lines.some(l => l.includes('no tools were harmed'))).toBe(true)
  expect(lines.some(l => l.startsWith('TOTAL') && l.trimEnd().endsWith('n/a'))).toBe(true)
})

test('helpers', async () => {
  expect(row('TURNS', '12').length).toBe(WIDTH)
  expect(shortTool('mcp__github__create_issue')).toBe('github.create_issue')
  expect(countAbsolutelyRight("You're absolutely right! youre totally right")).toBe(2)
})

test('model names read like a menu', async () => {
  expect(prettyModel('claude-opus-5-5')).toBe('OPUS 5.5')
  expect(prettyModel('claude-haiku-4-5-20251001')).toBe('HAIKU 4.5')
  expect(prettyModel('claude-fable-5-1[1m]')).toBe('FABLE 5.1')
  expect(prettyModel('gpt-x')).toBe('GPT-X')
})

test('the weekly receipt adds up the last seven days only', async () => {
  const now = 30 * DAY
  const one = (daysAgo: number, usd: number) =>
    summarize({ ...emptyStats(), turns: 2, toolCalls: 3, toolCounts: { Read: 3 } }, {
      ...base, usd, now: now - daysAgo * DAY, startedAt: now - daysAgo * DAY - 600_000,
    })
  const lines = formatWeek([one(1, 2), one(3, 3.5), one(9, 100)], now)
  for (const line of lines) expect(line.length).toBe(WIDTH)
  expect(lines.some(l => l.startsWith('SESSIONS') && l.trimEnd().endsWith(' 2'))).toBe(true)
  expect(lines.some(l => l.startsWith('TOTAL') && l.endsWith('$5.50'))).toBe(true)
  expect(lines.some(l => l.includes('USUAL ORDER') && l.includes('OPUS 5.5'))).toBe(true)
  expect(formatWeek([], now).some(l => l.startsWith('TOTAL') && l.endsWith('$0.00'))).toBe(true)
})

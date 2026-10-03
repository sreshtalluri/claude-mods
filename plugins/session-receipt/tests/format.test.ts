import { expect, test } from 'claude-code/testing'

import { countAbsolutelyRight, emptyStats, formatReceipt, row, shortTool, WIDTH } from '../hooks/format'

const base = {
  usd: 4.123,
  startedAt: 0,
  now: 3_725_000,
  cwd: '/Users/me/code/goldfish',
  sessionId: 'abc-123',
  number: 42,
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

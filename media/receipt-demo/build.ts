// Writes index.html from template.html.tpl with real slips from the mod's own formatter.
// Run: bun build.ts
import { DAY, emptyStats, formatReceipt, formatWeek, receiptSvg, summarize } from '../../plugins/session-receipt/hooks/format'

const now = new Date('2026-10-03T16:42:00').getTime()
const stats = {
  ...emptyStats(),
  turns: 14, toolCalls: 63, interrupts: 1, absolutelyRight: 2, apologies: 1,
  toolCounts: { Read: 21, Bash: 17, Edit: 12, Grep: 8, Write: 5 },
  editCounts: { '/x/trividha/app/inbox.tsx': 7, '/x/trividha/api/messages.py': 3 },
  longest: { tool: 'Bash', ms: 41_000 },
  tokensIn: 90_000, cacheRead: 3_100_000, tokensOut: 52_000,
}
const day = { stats, usd: 6.42, startedAt: now - 5_400_000, now, cwd: '/x/trividha', sessionId: 'demo', number: 37, model: 'claude-opus-5-5' }
const week = [1, 2, 2, 4, 5, 6].map((d, i) =>
  summarize(stats, { ...day, usd: 3 + i, now: now - d * DAY, startedAt: now - d * DAY - 3_600_000,
    cwd: i % 2 ? '/x/stepwise' : '/x/trividha', model: i === 3 ? 'claude-sonnet-5-5' : 'claude-opus-5-5' }))

// The slips are tilted in the hero, which makes neighbouring rows' boxes touch:
// mark their text as deliberately layered so the layout audit skips it.
const slip = (lines: string[]) => receiptSvg(lines).replaceAll('<text ', '<text data-layout-allow-overlap ')
const html = (await Bun.file('template.html.tpl').text())
  .replace('{{DAY_SVG}}', slip(formatReceipt(day)))
  .replace('{{WEEK_SVG}}', slip(formatWeek(week, now)))
await Bun.write('index.html', html)
console.log('index.html written')

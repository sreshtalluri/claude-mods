import { expect, test } from 'claude-code/testing'

import { emptyStats, formatReceipt, isShipCommand, receiptSvg, slipLines } from '../hooks/format'

const lines = formatReceipt({
  stats: { ...emptyStats(), toolCalls: 1, toolCounts: { Bash: 1 } },
  usd: 1.36,
  startedAt: 0,
  now: 60_000,
  cwd: '/x/R&D <lab>',
  sessionId: 's',
  number: 2,
})
// What the engine hands the row: the plugin's name before the fence.
const ROW = {
  component: 'CommandOutput',
  props: { command: 'receipt', args: '', text: 'session-receipt: ```\n' + lines.join('\n') + '\n```', isErrored: false },
} as const

test('the slip is found inside a prefixed row', async () => {
  expect(slipLines(ROW.props.text)).toEqual(lines)
})

test('desktop draws a paper slip, terminal draws text', async $ => {
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-receipt', surface, ...ROW })
    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: 'Copy receipt' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ plugin: 'session-receipt', surface: 'terminal', ...ROW })
  expect(await ui.find({ type: 'Text', text: /SESSION RECEIPT/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /session-receipt:/ })).toBeUndefined()
  await ui.unmount()
})

test('svg escapes text and draws the barcode as bars', async () => {
  const svg = receiptSvg(lines)
  expect(svg.includes('R&amp;D &lt;lab&gt;')).toBe(true)
  expect(svg.includes('<rect')).toBe(true)
  expect(svg.includes('$1.36')).toBe(true)
})

test('ship commands', async () => {
  expect(isShipCommand('git add -A && git commit -m "x"')).toBe(true)
  expect(isShipCommand('gh pr create --fill')).toBe(true)
  expect(isShipCommand('git status')).toBe(false)
})

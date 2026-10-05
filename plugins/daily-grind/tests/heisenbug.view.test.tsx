import { expect, mock, test } from 'claude-code/testing'

import { puzzle } from '../hooks/games/heisenbug/logic'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Heisenbug: a wrong line reveals a test, the bug line wins (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    const mem: Record<string, unknown> = {}
    on('store.set', (_$, e) => {
      mem[e.key] = e.value
      return { value: undefined }
    })
    on('store.get', (_$, e) => ({ value: mem[e.key] }))
    const p = puzzle(DAY)
    const wrong = p.bugLine === 0 ? 1 : 0
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'game-heisenbug' })
    expect(await ui.find({ key: 'clues' })).toBeUndefined()
    expect((await ui.find({ key: 'guesses' }))?.text).toContain('🐞🐞🐞🐞')

    await ui.press({ key: `line-${wrong}` })
    expect((await ui.find({ key: 'note' }))?.text).toContain(`Line ${wrong + 1}`)
    expect((await ui.find({ key: 'clues' }))?.text).toContain(p.clues[0]!.input)
    expect((await ui.find({ key: 'guesses' }))?.text).toContain('🐞🐞🐞')
    expect((await ui.find({ key: 'guesses' }))?.text).not.toContain('🐞🐞🐞🐞')

    await ui.press({ key: `line-${p.bugLine}` })
    expect((await ui.find({ key: 'diff' }))?.text).toContain(p.why)
    expect((await ui.find({ key: 'share' }))?.text).toContain(`Heisenbug #${DAY + 1}  🐞✅`)
    expect(mem.stats).toMatchObject({ heisenbug: { won: 1 } })
    await ui.unmount()
  })
}

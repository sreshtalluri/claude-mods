import { expect, mock, test } from 'claude-code/testing'

import { puzzle } from '../hooks/games/installorder/logic'
import { installorder } from '../hooks/games/installorder/view'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Install Order: a wrong install, then reorder to a win (${surface})`, { timeoutMs: 30_000 }, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const p = puzzle(DAY)
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'game-installorder' })
    expect((await ui.find({ key: 'queue' }))?.text).toContain(p.packages[0]!)

    await ui.press({ key: 'submit' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('ERESOLVE')
    expect((await ui.find({ key: 'clues' }))?.text).toContain('✗')

    // Selection sort with select + up.
    const order = [...p.packages]
    for (let t = 0; t < order.length; t++) {
      const name = p.answer[t]!
      let at = order.indexOf(name)
      if (at === t) continue
      await ui.press({ key: `pkg-${name}` })
      while (at > t) {
        await ui.press({ key: 'up' })
        order.splice(at - 1, 0, order.splice(at, 1)[0]!)
        at--
      }
    }
    await ui.press({ key: 'submit' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('in 2 tries')
    expect(await ui.find({ key: 'submit' })).toBeUndefined()
    expect((await ui.find({ key: 'share' }))?.text).toContain('📦 2 tries')
    await ui.unmount()
  })
}

test('share is the score and a row per install', async () => {
  const p = puzzle(3)
  expect(installorder.share(p, { order: p.answer, history: [[0], []], sel: null })).toBe(
    `📦 2 tries\n💥${'🔗'.repeat(p.clues.length - 1)}\n${'🔗'.repeat(p.clues.length)}`,
  )
  expect(installorder.status(p, installorder.fresh(p))).toBe('playing')
})

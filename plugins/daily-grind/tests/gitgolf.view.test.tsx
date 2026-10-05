import { expect, mock, test } from 'claude-code/testing'

import { format, puzzle, solve } from '../hooks/games/gitgolf/logic'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Git Golf: bad commands are free, undo works, par wins (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const p = puzzle(DAY)
    const steps = solve(p.start, p.target, p.par)!.map(format)
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'game-gitgolf' })
    if (surface === 'desktop') expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: expect.stringContaining('Your repo') } })

    await ui.input({ key: 'cmd', text: 'push origin' })
    expect(await ui.find({ key: 'note' })).toBeDefined()
    expect((await ui.find({ key: 'score' }))?.text).toContain(`0 strokes · par ${p.par}`)

    await ui.input({ key: 'cmd', text: steps[0]! })
    expect((await ui.find({ key: 'score' }))?.text).toContain('1 stroke ')
    await ui.press({ key: 'undo' })
    expect((await ui.find({ key: 'score' }))?.text).toContain('0 strokes')

    for (const s of steps) await ui.input({ key: 'cmd', text: s })
    expect(await ui.find({ key: 'cmd' })).toBeUndefined()
    expect((await ui.find({ key: 'note' }))?.text).toContain('par')
    expect((await ui.find({ key: 'share' }))?.text).toContain(`Git Golf #${DAY + 1}  ⛳ ${p.par} (par ${p.par})`)
    await ui.unmount()
  })
}

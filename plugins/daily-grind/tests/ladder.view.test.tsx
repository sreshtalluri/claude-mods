import { expect, mock, test } from 'claude-code/testing'

import { isWord, puzzle, shortestPath } from '../hooks/games/ladder/logic'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Ladder: refuses bad rungs, hints, undoes, climbs to a win (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    const mem: Record<string, unknown> = {}
    on('store.set', (_$, e) => {
      mem[e.key] = e.value
      return { value: undefined }
    })
    on('store.get', (_$, e) => ({ value: mem[e.key] }))
    const p = puzzle(DAY)
    const path = shortestPath(p.start, p.target)!
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'game-ladder' })
    expect((await ui.find({ key: 'score' }))?.text).toContain(`par ${p.par}`)
    if (surface === 'desktop') expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: expect.stringContaining(p.target) } })
    else expect((await ui.find({ key: 'rung-target' }))?.text).toContain('target')

    const bogus = [...'zqxjvk'].map(c => c + p.start.slice(1)).find(w => !isWord(w))!
    await ui.input({ key: 'word', text: 'zzzz' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('only one letter')
    await ui.input({ key: 'word', text: bogus })
    expect((await ui.find({ key: 'note' }))?.text).toContain('word list')
    await ui.press({ key: 'hint' })
    expect((await ui.find({ key: 'note' }))?.text).toContain(path[1]!.toUpperCase())

    await ui.input({ key: 'word', text: path[1]! })
    expect(mem.today).toMatchObject({ saves: { ladder: { path: path.slice(0, 2) } } })
    await ui.press({ key: 'undo' })
    expect(mem.today).toMatchObject({ saves: { ladder: { path: [p.start] } } })

    for (const w of path.slice(1)) await ui.input({ key: 'word', text: w })
    expect(await ui.find({ key: 'word' })).toBeUndefined()
    expect(await ui.find({ key: 'undo' })).toBeUndefined()
    expect((await ui.find({ key: 'score' }))?.text).toContain('on par')
    const share = (await ui.find({ key: 'share' }))?.text
    expect(share).toContain(`Ladder #${DAY + 1}  🪜 ${p.par} (par ${p.par}) ⛳`)
    if (surface === 'desktop') expect(share).toContain('▲'.repeat(p.par))
    else expect((await ui.find({ key: `rung-${p.par}` }))?.text).toContain('▲')
    expect(mem.stats).toMatchObject({ ladder: { won: 1 } })
    await ui.unmount()
  })
}

import { expect, mock, test } from 'claude-code/testing'

import { puzzle } from '../hooks/games/pixellogic/logic'
import { parseMove } from '../hooks/games/pixellogic/view'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('typed moves: cells, marks, runs; junk refused', async () => {
  expect(parseMove(10, 'c4')).toEqual({ cells: [32], to: 1 })
  expect(parseMove(10, 'xc4')).toEqual({ cells: [32], to: 2 })
  expect(parseMove(10, 'a1-c1')).toEqual({ cells: [0, 1, 2], to: 1 })
  expect(parseMove(10, 'j9-j10')).toEqual({ cells: [89, 99], to: 1 })
  for (const bad of ['', 'k1', 'a11', 'a1-b2', 'hello']) expect(parseMove(10, bad)).toBeNull()
  expect(parseMove(5, 'f1')).toBeNull()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Pixel Logic: fill, mark, check, then solve (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    const mem: Record<string, any> = {}
    on('store.set', (_$, e) => {
      mem[e.key] = e.value
      return { value: undefined }
    })
    on('store.get', (_$, e) => ({ value: mem[e.key] }))
    const p = puzzle(DAY)
    const want = p.rows.join('')
    const filled = [...want].flatMap((c, i) => (c === '#' ? [i] : []))
    const empty = want.indexOf('.')
    const name = (i: number) => `${'abcdefghij'[i % p.size]}${Math.floor(i / p.size) + 1}`

    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'game-pixellogic' })
    await ui.press({ key: `cell-${name(empty)}` }) // a wrong fill
    await ui.input({ key: 'cell', text: `x${name(filled[0]!)}` }) // a wrong mark
    expect(mem.today.saves.pixellogic).toMatchObject({ mistakes: 2 })
    await ui.press({ key: 'check' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('2 wrong cells')
    expect((await ui.find({ key: 'tally' }))?.text).toContain('hints 1')
    await ui.input({ key: 'cell', text: 'z99' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('Cells look like c4')

    await ui.press({ key: `cell-${name(empty)}` }) // clear the wrong fill
    await ui.press({ key: surface === 'terminal' ? 'mode' : 'mode-mark' })
    expect(mem.today.saves.pixellogic.mode).toBe(2)
    await ui.press({ key: `cell-${name(empty)}` })
    expect(mem.today.saves.pixellogic.board[empty]).toBe(2)

    // Type the rest in one go; `x` cells covered by a fill become filled.
    await ui.input({ key: 'cell', text: filled.map(name).join(' ') })
    expect((await ui.find({ key: 'title' }))?.text).toContain(p.title)
    expect(await ui.find({ key: 'cell' })).toBeUndefined()
    expect(await ui.find({ key: `cell-${name(empty)}` })).toBeUndefined()
    if (surface === 'desktop') expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: expect.stringContaining(p.title) } })
    expect((await ui.find({ key: 'share' }))?.text).toContain(`Pixel Logic #${DAY + 1}  🖼️ 10×10 · 1 hint`)
    expect(mem.stats).toMatchObject({ pixellogic: { won: 1 } })
    await ui.unmount()
  })
}

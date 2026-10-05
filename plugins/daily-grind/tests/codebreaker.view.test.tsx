import { expect, mock, test } from 'claude-code/testing'

import { codebreaker } from '../hooks/games/codebreaker/view'
import { LETTERS, puzzle } from '../hooks/games/codebreaker/logic'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const CODE = puzzle(DAY)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const
// A first guess that shares no color with the code, so its row reads "····".
const MISS = [...LETTERS].find(c => !CODE.includes(c))!.repeat(4)

test('share drops the logic header the shell already prints', async () => {
  expect(codebreaker.share(CODE, { guesses: [MISS, CODE], draft: '', hard: false })).toBe('2/8\n····\n●●●●')
  expect(codebreaker.status(CODE, codebreaker.fresh(CODE))).toBe('playing')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Codebreaker: palette, undo, typed guess, win (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    const mem: Record<string, any> = {}
    on('store.set', (_$, e) => {
      mem[e.key] = e.value
      return { value: undefined }
    })
    on('store.get', (_$, e) => ({ value: mem[e.key] }))
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'game-codebreaker' })
    expect((await ui.find({ key: 'stat' }))?.text).toContain('1296')
    await ui.press({ key: 'hard' })
    expect(await ui.find({ key: 'hard' })).toMatchObject({ props: { label: 'hard mode: on' } })
    await ui.press({ key: 'hard' })

    await ui.press({ key: 'guess' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('Pick 4 colors')
    for (const c of MISS + 'R') await ui.press({ key: `peg-${c}` })
    expect((await ui.find({ key: 'note' }))?.text).toContain('Row full')
    await ui.press({ key: 'undo' })
    await ui.press({ key: `peg-${MISS[0]}` })
    expect(await ui.find({ key: 'guess' })).toMatchObject({ props: { label: 'guess 4/4' } })
    await ui.press({ key: 'guess' })
    expect(mem.today.saves.codebreaker).toEqual({ guesses: [MISS], draft: '', hard: false })
    expect((await ui.find({ key: 'stat' }))?.text).toContain(String(5 ** 4))
    await ui.press({ key: 'hard' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('before the first guess')

    await ui.input({ key: 'code', text: MISS.toLowerCase() })
    expect((await ui.find({ key: 'note' }))?.text).toContain('Already tried')
    await ui.input({ key: 'code', text: CODE.slice(0, 2) }) // half typed, half clicked
    for (const c of CODE.slice(2)) await ui.press({ key: `peg-${c}` })
    await ui.press({ key: 'guess' })
    expect(await ui.find({ key: 'code' })).toBeUndefined()
    expect(await ui.find({ key: 'peg-R' })).toBeUndefined()
    expect((await ui.find({ key: 'outcome' }))?.text).toContain('Cracked in 2')
    expect((await ui.find({ key: 'share' }))?.text).toContain(`Codebreaker #${DAY + 1}  2/8`)
    expect(mem.stats).toMatchObject({ codebreaker: { won: 1 } })
    await ui.unmount()
  })
}

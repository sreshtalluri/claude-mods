import { expect, mock, test } from 'claude-code/testing'

import { bucketsFor } from '../hooks/games/buckets/logic'
import { GAMES } from '../hooks/games/index'
import { answerFor } from '../hooks/games/lexer/logic'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const
const SHARE = { command: 'grind', args: 'share', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the menu lists every game by category and tracks progress (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    expect((await ui.find({ key: 'cat-Developer' }))?.text).toContain('Git Golf')
    expect((await ui.find({ key: 'cat-Everyone' }))?.text).toContain('Ladder')
    expect((await ui.find({ key: 'cat-Everyone' }))?.text).toContain('not started')
    expect(await ui.find({ key: 'cat-Classics' })).toBeUndefined()
    await ui.press({ key: 'tab-classics' })
    expect((await ui.find({ key: 'cat-Classics' }))?.text).toContain('Lexer')
    expect((await ui.find({ key: 'cat-Classics' }))?.text).toContain('Buckets')
    expect((await ui.find({ key: 'cat-Classics' }))?.text).toContain('Daemons')
    expect(await ui.find({ key: 'cat-Developer' })).toBeUndefined()
    if (surface === 'desktop') expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: expect.stringContaining(`0 of ${GAMES.length} solved`) } })

    await ui.press({ key: 'tab-classics' })
    await ui.press({ key: 'game-lexer' })
    expect(await ui.find({ key: 'guess' })).toBeDefined()
    await ui.input({ key: 'guess', text: 'react' })
    await ui.press({ key: 'back' })
    expect((await ui.find({ key: 'cat-Classics' }))?.text).toContain('in progress')
    await ui.unmount()
  })

  test(`Lexer: refuses bad words, wins, shares (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    const mem: Record<string, unknown> = {}
    on('store.set', (_$, e) => {
      mem[e.key] = e.value
      return { value: undefined }
    })
    on('store.get', (_$, e) => ({ value: mem[e.key] }))
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'tab-classics' })
    await ui.press({ key: 'game-lexer' })
    await ui.input({ key: 'guess', text: 'zzzzz' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('not in the word list')
    await ui.input({ key: 'guess', text: answerFor(DAY) })
    expect(await ui.find({ key: 'note' })).toBeUndefined()
    expect(await ui.find({ key: 'guess' })).toBeUndefined()
    expect((await ui.find({ key: 'share' }))?.text).toContain(`Lexer #${DAY + 1}  1/6`)
    expect(mem.stats).toMatchObject({ lexer: { won: 1, streak: 1 } })
    await ui.press({ key: 'back' })
    expect((await ui.find({ key: 'cat-Classics' }))?.text).toContain('solved')
    await ui.unmount()
    expect(await $.command.run(SHARE)).toMatchObject({ text: expect.stringContaining(`Lexer #${DAY + 1}`) })
  })

  test(`Buckets: pick a group and submit it (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'tab-classics' })
    await ui.press({ key: 'game-buckets' })
    const [group, other] = [bucketsFor(DAY).groups[2]!, bucketsFor(DAY).groups[0]!]
    for (const t of [...group.terms.slice(0, 3), other.terms[0]!]) await ui.press({ key: `term-${t}` })
    await ui.press({ key: 'submit' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('One away')
    await ui.press({ key: `term-${other.terms[0]}` })
    await ui.press({ key: `term-${group.terms[3]}` })
    expect(await ui.find({ key: 'submit' })).toMatchObject({ props: { label: 'submit 4/4' } })
    await ui.press({ key: 'submit' })
    expect((await ui.find({ key: 'solved-2' }))?.text).toContain(group.name)
    expect(await ui.find({ key: `term-${group.terms[0]}` })).toBeUndefined()
    expect((await ui.find({ key: 'controls' }))?.text).toContain('●●●○')
    await ui.unmount()
  })

  test(`Daemons: typing and clicking toggle, clashes show (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    const mem: Record<string, unknown> = {}
    on('store.set', (_$, e) => {
      mem[e.key] = e.value
      return { value: undefined }
    })
    on('store.get', (_$, e) => ({ value: mem[e.key] }))
    const ui = await $.ui.mount({ plugin: 'daily-grind', surface, ...PANE })
    await ui.press({ key: 'tab-classics' })
    await ui.press({ key: 'game-daemons' })
    await ui.input({ key: 'cell', text: 'a1' })
    expect((await ui.find({ key: 'cell-a1' }))?.props).toMatchObject({ label: expect.stringContaining('◆') })
    await ui.press({ key: 'cell-b2' })
    expect((await ui.find({ key: 'cell-b2' }))?.props).toMatchObject({ label: expect.stringContaining('✖') })
    await ui.input({ key: 'cell', text: 'z9' })
    expect((await ui.find({ key: 'note' }))?.text).toContain('column a-g')
    expect(mem.today).toMatchObject({ day: DAY, saves: { daemons: { cells: [0, 8], moves: 2 } } })
    await ui.press({ key: 'reset' })
    expect(JSON.stringify((await ui.find({ key: 'cell-a1' }))?.props)).not.toContain('◆')
    await ui.unmount()
  })
}

test('/grind share prints finished games', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  expect(await $.command.run(SHARE)).toMatchObject({ text: expect.stringContaining('Nothing finished') })
})

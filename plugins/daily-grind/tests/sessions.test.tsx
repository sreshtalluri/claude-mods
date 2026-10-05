import { expect, test } from 'claude-code/testing'

import { answerFor } from '../hooks/games/lexer/logic'
import { dayIndex } from '../hooks/shared'

const NOW = new Date(2026, 9, 3, 12).getTime()
const DAY = dayIndex(NOW)
const PANE = {
  component: 'Pane',
  requestId: 'daily-grind',
  props: { title: 'Daily Grind', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

// Two open sessions share one store: a move here must not wipe a game another session played.
test('a move keeps the progress another session stored', async ($, on) => {
  const ladder = { path: ['pear', 'fear'] }
  const mem: Record<string, unknown> = { today: { day: DAY, saves: { ladder } }, stats: { ladder: { played: 1, won: 1, streak: 1, best: 1, lastWin: DAY } } }
  on('clock.now', () => ({ value: NOW }) as never)
  on('store.get', (_$, e) => ({ value: mem[e.key] }))
  on('store.set', (_$, e) => {
    mem[e.key] = e.value
    return { value: undefined }
  })
  const ui = await $.ui.mount({ plugin: 'daily-grind', surface: 'terminal', ...PANE })
  await ui.press({ key: 'tab-classics' })
  await ui.press({ key: 'game-lexer' })
  // Meanwhile another session wins Codebreaker.
  const other = mem.today as { saves: Record<string, unknown> }
  mem.today = { day: DAY, saves: { ...other.saves, codebreaker: { rows: ['done'] } } }
  await ui.input({ key: 'guess', text: answerFor(DAY) })

  const saves = (mem.today as { saves: Record<string, unknown> }).saves
  expect(saves.ladder).toEqual(ladder)
  expect(saves.codebreaker).toEqual({ rows: ['done'] })
  expect(saves.lexer).toBeDefined()
  expect(mem.stats).toMatchObject({ ladder: { won: 1 }, lexer: { won: 1 } })
})

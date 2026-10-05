import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

/** The world beneath the plugin: store, clock, turns, and the toasts it shows. */
const engine = (on: On) => {
  const toasts: string[] = []
  mock.store(on)
  mock.clock(on, { now: 1e12 })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.toast', (_, e) => void toasts.push(e.text))
  // The engine's own band: nothing.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => h($.ui.resolve(e).Box, {}))
  return toasts
}

const done = (turnId: string) => ({ answer: '', durationMs: 1, isAborted: false, turnId, reason: 'answer' as const })

test('a bet placed from the band closes at the first tool call and settles at turn end', async ($, on) => {
  const toasts = engine(on)
  on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }) as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    await $.turn.start({ text: 'fix it', turnId: surface })
    const ui = await $.ui.mount({ plugin: 'side-bet', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /PLAY MONEY/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /OPEN/ })).toBeDefined()
    // The terminal quotes each side in cents in its own column; the desktop draws a probability bar.
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: /^\s*50¢$/ })).toBeDefined()
    else expect(await ui.find({ type: 'Svg' })).toBeDefined()
    await ui.press({ key: 'tests-yes' })
    expect(await ui.find({ type: 'Text', text: /Yes \d+¢ · 100 → \d+|YES @ \d+¢ {2}100 → pays \d+/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: surface === 'terminal' ? /^900 chips/ : /^990 chips/ })).toBeDefined()

    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    expect(await ui.find({ type: 'Text', text: /betting closed/ })).toBeDefined()
    expect(await ui.find({ key: 'files-over' })).toBeUndefined()

    await $.turn.complete(done(surface))
    // The next turn's book opens at once, so bets can go in while the prompt is written; last turn's result shows.
    expect(await ui.find({ key: 'tests-yes' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /betting closed/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /✓ Tests pass Yes \+\d+/ })).toBeDefined()
    expect(toasts.at(-1)).toMatch(/✓ Tests YES \+\d+/)
    await ui.unmount()
  }
  expect(toasts[0]).toMatch(/SETTLED \+90 │ ✓ Tests YES \+90 │ 1,090 play chips/)
})

test('a narrow terminal drops the payout and LINE columns but keeps every hotkey', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'go', turnId: 'n' })
  const ui = await $.ui.mount({ plugin: 'side-bet', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: 50 } })
  expect(await ui.find({ type: 'Text', text: /pays/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^LINE$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Files o\/u 2\.5/ })).toBeDefined()
  for (const key of ['tests-yes', 'tests-no', 'files-over', 'files-under', 'ask-yes', 'ask-no'])
    expect(await ui.find({ key })).toBeDefined()
  await ui.unmount()
})

test('a permission ask settles the ask market; an abort refunds', async ($, on) => {
  const toasts = engine(on)
  on('tool.check', () => ({ decision: 'ask' }))
  await $.turn.start({ text: 'go', turnId: 'a' })
  const ui = await $.ui.mount({ plugin: 'side-bet', surface: 'terminal', ...BAND })
  await ui.press({ key: 'ask-yes' })
  await $.tool.check({ tool: 'Edit', input: {}, tool_use_id: 'x' })
  await $.turn.complete(done('a'))
  await ui.unmount()
  expect(toasts.at(-1)).toMatch(/✓ Ask YES \+90 │ 1,090 play chips/)

  // A bet placed between turns rides into the next one.
  const ui2 = await $.ui.mount({ plugin: 'side-bet', surface: 'desktop', ...BAND })
  await ui2.press({ key: 'files-over' })
  await $.turn.start({ text: 'again', turnId: 'b' })
  expect(await ui2.find({ type: 'Text', text: /Over \d+¢ · 100 → \d+/ })).toBeDefined()
  expect(await ui2.find({ type: 'Text', text: /Bet slip · 1 position/ })).toBeDefined()
  await $.turn.complete({ ...done('b'), isAborted: true, reason: 'aborted' })
  await ui2.unmount()
  expect(toasts.at(-1)).toMatch(/CUT SHORT · refunded │ ○ Files OVER 0\.5 void │ 1,090 play chips/)
})

test('/bets draws its framed slip line by line on the terminal and leaves the desktop its code block', async ($, on) => {
  on('ui.render', { component: 'CommandOutput' }, ($, e) => h($.ui.resolve(e).Text, {}, e.props.text))
  const props = { command: 'bets', args: '', text: 'side-bet: ```\n╭─ BET SLIP ─╮\n│ ✓ Tests +90 │\n╰─────────╯\n```', isErrored: false }
  const term = await $.ui.mount({ plugin: 'side-bet', surface: 'terminal', component: 'CommandOutput', props })
  expect((await term.find({ type: 'Text', text: /✓ Tests/ }))?.props).toMatchObject({ color: 'green' })
  expect(await term.find({ type: 'Text', text: /```/ })).toBeUndefined()
  await term.unmount()
  const desk = await $.ui.mount({ plugin: 'side-bet', surface: 'desktop', component: 'CommandOutput', props })
  expect(await desk.find({ type: 'Text', text: /```/ })).toBeDefined()
  await desk.unmount()
})

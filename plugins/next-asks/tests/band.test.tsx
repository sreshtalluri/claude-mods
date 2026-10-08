import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { hangingWrap, parseIdeas, transcript } from '../hooks/suggest'

/** The engine's own answers beneath the plugin: an empty band, a plain turn end, the prompt as typed. */
const engine = (on: On) => {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
}

const BAND = {
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 } },
} as const
const TURN = { answer: 'Done.', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' } as const
const REPLY = '1. Add a test for the empty-input case\n- Update the README install section\n"Check the CI config uses the new env var"\nA fourth one'

test('parseIdeas strips numbering, bullets and quotes, keeps three', async () => {
  expect(parseIdeas(REPLY)).toEqual([
    'Add a test for the empty-input case',
    'Update the README install section',
    'Check the CI config uses the new env var',
  ])
  expect(parseIdeas('NONE')).toEqual([])
  expect(parseIdeas('  none \n')).toEqual([])
})

test('hangingWrap breaks on words and indents continuation lines by the hotkey prefix', async () => {
  expect(hangingWrap('Add tests for power covering zero and negatives', 20)).toBe(
    'Add tests for power\n   covering zero and\n   negatives',
  )
  expect(hangingWrap('short one', 20)).toBe('short one')
  // A word longer than the width stays whole on its own line.
  expect(hangingWrap('see supercalifragilistic', 10)).toBe('see\n   supercalifragilistic')
})

test('transcript labels roles, lists tools and keeps the tail', async () => {
  const text = transcript([
    { role: 'user', text: 'x'.repeat(20_000), toolUses: [] },
    { role: 'assistant', text: 'Moved it.', toolUses: [{ tool: 'Bash', input: {} } as never] },
    { role: 'assistant', text: '', toolUses: [] },
  ])
  expect(text.endsWith('AGENT: Moved it. [tools: Bash]')).toBe(true)
  expect(text.length).toBe(12_000)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a finished turn fills the band; pressing an idea fills the prompt (${surface})`, async ($, on) => {
    engine(on)
    const clock = mock.clock(on)
    const asked: string[] = []
    const filled: string[] = []
    on('session.messages', () => ({ value: [{ role: 'user', text: 'Rename the util', toolUses: [] }] }))
    on('model.complete', (_$, e) => {
      asked.push(e.model)
      return { value: { isAnswered: true, text: REPLY, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
    })
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })

    const ui = await $.ui.mount({ plugin: 'next-asks', surface, ...BAND })
    expect(await ui.find({ type: 'Button' })).toBeUndefined()

    await $.turn.complete(TURN)
    await clock.advance(1)
    expect(asked).toEqual(['haiku'])
    expect((await ui.find({ key: 'idea-0' }))?.text).toContain('Add a test for the empty-input case')
    expect(await ui.find({ key: 'idea-2' })).toBeDefined()

    await ui.press({ key: 'idea-1' })
    expect(filled).toEqual(['Update the README install section'])

    // A new prompt clears the stale ideas.
    await $.prompt.submit({ text: 'next' } as never)
    expect(await ui.find({ key: 'idea-0' })).toBeUndefined()
    await ui.unmount()
  })
}

test('the band steps aside while the draft opens a / or @ search', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  on('session.messages', () => ({ value: [{ role: 'user', text: 'hi', toolUses: [] }] }))
  on('model.complete', () => ({
    value: { isAnswered: true, text: REPLY, usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
  }))
  // The editor beneath: the draft after the splice.
  on('prompt.edit', (_$, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length } as never
  })
  const edit = (text: string, inputText: string, start: number, end = start) =>
    $.prompt.edit({ origin: { kind: 'person' }, text, cursor: start, start, end, inputText, kind: 'composer' } as never)

  const ui = await $.ui.mount({ plugin: 'next-asks', surface: 'terminal', ...BAND })
  await $.turn.complete(TURN)
  await clock.advance(1)
  expect(await ui.find({ key: 'idea-0' })).toBeDefined()

  await edit('', '/', 0)
  expect(await ui.find({ key: 'idea-0' })).toBeUndefined()
  await edit('/', '', 0, 1)
  expect(await ui.find({ key: 'idea-0' })).toBeDefined()
  await edit('', '@', 0)
  expect(await ui.find({ key: 'idea-0' })).toBeUndefined()
  await edit('@', 'fix', 0, 1)
  expect(await ui.find({ key: 'idea-0' })).toBeDefined()
  await ui.unmount()
})

test('subagent turns and interrupted turns ask nothing', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  let calls = 0
  on('session.messages', () => ({ value: [{ role: 'user', text: 'hi', toolUses: [] }] }))
  on('model.complete', () => {
    calls += 1
    return { value: { isAnswered: true, text: 'NONE', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  await $.turn.complete({ ...TURN, agentId: 'sub' })
  await $.turn.complete({ ...TURN, reason: 'aborted', isAborted: true })
  await clock.advance(1)
  expect(calls).toBe(0)
})

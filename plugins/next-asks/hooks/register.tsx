import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { hangingWrap, HOTKEY_PREFIX, parseIdeas, SYSTEM, transcript } from './suggest'

const ideas = atom({ plugin: 'next-asks', key: 'ideas' } as const, [] as string[])
const isHidden = atom({ plugin: 'next-asks', key: 'isHidden' } as const, false)

/** Asks Haiku for follow-ups over the conversation's tail; a failed call just leaves the band empty. */
const refresh = async ($: EngineInterface) => {
  const tail = transcript(await $.session.messages())
  if (tail === '') return
  const r = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: tail,
    maxTokens: 200,
    effort: 'low',
    timeoutMs: 20_000,
  })
  if (r.isAnswered) await update($, ideas, () => parseIdeas(r.text))
}

export const register: Register = on => {
  // A new prompt makes the last turn's ideas stale.
  on('prompt.submit', async ($, e, next) => {
    await update($, ideas, () => [])
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Main loop only, and only turns that answered; a timer so the turn ends without waiting on Haiku.
    if (e.agentId === undefined && e.reason === 'answer') {
      $.clock.after(0, () => void refresh($).catch(() => {}))
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, ideas)
    if (e.props.hasSurvey || e.props.isWorking || list.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // The terminal wraps a label under its `1:`; wrap it ourselves with a hanging indent.
    // Desktop draws a proportional font, so it wraps on its own.
    const textWidth = e.props.bodyColumns - 4 - HOTKEY_PREFIX // border 2 + padding 2
    const label = (idea: string) => (e.surface === 'terminal' ? hangingWrap(idea, textWidth) : idea)

    // Theme keys, not hex, so the box follows the person's light or dark theme on every surface.
    return (
      <Box
        flexDirection="column"
        width={e.props.bodyColumns}
        borderStyle="round"
        borderColor="suggestion"
        paddingX={1}
      >
        <Box justifyContent="space-between">
          <Text color="claude" bold>
            ✦ Worth asking next
          </Text>
          <Button key="hide" label="hide" plain dimColor onPress={() => update($, isHidden, () => true)} />
        </Box>
        {list.map((idea, i) => (
          <Button
            key={`idea-${i}`}
            label={label(idea)}
            hotkey={String(i + 1)}
            plain
            onPress={() => $.prompt.fill({ text: idea })}
          />
        ))}
      </Box>
    )
  })
}

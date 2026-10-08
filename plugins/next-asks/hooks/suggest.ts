import type { SessionMessage } from 'claude-code'

export const MAX_IDEAS = 3
/** How much of the conversation's tail Haiku reads: enough for the current task, cheap per turn. */
const TAIL_CHARS = 12_000

export const SYSTEM = `You watch a developer's session with a coding agent. After the agent's latest turn, suggest up to ${MAX_IDEAS} short follow-up requests the developer could send next.

Favor what they might not think to ask: a missed edge case, a test or check nobody ran, a related file or config that likely needs the same change, a risk, a cleanup, docs or deploy steps. Skip the obvious next step they are already heading to and anything the agent already did.

Write each as the developer would type it to the agent, imperative, under 90 characters, one per line, no numbering or bullets. If nothing is worth suggesting, reply NONE.`

/** The conversation's tail as plain lines, newest last, cut to `TAIL_CHARS`. */
export const transcript = (messages: readonly SessionMessage[]): string => {
  const lines: string[] = []
  for (const m of messages) {
    const tools = m.toolUses.map(t => t.tool).join(', ')
    const text = m.text.trim()
    if (text === '' && tools === '') continue
    lines.push(`${m.role === 'user' ? 'DEVELOPER' : 'AGENT'}: ${text}${tools ? ` [tools: ${tools}]` : ''}`)
  }
  return lines.join('\n\n').slice(-TAIL_CHARS)
}

/** Width of the `1: ` a hotkeyed Button draws before its label. */
export const HOTKEY_PREFIX = 3

/**
 * Word-wraps `text` to `width` cells with continuation lines indented by
 * `HOTKEY_PREFIX`, so a wrapped label hangs under its first word, not its `1:`.
 */
export const hangingWrap = (text: string, width: number): string => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line !== '' && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else {
      line = line === '' ? word : `${line} ${word}`
    }
  }
  if (line !== '') lines.push(line)
  return lines.join(`\n${' '.repeat(HOTKEY_PREFIX)}`)
}

/** Haiku's reply as at most `MAX_IDEAS` clean one-line asks. */
export const parseIdeas = (reply: string): string[] => {
  if (/^\s*NONE\s*$/i.test(reply)) return []
  return reply
    .split('\n')
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["“]|["”]$/g, '').trim())
    .filter(l => l !== '' && !/^NONE$/i.test(l))
    .slice(0, MAX_IDEAS)
}

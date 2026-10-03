import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ReceiptLifetime, ReceiptStats } from '../types'
import {
  countAbsolutelyRight,
  countApologies,
  emptyStats,
  formatReceipt,
  isRule,
  isTotal,
} from './format'

const stats = atom({ plugin: 'session-receipt', key: 'stats' } as const, emptyStats())
const LIFETIME = 'lifetime'
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/** Never let bookkeeping break the session: a failed write just loses a stat. */
const tally = async ($: EngineInterface, fn: (s: ReceiptStats) => ReceiptStats) => {
  try {
    await update($, stats, fn)
  } catch {
    // stats are best effort
  }
}

const readLifetime = async ($: EngineInterface): Promise<ReceiptLifetime> => {
  const raw = (await $.store.get(LIFETIME)) as Partial<ReceiptLifetime> | undefined
  return { sessions: Number(raw?.sessions ?? 0), usd: Number(raw?.usd ?? 0) }
}

const buildReceipt = async ($: EngineInterface): Promise<string[]> => {
  const usage = await $.session.usage()
  const lifetime = await readLifetime($)
  return formatReceipt({
    stats: await read($, stats),
    usd: usage.cost?.usd ?? null,
    startedAt: usage.startedAt,
    now: await $.clock.now(),
    cwd: await $.session.cwd(),
    sessionId: await $.session.id(),
    number: lifetime.sessions + 1,
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'receipt',
      description: 'Print a receipt for this session (tokens, cost, tools, files)',
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const startedAt = await $.clock.now()
    const ran = await next(e)
    const ms = (await $.clock.now()) - startedAt
    const tool = String(e.tool)
    const path = (e as { file_path?: unknown }).file_path

    await tally($, s => ({
      ...s,
      toolCalls: s.toolCalls + 1,
      toolCounts: { ...s.toolCounts, [tool]: (s.toolCounts[tool] ?? 0) + 1 },
      failedCalls: s.failedCalls + (ran.isError === true ? 1 : 0),
      deniedCalls: s.deniedCalls + (ran.deny !== undefined ? 1 : 0),
      editCounts:
        EDIT_TOOLS.has(tool) && typeof path === 'string' && ran.deny === undefined && ran.isError !== true
          ? { ...s.editCounts, [path]: (s.editCounts[path] ?? 0) + 1 }
          : s.editCounts,
      longest: !s.longest || ms > s.longest.ms ? { tool, ms } : s.longest,
    }))

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const isMain = e.agentId === undefined
    const u = e.usage

    await tally($, s => ({
      ...s,
      turns: s.turns + (isMain ? 1 : 0),
      interrupts: s.interrupts + (isMain && e.isAborted ? 1 : 0),
      absolutelyRight: s.absolutelyRight + (isMain ? countAbsolutelyRight(e.answer) : 0),
      apologies: s.apologies + (isMain ? countApologies(e.answer) : 0),
      tokensIn: s.tokensIn + (u?.input_tokens ?? 0),
      tokensOut: s.tokensOut + (u?.output_tokens ?? 0),
      cacheRead: s.cacheRead + (u?.cache_read_input_tokens ?? 0),
      cacheWrite: s.cacheWrite + (u?.cache_creation_input_tokens ?? 0),
    }))

    return next(e)
  })

  on('command.run', { command: 'receipt' }, async $ => {
    const lines = await buildReceipt($)
    return { text: '```\n' + lines.join('\n') + '\n```' }
  })

  // Draw the receipt as a bordered slip instead of a plain code block.
  on('ui.render', { component: 'CommandOutput', props: { command: 'receipt' } }, async ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const lines = e.props.text
      .split('\n')
      .filter(line => !line.startsWith('```'))
    if (lines.length < 5) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const plain = lines.join('\n')

    return (
      <Box flexDirection="column" alignItems="flex-start">
        <Box key="slip" flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          {lines.map((line, i) =>
            i === 0 ? (
              <Text bold>{line}</Text>
            ) : isTotal(line) ? (
              <Text bold color="green">
                {line}
              </Text>
            ) : isRule(line) ? (
              <Text dimColor>{line}</Text>
            ) : (
              <Text>{line}</Text>
            ),
          )}
        </Box>
        <Button
          key="copy"
          label="Copy receipt"
          onPress={press => {
            void $.ui.copy({ text: plain, surface: press.surface })
            $.ui.toast('Receipt copied')
          }}
        />
      </Box>
    )
  })

  on('session.end', async ($, e, next) => {
    try {
      const usage = await $.session.usage()
      const lifetime = await readLifetime($)
      await $.store.set(LIFETIME, {
        sessions: lifetime.sessions + 1,
        usd: lifetime.usd + (usage.cost?.usd ?? 0),
      })
      if (e.reason === 'clear') await update($, stats, () => emptyStats())
    } catch {
      // best effort inside session.end's short budget
    }
    return next(e)
  })
}

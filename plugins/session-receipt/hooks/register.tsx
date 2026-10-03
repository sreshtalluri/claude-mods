import { atom, read, update } from 'claude-code'
import type { ButtonProps, EngineInterface, Register } from 'claude-code'

import type { ReceiptLifetime, ReceiptStats } from '../types'
import {
  countAbsolutelyRight,
  countApologies,
  emptyStats,
  formatReceipt,
  isRule,
  isShipCommand,
  isTotal,
  receiptFileName,
  receiptSvg,
  slipLines,
} from './format'

const stats = atom({ plugin: 'session-receipt', key: 'stats' } as const, emptyStats())
const LIFETIME = 'lifetime'
/** The last saved receipt: `{ lines, path, seen }`, for `/receipt last` and the next start's toast. */
const LAST = 'last'
type LastReceipt = { lines: string[]; path: string; seen: boolean }
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
  // ponytail: module-level, so a reload can toast once more; fine for a nudge.
  let shipToasted = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'receipt',
      description: 'Print a receipt for this session (tokens, cost, tools, files)',
      argumentHint: '[last]',
    })
    const last = (await $.store.get(LAST)) as LastReceipt | undefined
    if (last && !last.seen) {
      const total = last.lines.find(isTotal)?.replace(/^TOTAL[ .]*/, '').trim()
      $.ui.toast(`🧾 Last session's receipt${total ? ` (${total})` : ''}: /receipt last`, { timeoutMs: 8000 })
      await $.store.set(LAST, { ...last, seen: true })
    }
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

    if (!shipToasted && tool === 'Bash' && !ran.isError && ran.deny === undefined) {
      const command = (e as { command?: unknown }).command
      if (typeof command === 'string' && isShipCommand(command)) {
        shipToasted = true
        $.ui.toast('🧾 Shipped! /receipt for the tab')
      }
    }

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

  on('command.run', { command: 'receipt' }, async ($, e) => {
    if (e.args.trim() === 'last') {
      const last = (await $.store.get(LAST)) as LastReceipt | undefined
      if (!last) return { text: 'No saved receipt yet: one is saved when a session ends.' }
      return { text: '```\n' + last.lines.join('\n') + '\n```\n' + last.path }
    }
    const lines = await buildReceipt($)
    return { text: '```\n' + lines.join('\n') + '\n```' }
  })

  // Draw the receipt as a bordered slip instead of a plain code block.
  on('ui.render', { component: 'CommandOutput', props: { command: 'receipt' } }, async ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const lines = slipLines(e.props.text)
    if (lines.length < 5) return next(e)
    const plain = lines.join('\n')

    const copy: ButtonProps['onPress'] = press => {
      void $.ui.copy({ text: plain, surface: press.surface })
      $.ui.toast('Receipt copied')
    }

    if (e.surface !== 'terminal') {
      // Proportional-font surfaces: draw a paper slip instead of padded text.
      const { Box, Svg, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" alignItems="flex-start" gap={1}>
          <Svg key="slip" source={receiptSvg(lines)} alt={plain} />
          <Button key="copy" label="Copy receipt" onPress={copy} />
        </Box>
      )
    }

    const { Box, Text, Button } = $.ui.resolve(e)
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
        <Button key="copy" label="Copy receipt" onPress={copy} />
      </Box>
    )
  })

  on('session.end', async ($, e, next) => {
    try {
      const s = await read($, stats)
      // An opened-and-closed session gets no receipt and no number.
      if (s.turns > 0 || s.toolCalls > 0) {
        const usage = await $.session.usage()
        const lifetime = await readLifetime($)
        const lines = await buildReceipt($)
        const home = (await $.env.get('HOME')) ?? '~'
        const path = `${home}/.claude/receipts/${receiptFileName(await $.clock.now(), await $.session.cwd(), lifetime.sessions + 1)}`
        await $.store.set(LIFETIME, {
          sessions: lifetime.sessions + 1,
          usd: lifetime.usd + (usage.cost?.usd ?? 0),
        })
        await $.store.set(LAST, { lines, path, seen: false } satisfies LastReceipt)
        await $.fs.write(path, lines.join('\n') + '\n')
      }
      if (e.reason === 'clear') await update($, stats, () => emptyStats())
    } catch {
      // best effort inside session.end's short budget
    }
    return next(e)
  })
}

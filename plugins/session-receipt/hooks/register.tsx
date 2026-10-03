import { atom, read, update } from 'claude-code'
import type { ButtonProps, EngineInterface, Register } from 'claude-code'

import type { ReceiptLifetime, ReceiptStats } from '../types'
import {
  countAbsolutelyRight,
  countApologies,
  emptyStats,
  DAY,
  formatReceipt,
  formatWeek,
  isCredit,
  isRule,
  isShipCommand,
  isTotal,
  receiptFileName,
  receiptSvg,
  slipLines,
  summarize,
} from './format'
import { clipboardCommand, drawCommands } from './image'
import type { Platform } from './image'
import type { ReceiptInput, SessionSummary } from './format'

const stats = atom({ plugin: 'session-receipt', key: 'stats' } as const, emptyStats())
const LIFETIME = 'lifetime'
/** The last saved receipt: `{ lines, path, seen }`, for `/receipt last` and the next start's toast. */
const LAST = 'last'
type LastReceipt = { lines: string[]; path: string; seen: boolean }
/** Finished sessions' summaries, a month deep, for `/receipt week`. */
const HISTORY = 'history'
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

const snapshot = async ($: EngineInterface): Promise<ReceiptInput> => {
  const usage = await $.session.usage()
  const lifetime = await readLifetime($)
  return {
    stats: await read($, stats),
    usd: usage.cost?.usd ?? null,
    startedAt: usage.startedAt,
    now: await $.clock.now(),
    cwd: await $.session.cwd(),
    sessionId: await $.session.id(),
    number: lifetime.sessions + 1,
    model: await $.session.model().catch(() => null),
  }
}

const isEmpty = (s: ReceiptStats) => s.turns === 0 && s.toolCalls === 0

const readHistory = async ($: EngineInterface) =>
  ((await $.store.get(HISTORY)) as SessionSummary[] | undefined) ?? []

const receiptsDir = async ($: EngineInterface) =>
  `${(await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? '~'}/.claude/receipts`

/** The slip as a square PNG on the clipboard; where nothing can draw it, the SVG's path. */
const copyImage = async ($: EngineInterface, lines: string[]) => {
  try {
    const dir = `${await receiptsDir($)}/images`
    const svg = `${dir}/receipt.svg`
    const png = `${svg}.png`
    await $.fs.write(svg, receiptSvg(lines, { backdrop: true }))

    const os: Platform =
      (await $.env.get('OS')) === 'Windows_NT' ? 'windows'
      : (await $.process.run(['uname']).then(r => r.stdout.trim(), () => '')) === 'Darwin' ? 'mac'
      : 'linux'
    const ok = (argv: string[]) => $.process.run(argv, { timeoutMs: 20_000 }).then(r => r.exitCode === 0, () => false)

    let drawn = false
    const win = {
      programFiles: (await $.env.get('ProgramFiles')) ?? 'C:\\Program Files',
      programFilesX86: (await $.env.get('ProgramFiles(x86)')) ?? 'C:\\Program Files (x86)',
      localAppData: (await $.env.get('LOCALAPPDATA')) ?? '',
    }
    for (const argv of drawCommands(os, svg, png, dir, win)) if ((drawn = await ok(argv))) break

    if (drawn && (await ok(clipboardCommand(os, png)))) $.ui.toast('🧾 Receipt image copied')
    else $.ui.toast(`Receipt image saved: ${drawn ? png : svg}`, { timeoutMs: 8000 })
  } catch {
    $.ui.toast('Could not make the receipt image')
  }
}

export const register: Register = on => {
  // ponytail: module-level, so a reload can toast once more; fine for a nudge.
  let shipToasted = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'receipt',
      description: 'Print a receipt for this session (or: last, week)',
      argumentHint: '[last|week]',
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
    const now = await $.clock.now()
    if (e.args.trim() === 'week') {
      const current = await snapshot($)
      const sessions = await readHistory($)
      const lines = formatWeek(isEmpty(current.stats) ? sessions : [...sessions, summarize(current.stats, current)], now)
      return { text: '```\n' + lines.join('\n') + '\n```' }
    }
    const lines = formatReceipt(await snapshot($))
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

    const image: ButtonProps['onPress'] = () => void copyImage($, lines)

    if (e.surface !== 'terminal') {
      // Proportional-font surfaces: draw a paper slip instead of padded text.
      const { Box, Svg, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" alignItems="flex-start" gap={1}>
          <Svg key="slip" source={receiptSvg(lines)} alt={plain} />
          <Box key="actions" flexDirection="row" gap={1}>
            <Button key="copy" label="Copy text" onPress={copy} />
            <Button key="image" label="Copy image" onPress={image} />
          </Box>
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
            ) : isRule(line) || isCredit(line) ? (
              <Text dimColor>{line}</Text>
            ) : (
              <Text>{line}</Text>
            ),
          )}
        </Box>
        <Box key="actions" flexDirection="row" gap={1}>
          <Button key="copy" label="Copy text" onPress={copy} />
          <Button key="image" label="Copy image" onPress={image} />
        </Box>
      </Box>
    )
  })

  on('session.end', async ($, e, next) => {
    try {
      const r = await snapshot($)
      // An opened-and-closed session gets no receipt and no number.
      if (!isEmpty(r.stats)) {
        const lines = formatReceipt(r)
        const path = `${await receiptsDir($)}/${receiptFileName(r.now, r.cwd, r.number)}`
        const history = (await readHistory($)).filter(x => r.now - x.at < 35 * DAY)
        await $.store.set(LIFETIME, { sessions: r.number, usd: (await readLifetime($)).usd + (r.usd ?? 0) })
        await $.store.set(HISTORY, [...history, summarize(r.stats, r)])
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

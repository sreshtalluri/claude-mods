import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register } from 'claude-code'

import type { SideBetOffer, SideBetPick, SideBetRound, SideBetSlip } from '../types'
import { cents, FLOOR, formatSlip, formatStats, isTestCommand, learn, loadBook, MARK, offers, refill, settle, signed, STAKE } from './logic'
import type { Book, Observed } from './logic'

const round = atom({ plugin: 'side-bet', key: 'round' } as const, null)
const BOOK = 'book'
const EDITS = new Set(['Edit', 'Write', 'NotebookEdit'])

const getBook = async ($: EngineInterface) => refill(loadBook(await $.store.get(BOOK)), await $.clock.now())
const chips = (n: number) => n.toLocaleString('en-US')

const place = async ($: EngineInterface, bet: SideBetPick) => {
  const r = await read($, round)
  if (!r?.isOpen) return $.ui.toast('🎲 Betting closed at the first tool call')
  if (r.bets.some(b => b.market === bet.market)) return $.ui.toast('🎲 One bet per market')
  const book = await getBook($)
  if (book.chips < STAKE) return $.ui.toast(`🎲 Out of chips: tops up to ${chips(FLOOR)} tomorrow (UTC)`)
  const left = book.chips - STAKE
  await $.store.set(BOOK, { ...book, chips: left })
  await update($, round, x => x && { ...x, bets: [...x.bets, bet], chips: left })
}

// Betting opens before the turn (while the prompt is written) and closes at its first tool call.
const openNext = async ($: EngineInterface, book: Book, last?: SideBetSlip) =>
  update($, round, () => ({ turnId: null, isOpen: true, offers: offers(book.rates), bets: [], chips: book.chips, ...(last ? { last } : {}) }))

// ---- drawing -------------------------------------------------------------

type CardElements = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Svg'>
type BandProps = { bodyColumns: number; maxRows: number }

const TITLE: Record<SideBetPick['market'], [wide: string, short: string]> = {
  tests: ['Tests pass?', 'Tests pass?'],
  files: ['Files touched', 'Files o/u'],
  ask: ['Asks permission?', 'Asks perm?'],
}
const SHORT: Record<SideBetPick['market'], string> = { tests: 'Tests', files: 'Files', ask: 'Ask' }
const isYes = (p: SideBetPick) => p.side === 'yes' || p.side === 'over'
const sideColor = (p: SideBetPick) => (isYes(p) ? 'green' : 'red')
const hotkey = (i: number, j: number) => String(i * 2 + j + 1)
const ago = (s: SideBetSlip) =>
  s.results.map(x => `${MARK[x.outcome]} ${TITLE[x.bet.market][1].replace('?', '')} ${x.bet.label} ${x.outcome === 'void' ? 'void' : signed(x.delta)}`).join(' · ')

/** Terminal: a header, then one aligned row per market (MARKET | LINE | YES | NO), then last turn's result. */
const terminalBand = ($: EngineInterface, { Box, Button, Text }: Elements['terminal'], r: SideBetRound, { bodyColumns: cols, maxRows }: BandProps) => {
  const wide = cols >= 76 // room for the payout beside each price
  const roomy = cols >= 58 // room for the LINE column and the column heads
  const full = cols >= 100 // room for the status's explanation
  const W = { market: roomy ? 18 : 14, line: 6, btn: 9, price: 5, pays: wide ? 10 : 0 }
  const side = W.btn + W.price + W.pays
  const showHeads = roomy && maxRows >= 5 + (r.last ? 1 : 0)
  const showLast = r.last && r.last.results.length > 0 && maxRows >= 5

  const cell = (p: SideBetPick, i: number, j: number) => (
    <Box key={`${p.market}-${p.side}-cell`} width={side} flexDirection="row">
      <Box width={W.btn}>
        {r.isOpen ? (
          <Button key={`${p.market}-${p.side}`} hotkey={hotkey(i, j)} plain label={p.label} onPress={() => place($, p)} />
        ) : (
          <Text dimColor>{`   ${p.label}`}</Text>
        )}
      </Box>
      <Box width={W.price}>
        <Text color={r.isOpen ? sideColor(p) : undefined} dimColor={!r.isOpen} bold={r.isOpen}>{cents(p.p).padStart(3)}</Text>
      </Box>
      {wide ? (
        <Box width={W.pays}>
          <Text dimColor>{`pays ${p.payout}`}</Text>
        </Box>
      ) : null}
    </Box>
  )

  const row = (o: SideBetOffer, i: number) => {
    const placed = r.bets.find(b => b.market === o.market)
    const title = roomy ? TITLE[o.market][0] : o.market === 'files' ? `${TITLE.files[1]} ${o.picks[0].line}` : TITLE[o.market][1]
    return (
      <Box key={o.market} flexDirection="row">
        <Box width={W.market}>
          <Text bold={!!placed} wrap="truncate">{title}</Text>
        </Box>
        {roomy ? (
          <Box width={W.line}>
            <Text dimColor>{o.market === 'files' ? String(o.picks[0].line) : ' –'}</Text>
          </Box>
        ) : null}
        {placed ? (
          <Text color={sideColor(placed)} wrap="truncate">
            {`● ${placed.label.toUpperCase()} @ ${cents(placed.p)}  ${STAKE} → pays ${placed.payout}${r.isOpen ? '' : '  · in play'}`}
          </Text>
        ) : (
          r.isOpen ? [cell(o.picks[0], i, 0), cell(o.picks[1], i, 1)] : <Text dimColor>{`   no position · ${o.picks.map(p => `${p.label} ${cents(p.p)}`).join(' / ')}`}</Text>
        )}
      </Box>
    )
  }

  const staked = r.bets.length * STAKE
  return (
    <Box flexDirection="column">
      <Box key="head" flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1} flexShrink={0}>
          <Text bold>🎲 SIDE BET</Text>
          <Text inverse bold>{' PLAY MONEY '}</Text>
          <Text>{`${chips(r.chips)} chips`}</Text>
          {roomy ? <Text dimColor>{staked ? `· ${staked} at risk` : `· ${STAKE}/bet`}</Text> : null}
        </Box>
        <Box flexShrink={0}>
          {r.isOpen ? (
            // A pressed bet leaves the keyboard on the band, and only Esc hands it back to the prompt.
            <Text color="green">{r.bets.length ? (full ? '● OPEN · esc to type your prompt' : '● OPEN · esc') : full ? '● OPEN · locks at first tool call' : '● OPEN'}</Text>
          ) : (
            <Text color="yellow">{full ? '◉ IN PLAY · betting closed' : '◉ CLOSED'}</Text>
          )}
        </Box>
      </Box>
      {showHeads ? (
        <Box key="heads" flexDirection="row">
          <Box width={W.market}><Text dimColor>MARKET</Text></Box>
          <Box width={W.line}><Text dimColor>LINE</Text></Box>
          <Box width={side}><Text dimColor>{'   YES / OVER'}</Text></Box>
          <Box width={side}><Text dimColor>{'   NO / UNDER'}</Text></Box>
        </Box>
      ) : null}
      {r.offers.map(row)}
      {showLast ? (
        <Box key="last" flexDirection="row" gap={1}>
          <Box flexShrink={0}>
            <Text dimColor>{roomy ? 'LAST TURN' : 'LAST'}</Text>
          </Box>
          <Text bold color={r.last!.isVoid ? undefined : r.last!.net > 0 ? 'green' : r.last!.net < 0 ? 'red' : undefined}>
            {r.last!.isVoid ? 'refunded' : signed(r.last!.net)}
          </Text>
          <Text dimColor wrap="truncate">{ago(r.last!)}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

const GREEN = '#16a34a'
const RED = '#dc2626'

/** A Yes/No probability bar: the Yes share in green, the rest in red, both labeled. */
const probBar = (yes: SideBetPick, no: SideBetPick, dim: boolean) => {
  const w = 220
  const h = 22
  const split = Math.round(w * Math.min(0.97, Math.max(0.03, yes.p)))
  const op = dim ? 0.35 : 1
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<defs><clipPath id="c"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>`
    + `<g clip-path="url(#c)" opacity="${op}"><rect width="${split}" height="${h}" fill="${GREEN}"/><rect x="${split}" width="${w - split}" height="${h}" fill="${RED}"/></g>`
    + `<g font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600" fill="#fff">`
    + `<text x="10" y="15">${yes.label} ${Math.round(yes.p * 100)}%</text>`
    + `<text x="${w - 10}" y="15" text-anchor="end">${no.label} ${Math.round(no.p * 100)}%</text></g></svg>`
}

/** Desktop and other rich surfaces: a market card, one row per market with a probability bar and priced buttons. */
const marketCard = ($: EngineInterface, { Box, Button, Svg, Text }: CardElements, r: SideBetRound) => {
  const staked = r.bets.length * STAKE
  const toWin = r.bets.reduce((n, b) => n + b.payout, 0)
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={r.isOpen ? GREEN : 'gray'} paddingX={1} gap={1}>
      <Box key="head" flexDirection="row" alignItems="center" gap={1}>
        <Text bold>🎲 Side Bet</Text>
        <Text backgroundColor="#6d28d9" color="#ffffff" bold>{' PLAY MONEY '}</Text>
        <Box flexGrow={1} />
        <Text bold>{`${chips(r.chips)} chips`}</Text>
        <Text dimColor>{`· ${STAKE} per bet`}</Text>
        <Text backgroundColor={r.isOpen ? GREEN : '#a16207'} color="#ffffff" bold>
          {r.isOpen ? ' ● OPEN ' : ' ◉ IN PLAY · betting closed '}
        </Text>
      </Box>
      {r.offers.map((o, i) => {
        const placed = r.bets.find(b => b.market === o.market)
        const [yes, no] = o.picks
        return (
          <Box key={o.market} flexDirection="row" alignItems="center" gap={2}>
            <Box flexDirection="column" flexGrow={1}>
              <Text bold>{TITLE[o.market][0]}</Text>
              <Text dimColor>{o.market === 'files' ? `Over/under ${yes.line} files` : `Yes ${cents(yes.p)} · No ${cents(no.p)}`}</Text>
            </Box>
            <Svg source={probBar(yes, no, !r.isOpen && !placed)} alt={`${yes.label} ${cents(yes.p)}, ${no.label} ${cents(no.p)}`} width={220} height={22} />
            {placed ? (
              <Box borderStyle="round" borderColor={isYes(placed) ? GREEN : RED} paddingX={1}>
                <Text color={isYes(placed) ? GREEN : RED} bold>{`${placed.label} ${cents(placed.p)} · ${STAKE} → ${placed.payout}`}</Text>
              </Box>
            ) : r.isOpen ? (
              <Box flexDirection="row" gap={1}>
                {o.picks.map((p, j) => (
                  <Button key={`${p.market}-${p.side}`} hotkey={hotkey(i, j)} variant={isYes(p) ? 'primary' : 'secondary'} label={`${p.label} ${cents(p.p)}`} onPress={() => place($, p)} />
                ))}
              </Box>
            ) : (
              <Text dimColor>no position</Text>
            )}
          </Box>
        )
      })}
      <Box key="slip" flexDirection="row" gap={1}>
        {r.bets.length ? (
          <Text>{`Bet slip · ${r.bets.length} position${r.bets.length > 1 ? 's' : ''} · ${staked} staked · up to ${toWin} back`}</Text>
        ) : r.last && r.last.results.length ? (
          <Text dimColor>{`Last turn ${r.last.isVoid ? 'refunded' : signed(r.last.net)} · ${ago(r.last)}`}</Text>
        ) : (
          <Text dimColor>{r.isOpen ? 'Pick a side · betting locks at the first tool call · prices are implied odds' : 'No positions this turn'}</Text>
        )}
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  // ponytail: per-turn tallies live in the module; a hot reload mid-turn loses them (bets still settle).
  let seen: Observed = { tests: null, files: 0, asked: false }
  let files = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'bets', description: 'Side bet: bankroll, record and calibration (play money)', immediate: true })
    await openNext($, await getBook($))
    return next(e)
  })

  on('command.run', { command: 'bets' }, async $ => {
    const last = (await read($, round))?.last
    const lines = [...formatStats(await getBook($)), ...(last?.results.length ? ['', ...formatSlip(last)] : [])]
    return { text: '```\n' + lines.join('\n') + '\n```' }
  })

  // A main turn takes the open book, bets placed beforehand included (subagent runs raise no turn.start).
  on('turn.start', async ($, e, next) => {
    seen = { tests: null, files: 0, asked: false }
    files = new Set()
    const book = await getBook($)
    await $.store.set(BOOK, book)
    const prev = await read($, round)
    // The last turn's slip leaves the band as the new turn starts.
    const { last: _, ...open } = prev ?? {}
    await update($, round, () => prev?.isOpen
      ? { ...(open as SideBetRound), turnId: e.turnId, chips: book.chips }
      : { turnId: e.turnId, isOpen: true, offers: offers(book.rates), bets: [], chips: book.chips })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const r = await read($, round)
    if (r?.isOpen) await update($, round, x => x && { ...x, isOpen: false })
    const ran = await next(e)
    if (!r || ran.deny !== undefined) return ran

    if (e.tool === 'Bash' && isTestCommand(e.command)) {
      // A backgrounded run has no verdict yet.
      if (ran.isError || !(ran.result as { backgroundTaskId?: string } | undefined)?.backgroundTaskId) seen.tests = !ran.isError
    }
    const path = (e as { file_path?: unknown; notebook_path?: unknown }).file_path ?? (e as { notebook_path?: unknown }).notebook_path
    if (EDITS.has(e.tool) && !ran.isError && typeof path === 'string') {
      files.add(path)
      seen.files = files.size
    }
    return ran
  })

  // An `ask` verdict on a real call means the person (or the mode's decider) was asked.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id) seen.asked = true
    return verdict
  })

  on('turn.complete', async ($, e, next) => {
    const r = await read($, round)
    if (e.agentId !== undefined || !r || r.turnId !== e.turnId) return next(e)
    const isClean = e.reason === 'answer'
    const book = await getBook($)
    const out = settle(book, r.bets, isClean ? seen : null)
    const saved: Book = isClean ? { ...out.book, rates: learn(book.rates, seen) } : out.book
    await $.store.set(BOOK, saved)
    const slip: SideBetSlip = { results: out.results, net: out.net, chips: saved.chips, isVoid: !isClean }
    await openNext($, saved, r.bets.length ? slip : undefined)
    if (r.bets.length) {
      const legs = out.results.map(x => `${MARK[x.outcome]} ${SHORT[x.bet.market]} ${x.bet.label.toUpperCase()}${x.bet.line === undefined ? '' : ` ${x.bet.line}`} ${x.outcome === 'void' ? 'void' : signed(x.delta)}`)
      const head = isClean ? `SETTLED ${signed(out.net)}` : 'CUT SHORT · refunded'
      $.ui.toast(`🎲 ${head} │ ${legs.join(' · ')} │ ${chips(saved.chips)} play chips`, { timeoutMs: 8000 })
    }
    return next(e)
  })

  // The terminal folds a command's row onto one line; draw the /bets frame line by line instead (desktop keeps the code block).
  on('ui.render', { component: 'CommandOutput', props: { command: 'bets' } }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isErrored) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const lines = e.props.text.replace(/^side-bet: /, '').split('\n').filter(l => !l.startsWith('```'))
    return (
      <Box flexDirection="column">
        {lines.map((l, i) => (
          <Text key={String(i)} color={l.includes('✓') ? 'green' : l.includes('✗') ? 'red' : undefined} dimColor={!l.includes('│')}>{l}</Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, round)
    if (e.props.hasSurvey || !r || (!r.isOpen && r.bets.length === 0)) return next(e)
    const el = $.ui.resolve(e)
    // vscode and mobile have the desktop's Box, Text, Button and Svg, so they get the card.
    return e.surface === 'terminal' ? terminalBand($, el as Elements['terminal'], r, e.props) : marketCard($, el as CardElements, r)
  })
}

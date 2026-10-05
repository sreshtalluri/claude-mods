import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'

import type { GrindData, GrindStats } from '../types'
import { CATEGORIES, GAMES } from './games'
import type { Game, Move, ViewProps } from './games/types'
import { dayIndex, emptyData, esc, FONT, forDay, liveStreak, progressOf, saveOf, settle, shareText, statsOf } from './shared'
import type { Progress } from './shared'

const PANE = 'daily-grind'
const data = atom({ plugin: 'daily-grind', key: 'data' } as const, emptyData())

const ACCENT = '#a78bfa'
const CATEGORY_COLOR = { Developer: '#7c3aed', Everyone: '#0d9488', Classics: '#d97706' } as const
const PROGRESS: Record<Progress, { text: string; color: string }> = {
  new: { text: '· not started', color: '#71717a' },
  playing: { text: '◐ in progress', color: '#f59e0b' },
  won: { text: '✓ solved', color: '#22c55e' },
  lost: { text: '✗ failed', color: '#ef4444' },
}
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "Saturday, October 3" for a day index. */
const dateOf = (day: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + day))
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

const today = async ($: EngineInterface) => dayIndex(await $.clock.now())

type Stored = { saves: GrindData['saves']; stats: GrindData['stats'] }

/** What every session has stored for `day`. The store is shared by all open sessions. */
const stored = async ($: EngineInterface, day: number): Promise<Stored> => {
  const t = (await $.store.get('today')) as Pick<GrindData, 'day' | 'saves'> | undefined
  return { saves: t?.day === day ? t.saves : {}, stats: ((await $.store.get('stats')) as GrindData['stats'] | undefined) ?? {} }
}

/** Pulls in progress other sessions made, so this one draws and builds on the latest. */
const load = async ($: EngineInterface) => {
  const day = await today($)
  const s = await stored($, day)
  await update($, data, d => {
    const cur = forDay(d, day)
    return { ...cur, saves: { ...cur.saves, ...s.saves }, stats: { ...cur.stats, ...s.stats } }
  })
}

/** Every change goes through here: state for the drawing; the touched game alone goes to the store, merged over what other sessions wrote. */
const act = async ($: EngineInterface, fn: (d: GrindData) => GrindData, touched?: string) => {
  const day = await today($)
  const next = await update($, data, d => fn(forDay(d, day)))
  if (touched === undefined) return
  // ponytail: read-merge-write isn't atomic; two sessions moving in the same instant can still race on one game.
  const s = await stored($, day)
  await $.store.set('today', { day, saves: { ...s.saves, [touched]: next.saves[touched] } })
  await $.store.set('stats', { ...s.stats, ...(next.stats[touched] ? { [touched]: next.stats[touched] } : {}) })
}

/** A move in game `g`, applied to the latest save. */
const play = ($: EngineInterface, g: Game, move: (save: any) => Move<any>) =>
  act($, d => {
    const m = move(saveOf(g, d))
    return { ...(m.save === undefined ? d : settle(d, g, m.save)), note: m.note ?? '' }
  }, g.id)

const show = ($: EngineInterface, open: string | null) =>
  act($, d => {
    const g = GAMES.find(x => x.id === open)
    // Back from a game lands on that game's tab.
    return { ...d, open, note: '', ...(g ? { tab: g.category === 'Classics' ? ('classics' as const) : ('new' as const) } : {}) }
  })
const showTab = ($: EngineInterface, tab: 'new' | 'classics') => act($, d => ({ ...d, tab }))

const openPane = ($: EngineInterface) =>
  $.ui.open({ id: PANE, title: 'Daily Grind', focus: true, closeOnEscape: true, rows: 32 })

const streakText = (st: GrindStats, day: number) => {
  const n = liveStreak(st, day)
  return n > 0 ? `🔥${n}` : ''
}

/** A rounded badge with the game's initials, tinted by category: the desktop card's icon. */
const badgeSvg = (g: Game) => {
  const initials = g.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const c = CATEGORY_COLOR[g.category]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" ${FONT}><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}99"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="url(#g)"/><text x="24" y="31" text-anchor="middle" font-size="19" font-weight="800" fill="#fff">${esc(initials)}</text></svg>`
}

/** The desktop hub's banner: title, date, today's tally. */
const bannerSvg = (day: number, solved: number, total: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="96" viewBox="0 0 560 96" ${FONT}><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c1d95"/><stop offset="0.6" stop-color="#7c3aed"/><stop offset="1" stop-color="#d97706"/></linearGradient></defs><rect width="560" height="96" rx="16" fill="url(#b)"/><text x="28" y="48" font-size="30" font-weight="800" fill="#fff">☕ Daily Grind</text><text x="30" y="74" font-size="14" fill="#ede9fe">#${day + 1} · ${esc(dateOf(day))} · new puzzles at midnight</text><text x="532" y="52" text-anchor="end" font-size="34" font-weight="800" fill="#fff">${solved}/${total}</text><text x="532" y="74" text-anchor="end" font-size="13" fill="#ede9fe">solved today</text></svg>`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'grind',
      description: "Open today's daily puzzles (or: share, or a game's name)",
      argumentHint: '[share | game]',
    })
    await load($)
    const day = await today($)
    const d = forDay(await read($, data), day)
    const left = GAMES.filter(g => ['new', 'playing'].includes(progressOf(g, d))).length
    if (left > 0 && (await $.store.get('nudged')) !== day) {
      await $.store.set('nudged', day)
      $.ui.toast(`☕ Daily Grind #${day + 1}: ${left} puzzle${left === 1 ? '' : 's'} ready, /grind`, { timeoutMs: 6000 })
    }
    return next(e)
  })

  on('command.run', { command: 'grind' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'share') {
      await load($)
      const d = forDay(await read($, data), await today($))
      const texts = GAMES.map(g => shareText(g, d)).filter(t => t !== null)
      if (texts.length === 0) return { text: 'Nothing finished today yet: /grind to play.' }
      return { text: '```\n' + texts.join('\n\n') + '\n```' }
    }
    const pick = GAMES.find(g => arg && (g.id === arg || g.name.toLowerCase() === arg))
    await load($)
    await show($, pick ? pick.id : null)
    await openPane($)
    return { text: `Daily Grind opened${pick ? ` on ${pick.name}` : ''}. /grind share copies today's results.` }
  })

  // Esc (or the close mark) inside a game goes back to the menu; on the menu it closes the pane.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind !== 'person' || (await read($, data)).open === null) return next(e)
    await show($, null)
    void openPane($)
    return { value: undefined }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const day = await today($)
    const d = forDay(await read($, data), day)
    const width = e.props.bodyColumns
    const isRich = e.surface !== 'terminal'
    const game = GAMES.find(g => g.id === d.open)

    // ---- The menu ----
    if (!game) {
      const solved = GAMES.filter(g => progressOf(g, d) === 'won').length
      // Two tabs: the originals, and the classics (the familiar formats) on their own.
      const tab = d.tab ?? 'new'
      const cats = CATEGORIES.filter(c => (c.name === 'Classics') === (tab === 'classics'))
      const order = cats.flatMap(c => GAMES.filter(g => g.category === c.name))
      const hotkey = (g: Game) => String(order.indexOf(g) + 1)
      const tabs = (
        <Box key="tabs" flexDirection="row" gap={2}>
          <Button key="tab-new" hotkey="n" {...(isRich ? { variant: tab === 'new' ? 'primary' : 'secondary' } : { plain: true })} label={!isRich && tab === 'new' ? '▸ Originals' : 'Originals'} onPress={() => showTab($, 'new')} />
          <Button key="tab-classics" hotkey="c" {...(isRich ? { variant: tab === 'classics' ? 'primary' : 'secondary' } : { plain: true })} label={!isRich && tab === 'classics' ? '▸ Classics' : 'Classics'} onPress={() => showTab($, 'classics')} />
        </Box>
      )
      if (e.surface !== 'terminal') {
        const { Svg } = els as Elements['desktop']
        return (
          <Box flexDirection="column" gap={1}>
            <Svg source={bannerSvg(day, solved, GAMES.length)} alt={`Daily Grind #${day + 1}: ${solved} of ${GAMES.length} solved today`} />
            {tabs}
            {cats.map(c => (
              <Box key={`cat-${c.name}`} flexDirection="column" gap={1}>
                <Text>
                  <Text bold color={CATEGORY_COLOR[c.name]}>{c.name.toUpperCase()}</Text>
                  <Text dimColor>  {c.blurb}</Text>
                </Text>
                {GAMES.filter(g => g.category === c.name).map(g => {
                  const p = progressOf(g, d)
                  const streak = streakText(statsOf(g, d), day)
                  return (
                    <Box key={`card-${g.id}`} flexDirection="row" gap={2} alignItems="center" borderStyle="round" borderColor="#52525b" paddingX={2} paddingY={1} hover={{ borderColor: CATEGORY_COLOR[g.category] }}>
                      <Svg source={badgeSvg(g)} alt="" width={48} height={48} />
                      <Box flexDirection="column" flexGrow={1}>
                        <Text>
                          <Text bold>{g.name}</Text>
                          {streak && <Text>  {streak}</Text>}
                        </Text>
                        <Text dimColor wrap="truncate">{g.tagline}</Text>
                        <Text color={PROGRESS[p].color}>{PROGRESS[p].text}</Text>
                      </Box>
                      <Button key={`game-${g.id}`} hotkey={hotkey(g)} variant={p === 'won' || p === 'lost' ? 'secondary' : 'primary'} label={p === 'new' ? 'Play' : p === 'playing' ? 'Continue' : 'Result'} onPress={() => show($, g.id)} />
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>
        )
      }

      const w = Math.min(width, 78)
      const nameW = Math.max(...GAMES.map(g => g.name.length)) + 6
      const showTagline = w >= 64
      return (
        <Box flexDirection="column" width={w}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text>
              <Text bold color={ACCENT}>☕ Daily Grind</Text>
              <Text dimColor>  #{day + 1} · {dateOf(day)}</Text>
            </Text>
            <Text dimColor>{solved}/{GAMES.length} solved</Text>
          </Box>
          <Box marginTop={1}>{tabs}</Box>
          {cats.map(c => (
            <Box key={`cat-${c.name}`} flexDirection="column" marginTop={1}>
              <Text>
                <Text bold color={CATEGORY_COLOR[c.name]}>{c.name.toUpperCase()}</Text>
                <Text dimColor> {'─'.repeat(Math.max(2, w - c.name.length - 1))}</Text>
              </Text>
              {GAMES.filter(g => g.category === c.name).map(g => {
                const p = progressOf(g, d)
                return (
                  <Box key={`row-${g.id}`} flexDirection="row">
                    <Box width={nameW} flexShrink={0}>
                      <Text> </Text>
                      <Button key={`game-${g.id}`} plain hotkey={hotkey(g)} label={g.name} onPress={() => show($, g.id)} />
                    </Box>
                    {showTagline && (
                      <Box flexGrow={1} flexShrink={1} paddingRight={2}>
                        <Text dimColor wrap="truncate">{g.tagline}</Text>
                      </Box>
                    )}
                    <Box width={14} flexShrink={0}>
                      <Text color={PROGRESS[p].color}>{PROGRESS[p].text}</Text>
                    </Box>
                    <Box width={5} flexShrink={0} justifyContent="flex-end">
                      <Text>{streakText(statsOf(g, d), day)}</Text>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>1-{order.length} or click to play · n/c switch tabs · Esc closes · /grind share</Text>
          </Box>
        </Box>
      )
    }

    // ---- A game ----
    const puzzle = game.puzzle(day)
    const save = saveOf(game, d)
    const status = game.status(puzzle, save)
    const st = statsOf(game, d)
    const board = game.view({
      surface: e.surface,
      els,
      width,
      day,
      puzzle,
      save,
      status,
      play: move => void play($, game, move),
    } as ViewProps<unknown, unknown>)

    const text = shareText(game, d)
    const flat = isRich ? {} : { plain: true as const }
    const share: RenderElement | null = text ? (
      <Box key="share" flexDirection="column" marginTop={1} {...(isRich ? { borderStyle: 'round', borderColor: status === 'won' ? '#22c55e' : '#ef4444', paddingX: 2, paddingY: 1 } : {})}>
        {/* The terminal shows the score line alone: the board is above, and emoji widths vary between terminals. */}
        {(isRich ? text.split('\n') : text.split('\n').slice(0, 4)).map((line, i) => <Text bold={!isRich && i === 0}>{line}</Text>)}
        <Box flexDirection="row" gap={2}>
          <Text dimColor>
            streak {liveStreak(st, day)} · best {st.best} · won {st.won}/{st.played}
          </Text>
          <Button key="copy" {...flat} hotkey="y" label="copy result" onPress={p => void $.ui.copy({ text, surface: p.surface })} />
        </Box>
      </Box>
    ) : null
    const note = d.note ? (
      <Box key="note" marginTop={isRich ? 0 : 1}>
        <Text color="#f59e0b">{d.note}</Text>
      </Box>
    ) : null

    return (
      <Box flexDirection="column" {...(isRich ? { gap: 1 } : { width: Math.min(width, 78) })}>
        <Box flexDirection="row" justifyContent="space-between" marginBottom={isRich ? 0 : 1}>
          <Box flexDirection="row" gap={2}>
            <Button key="back" {...flat} hotkey="q" label={isRich ? '‹ All games' : 'menu'} onPress={() => show($, null)} />
            <Text>
              <Text bold color={ACCENT}>{game.name}</Text>
              <Text color={CATEGORY_COLOR[game.category]}> · {game.category}</Text>
            </Text>
          </Box>
          <Text dimColor>#{day + 1}{streakText(st, day) && ` · ${streakText(st, day)}`}</Text>
        </Box>
        {board}
        {note}
        {share}
      </Box>
    )
  })
}

import { FONT } from '../../shared'
import type { Game } from '../types'
import { guess, isDone, isWon, LEN, LETTERS, meta, puzzle, remaining, score, share, SYMBOLS, TRIES } from './logic'
import type { Letter, State } from './logic'

/** Guesses made, the row being composed, and hard mode (only settable before the first guess). */
export type CodebreakerSave = { guesses: string[]; draft: string; hard: boolean }

const PEG: Record<Letter, string> = { R: '#ef4444', O: '#f97316', T: '#14b8a6', B: '#3b82f6', V: '#8b5cf6', P: '#ec4899' }
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

const stateOf = (code: string, s: CodebreakerSave): State => ({
  day: 0,
  code,
  hard: s.hard,
  rows: s.guesses.map(g => ({ guess: g, ...score(code, g) })),
})

/** Submits `g` (or the draft): a refused guess keeps the draft and says why. */
const submit = (code: string, s: CodebreakerSave, g = s.draft) => {
  const next = guess(stateOf(code, s), g)
  if ('error' in next) return { note: g.length < LEN ? `Pick ${LEN} colors first.` : next.error }
  return { save: { ...s, guesses: next.rows.map(r => r.guess), draft: '' } }
}

/** The board as an SVG: a code cover on top, eight rows of round pegs, each with its 2×2 feedback pins. */
const boardSvg = (st: State, draft: string, done: boolean) => {
  const [R, G, PAD, HEAD] = [15, 8, 14, 52]
  const pinX = PAD + 28 + LEN * (2 * R + G) + 6
  const w = pinX + 40 + PAD
  const rowH = 2 * R + 8
  const h = HEAD + TRIES * rowH + PAD
  const cx = (i: number) => PAD + 28 + R + i * (2 * R + G)
  const peg = (x: number, y: number, c?: string, ghost = false) =>
    c
      ? `<circle cx="${x}" cy="${y}" r="${R}" fill="${PEG[c as Letter]}"/><circle cx="${x - 5}" cy="${y - 5}" r="${R / 3}" fill="#fff" opacity=".28"/>`
      : `<circle cx="${x}" cy="${y}" r="${R - 4}" fill="#0005" stroke="${ghost ? '#a1a1aa' : '#3f3f46'}" stroke-width="2"${ghost ? ' stroke-dasharray="3 3"' : ''}/>`
  const out: string[] = [`<rect width="${w}" height="${h}" rx="16" fill="#27272a"/>`]
  // The code, under a cover until the game ends.
  const cy0 = PAD + R + 2
  if (done) for (let i = 0; i < LEN; i++) out.push(peg(cx(i), cy0, st.code[i]))
  else {
    out.push(`<rect x="${PAD + 28 - 4}" y="${cy0 - R - 4}" width="${LEN * (2 * R + G) - G + 8}" height="${2 * R + 8}" rx="${R + 4}" fill="#52525b"/>`)
    for (let i = 0; i < LEN; i++) out.push(`<text x="${cx(i)}" y="${cy0 + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="#a1a1aa">?</text>`)
  }
  out.push(`<line x1="${PAD}" x2="${w - PAD}" y1="${HEAD - 6}" y2="${HEAD - 6}" stroke="#3f3f46" stroke-width="2"/>`)
  for (let r = 0; r < TRIES; r++) {
    const y = HEAD + r * rowH + rowH / 2
    const row = st.rows[r]
    const isNext = r === st.rows.length && !done
    if (isNext) out.push(`<rect x="${PAD - 4}" y="${y - rowH / 2 + 1}" width="${w - 2 * PAD + 8}" height="${rowH - 2}" rx="10" fill="#3f3f46"/>`)
    out.push(`<text x="${PAD + 10}" y="${y + 5}" text-anchor="middle" font-size="13" fill="#71717a">${r + 1}</text>`)
    const letters = row?.guess ?? (isNext ? draft : '')
    for (let i = 0; i < LEN; i++) out.push(peg(cx(i), y, letters[i], isNext && i === letters.length))
    const pins = row ? [...Array(row.exact).fill('#fafafa'), ...Array(row.near).fill('near')] : []
    for (let i = 0; i < LEN; i++) {
      const [px, py] = [pinX + 8 + (i % 2) * 16, y - 8 + Math.floor(i / 2) * 16]
      const p = pins[i]
      out.push(p === 'near'
        ? `<circle cx="${px}" cy="${py}" r="5" fill="none" stroke="#fafafa" stroke-width="2"/>`
        : `<circle cx="${px}" cy="${py}" r="${p ? 6 : 3}" fill="${p ?? '#52525b'}"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>${out.join('')}</svg>`
}

const swatchSvg = (c: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${c}"/><circle cx="11" cy="11" r="4" fill="#fff" opacity=".3"/></svg>`

export const codebreaker: Game<string, CodebreakerSave> = {
  ...meta,
  puzzle,
  fresh: () => ({ guesses: [], draft: '', hard: false }),
  status: (code, s) => {
    const st = stateOf(code, s)
    return isWon(st) ? 'won' : isDone(st) ? 'lost' : 'playing'
  },
  // The shell already prints "Daily Grind · Codebreaker #n  ": keep only the score and dot rows.
  share: (code, s) => share(stateOf(code, s)).replace(/^Codebreaker #\S+ /, ''),
  view: v => {
    const { Box, Text, Button } = v.els
    const Input = v.surface === 'mobile' ? undefined : v.els.Input
    const code = v.puzzle
    const { draft, hard } = v.save
    const st = stateOf(code, v.save)
    const isPlaying = v.status === 'playing'
    const isRich = v.surface !== 'terminal'
    const left = remaining(st)

    const add = (c: string) => v.play(s => (s.draft.length < LEN ? { save: { ...s, draft: s.draft + c } } : { note: 'Row full: guess it, or ⌫.' }))
    const typed = (text: string) =>
      v.play(s => {
        const t = text.toUpperCase().replace(/[\s,]+/g, '')
        if ([...t].some(c => !LETTERS.includes(c))) return { note: `Colors are ${[...LETTERS].join(' ')}.` }
        const g = s.draft + t
        if (g.length > LEN) return { note: `Only ${LEN} pegs a row.` }
        return g.length === LEN ? submit(code, s, g) : { save: { ...s, draft: g } }
      })
    const edit = (f: (d: string) => string) => () => v.play(s => ({ save: { ...s, draft: f(s.draft) } }))
    const flat = isRich ? {} : { plain: true as const }

    const palette = [...LETTERS].map(c =>
      isRich ? (
        <Box key={`pal-${c}`} flexDirection="column" alignItems="center" gap={1}>
          {v.surface !== 'terminal' && <v.els.Svg source={swatchSvg(PEG[c as Letter])} alt={SYMBOLS[c as Letter]} width={32} height={32} />}
          <Button key={`peg-${c}`} label={cap(SYMBOLS[c as Letter])} onPress={() => add(c)} />
        </Box>
      ) : (
        <Box backgroundColor={PEG[c as Letter]}>
          <Button key={`peg-${c}`} plain label={` ${c} `} onPress={() => add(c)} />
        </Box>
      ),
    )
    const controls = (
      <Box key="controls" flexDirection="row" gap={isRich ? 1 : 2} alignItems="center">
        <Button key="undo" {...flat} label="⌫" onPress={edit(d => d.slice(0, -1))} />
        <Button key="clear" {...flat} label="clear" onPress={edit(() => '')} />
        <Button key="guess" {...flat} variant={draft.length === LEN ? 'primary' : undefined} label={`guess ${draft.length}/${LEN}`} onPress={() => v.play(s => submit(code, s))} />
      </Box>
    )
    // Always drawn while playing: removing a focusable mid-game moves the focus off the Input.
    const hardToggle = isPlaying && (
      <Button key="hard" {...flat} dimColor={!isRich} label={`hard mode: ${hard ? 'on' : 'off'}${st.rows.length ? ' (locked)' : ''}`}
        onPress={() => v.play(s => (s.guesses.length ? { note: 'Hard mode is set before the first guess.' } : { save: { ...s, hard: !s.hard } }))} />
    )
    const stat = (
      <Box key="stat">
        <Text>
          <Text dimColor>codes still possible: </Text>
          <Text bold color={left === 1 ? '#22c55e' : undefined}>{left}</Text>
          {hard && <Text color="#f59e0b">  hard</Text>}
        </Text>
      </Box>
    )
    const field = isPlaying && Input && (
      <Input key="code" autoFocus label="colors" placeholder={`e.g. ROTB (${LETTERS}), Enter`} submitLabel="guess" value="" onSubmit={typed} />
    )
    const outcome = !isPlaying && (
      <Box key="outcome">
        <Text>
          {v.status === 'won' ? `Cracked in ${st.rows.length}.` : 'Out of guesses.'} The code was{' '}
          {[...code].map(c => <Text bold color={PEG[c as Letter]}>{c}</Text>)}
          <Text dimColor> ({[...code].map(c => SYMBOLS[c as Letter]).join(', ')})</Text>
        </Text>
      </Box>
    )

    if (isRich) {
      const { Svg } = v.els
      return (
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Text dimColor>Four pegs, six colors, repeats allowed. ● right color and spot · ○ right color, wrong spot.</Text>
          <Svg source={boardSvg(st, draft, !isPlaying)} alt={`Codebreaker board: ${st.rows.length} of ${TRIES} guesses${isPlaying ? '' : `, code ${code}`}`} />
          {stat}
          {isPlaying && <Box key="palette" flexDirection="row" gap={2} flexWrap="wrap" justifyContent="center">{palette}</Box>}
          {isPlaying && controls}
          {hardToggle}
          {field}
          {outcome}
        </Box>
      )
    }

    // Terminal: each peg a 3-cell colored block with its letter, feedback in an aligned column.
    const block = (c: string | undefined, bg: string, text: string) =>
      c ? <Text backgroundColor={PEG[c as Letter]} color="#ffffff" bold>{` ${c} `}</Text> : <Text backgroundColor={bg} color="#71717a">{text}</Text>
    const pegs = (letters: string, bg: string, text = ' · ') => (
      <Box flexDirection="row" gap={1}>{Array.from({ length: LEN }, (_, i) => block(letters[i], bg, text))}</Box>
    )
    const dots = (r?: { exact: number; near: number }) =>
      r ? (
        <Text>
          <Text color="#fafafa">{'●'.repeat(r.exact)}</Text>
          <Text color="#a1a1aa">{'○'.repeat(r.near)}</Text>
          <Text color="#52525b">{'·'.repeat(LEN - r.exact - r.near)}</Text>
        </Text>
      ) : <Text> </Text>
    const rows = Array.from({ length: TRIES }, (_, r) => {
      const row = st.rows[r]
      const isNext = r === st.rows.length && isPlaying
      return (
        <Box key={`row-${r}`} flexDirection="row" gap={2}>
          <Text color={isNext ? '#f59e0b' : '#52525b'}>{isNext ? '›' : String(r + 1)}</Text>
          {pegs(row?.guess ?? (isNext ? draft : ''), isNext ? '#3f3f46' : '#1f1f23', isNext ? ' _ ' : ' · ')}
          {dots(row)}
        </Box>
      )
    })
    const secret = (
      <Box key="secret" flexDirection="row" gap={2}>
        <Text> </Text>
        {isPlaying ? pegs('', '#52525b', ' ? ') : pegs(code, '')}
        <Text dimColor>code</Text>
      </Box>
    )
    const board = (
      <Box flexDirection="column" flexShrink={0}>
        {secret}
        <Text color="#3f3f46">{'─'.repeat(25)}</Text>
        {rows}
      </Box>
    )
    const side = (
      <Box flexDirection="column" gap={1} flexShrink={1}>
        <Box flexDirection="column">
          <Text dimColor>4 pegs, 6 colors, repeats allowed.</Text>
          <Text dimColor>● right color, right spot  ○ wrong spot</Text>
        </Box>
        {isPlaying && <Box key="palette" flexDirection="row" gap={1}>{palette}</Box>}
        {isPlaying && controls}
        {stat}
        {hardToggle}
      </Box>
    )
    const isWide = v.width >= 60
    return (
      <Box flexDirection="column">
        <Box flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 4 : 1}>
          {board}
          {side}
        </Box>
        {(field || outcome) && <Box marginTop={1}>{field || outcome}</Box>}
      </Box>
    )
  },
}

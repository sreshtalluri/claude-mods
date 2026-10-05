import { esc, FONT } from '../../shared'
import type { Game } from '../types'
import { clueText, judge, meta, move, puzzle, shareText, SOLVED_WITHIN } from './logic'
import type { Clue, Puzzle } from './logic'

/** order: the queue as arranged; history: violated clue indexes per submit; sel: selected slot. */
export type InstallSave = { order: string[]; history: number[][]; sel: number | null }

// Package hotkeys skip the shell's q/y and this view's j/k/s.
const KEYS = 'abcdefgh'
const [OK, BAD, DIM, ACC] = ['#98c379', '#e06c75', '#7f848e', '#61afef']

/** A stable fake semver per package name, for the npm vibe. */
const ver = (name: string) => {
  const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  return `${h % 4}.${(h >> 3) % 12}.${(h >> 7) % 9}`
}

const isWon = (s: InstallSave) => s.history.length > 0 && s.history[s.history.length - 1]!.length === 0

/** Two-package edges a clue draws in the diagram: [from, to] in install order. */
const edges = (c: Clue): [string, string][] =>
  c.kind === 'needs' ? [[c.b, c.a]]
    : c.kind === 'between' ? [[c.lo, c.a], [c.a, c.hi]]
    : c.kind === 'adjacent' || c.kind === 'gap' ? [[c.a, c.b]]
    : []

/** The queue as chips in a row, with an arc per two-package clue, colored by the last submit. */
const diagramSvg = (p: Puzzle, order: string[], marks: (boolean | null)[]) => {
  const [W, H, G, top] = [96, 30, 12, 64]
  const w = order.length * (W + G) - G
  const cx = (x: string) => order.indexOf(x) * (W + G) + W / 2
  const arcs = p.clues.flatMap((c, i) =>
    edges(c).map(([a, b]) => {
      const [x1, x2] = [cx(a), cx(b)]
      const lift = Math.min(top - 6, 14 + Math.abs(x2 - x1) / 7)
      const color = marks[i] === null ? '#8888' : marks[i] ? OK : BAD
      const arrow = c.kind === 'needs' || c.kind === 'between' ? `<path d="M${x2} ${top} l-4 -7 h8 z" fill="${color}"/>` : ''
      return `<path d="M${x1} ${top} C${x1} ${top - lift} ${x2} ${top - lift} ${x2} ${top}" stroke="${color}" stroke-width="2" fill="none"${c.kind === 'gap' ? ' stroke-dasharray="4 3"' : ''}/>${arrow}`
    }),
  )
  const chips = order.map((name, i) => {
    const x = i * (W + G)
    return `<rect x="${x}" y="${top + 2}" width="${W}" height="${H}" rx="6" fill="#8882" stroke="#8886"/><text x="${x + W / 2}" y="${top + 2 + H / 2 + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">${esc(name)}</text><text x="${x + 6}" y="${top + H + 16}" font-size="10" fill="#888">${i + 1}</text>`
  })
  const h = top + H + 20
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" color="#999" ${FONT}>${chips.join('')}${arcs.join('')}</svg>`
}

export const installorder: Game<Puzzle, InstallSave> = {
  ...meta,
  puzzle,
  fresh: p => ({ order: [...p.packages], history: [], sel: null }),
  status: (_, s) => (isWon(s) ? 'won' : 'playing'),
  share: (p, s) => {
    const [head, ...rows] = shareText(p, s.history).split('\n')
    return [head!.slice(head!.indexOf('📦')), ...rows].join('\n')
  },
  view: v => {
    const { Box, Text, Button } = v.els
    const p = v.puzzle
    const { order, history, sel } = v.save
    const playing = v.status === 'playing'
    const last = history[history.length - 1]
    const marks = p.clues.map((_, i) => (last ? !last.includes(i) : null))
    const tries = history.length

    const select = (i: number) => v.play(s => ({ save: { ...s, sel: s.sel === i ? null : i } }))
    const shift = (d: -1 | 1) =>
      v.play(s => {
        if (s.sel === null) return { note: 'Pick a package first.' }
        const to = s.sel + d
        if (to < 0 || to >= s.order.length) return {}
        return { save: { ...s, order: move(s.order, s.sel, to), sel: to } }
      })
    const submit = () =>
      v.play(s => {
        const { solved, violated } = judge(p, s.order)
        const n = s.history.length + 1
        const note = solved
          ? `added ${s.order.length} packages in ${n} ${n === 1 ? 'try' : 'tries'}${n <= SOLVED_WITHIN ? '' : ` (par is ${SOLVED_WITHIN})`}`
          : `npm ERR! ERESOLVE: ${violated.length} of ${p.clues.length} constraints broken`
        return { save: { ...s, history: [...s.history, violated], sel: null }, note }
      })

    const isRich = v.surface !== 'terminal'
    const flat = isRich ? {} : { plain: true as const }
    const triesText = (
      <Text key="tries">
        <Text dimColor>tries </Text>
        <Text bold color={tries > SOLVED_WITHIN ? BAD : undefined}>{tries}</Text>
        <Text dimColor>{` · par ${SOLVED_WITHIN}`}</Text>
      </Text>
    )
    const controls = playing && [
      <Button key="up" {...flat} hotkey="k" label="▲ up" onPress={() => shift(-1)} />,
      <Button key="down" {...flat} hotkey="j" label="▼ down" onPress={() => shift(1)} />,
      <Button key="submit" {...flat} variant="primary" hotkey="s" label="npm install" onPress={submit} />,
    ]
    const clueRow = (c: Clue, i: number) => {
      const m = marks[i]
      return (
        <Box key={`clue-${i}`} flexDirection="row">
          <Text color={m === null ? DIM : m ? OK : BAD}>{m === null ? '· ' : m ? '✓ ' : '✗ '}</Text>
          <Text color={m === false ? BAD : undefined} wrap="wrap">{clueText(c)}</Text>
        </Box>
      )
    }

    if (v.surface !== 'terminal') {
      const { Svg } = v.els
      const card = { flexDirection: 'column' as const, borderStyle: 'round' as const, borderColor: '#57534e', paddingX: 2, paddingY: 1, gap: 1 }
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>Order the queue so every constraint holds. Pick a package, move it, then install.</Text>
          <Box flexDirection="row" flexWrap="wrap" gap={2}>
            <Box key="queue" {...card} flexGrow={1}>
              <Text bold>$ npm install</Text>
              {order.map((name, i) => (
                <Box key={`slot-${i}`} flexDirection="row" gap={1} alignItems="center">
                  <Text dimColor>{`${i + 1}.`}</Text>
                  <Button key={`pkg-${name}`} variant={sel === i ? 'primary' : 'secondary'} label={`+ ${name}@${ver(name)}`} onPress={() => playing && select(i)} />
                </Box>
              ))}
              {playing && <Box flexDirection="row" gap={1}>{controls}</Box>}
              {triesText}
            </Box>
            <Box key="clues" {...card} flexGrow={1}>
              <Text bold>package.json constraints</Text>
              {p.clues.map(clueRow)}
            </Box>
          </Box>
          <Svg source={diagramSvg(p, order, marks)} alt={`Install queue: ${order.join(', ')}`} />
        </Box>
      )
    }

    // Terminal: queue left, clues right; stacked when narrow.
    const isWide = v.width >= 76
    const queue = (
      <Box key="queue" flexDirection="column" flexShrink={0}>
        <Text color={ACC} bold>$ npm install</Text>
        {order.map((name, i) => {
          const isSel = sel === i
          const label = `+ ${name}@${ver(name)}`
          return (
            <Box key={`slot-${i}`} flexDirection="row">
              <Text dimColor>{`${String(i + 1).padStart(2)} `}</Text>
              {playing ? (
                <Box {...(isSel ? { backgroundColor: '#3e4451' } : {})}>
                  <Button key={`pkg-${name}`} plain hotkey={KEYS[order.indexOf(name)]} label={isSel ? `${label} ◂` : label} onPress={() => select(i)} />
                </Box>
              ) : (
                <Text color={OK}>{label}</Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
    const clues = (
      <Box key="clues" flexDirection="column" flexShrink={1} flexGrow={1}>
        <Text dimColor bold>constraints</Text>
        {p.clues.map(clueRow)}
      </Box>
    )
    return (
      <Box flexDirection="column">
        <Box flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 4 : 1}>
          {queue}
          {clues}
        </Box>
        <Box key="controls" flexDirection="row" gap={3} marginTop={1}>
          {controls}
          {triesText}
        </Box>
      </Box>
    )
  },
}

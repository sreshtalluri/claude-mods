import { esc, FONT } from '../../shared'
import type { Game } from '../types'
import { hint, isDone, marks, meta, moves, puzzle, shareText, step, undo } from './logic'
import type { LadderPuzzle, LadderState, Mark } from './logic'

export type LadderSave = { path: string[] }

const C = { start: '#2563eb', step: '#3f3f46', changed: '#d97706', target: '#16a34a', ghost: '#27272a', rail: '#a16207' }
const MARK_COLOR: Record<Mark, string> = { '▲': '#4ade80', '■': '#a1a1aa', '▼': '#f87171' }

/** One rung of the drawing: its word (blank for the next slot), tile colors, and a side label. */
type Rung = { key: string; word: string; fills: string[]; label: string; mark?: Mark; ghost?: boolean }

const changedAt = (a: string, b: string) => [...b].findIndex((c, i) => c !== a[i])

/** Start on top, the player's rungs, then (unsolved) a blank slot, a gap marker and the target. */
const rungsOf = (st: LadderState): Rung[] => {
  const ms = marks(st)
  const done = isDone(st)
  const rungs: Rung[] = st.path.map((w, i) => {
    const at = i ? changedAt(st.path[i - 1]!, w) : -1
    const isTarget = done && i === st.path.length - 1
    const base = i === 0 ? C.start : isTarget ? C.target : C.step
    return { key: `rung-${i}`, word: w, fills: [...w].map((_, j) => (j === at ? C.changed : base)), label: i === 0 ? 'start' : `${i}`, mark: ms[i - 1] }
  })
  if (done) return rungs
  const cur = st.path[st.path.length - 1]!
  return [
    ...rungs,
    { key: 'rung-next', word: '    ', fills: Array(4).fill(C.ghost), label: 'next', ghost: true },
    // Target letters already in place glow green; the rest wait in gray.
    { key: 'rung-target', word: st.target, fills: [...st.target].map((c, j) => (cur[j] === c ? C.target : C.step)), label: 'target' },
  ]
}

const ladderSvg = (rungs: Rung[], done: boolean) => {
  const [T, G, PAD, RH] = [46, 8, 26, 62]
  const inner = 4 * T + 3 * G
  const w = inner + 2 * PAD + 70
  const h = rungs.length * RH + 20
  const [l, r] = [PAD / 2, PAD + inner + PAD / 2]
  const parts = [
    `<rect x="${l - 5}" y="0" width="10" height="${h}" rx="5" fill="${C.rail}"/>`,
    `<rect x="${r - 5}" y="0" width="10" height="${h}" rx="5" fill="${C.rail}"/>`,
  ]
  rungs.forEach((g, i) => {
    const y = 10 + i * RH
    const gap = !done && g.key === 'rung-target'
    parts.push(`<rect x="${l}" y="${y + T + 4}" width="${r - l}" height="6" rx="3" fill="${C.rail}" opacity="0.8"/>`)
    if (gap) parts.push(`<text x="${(l + r) / 2}" y="${y - 2}" text-anchor="middle" font-size="14" fill="#a1a1aa">⋮</text>`)
    ;[...g.word].forEach((ch, j) => {
      const x = PAD + j * (T + G)
      parts.push(
        g.ghost
          ? `<rect x="${x + 1}" y="${y + 1}" width="${T - 2}" height="${T - 2}" rx="8" fill="#8881" stroke="#8886" stroke-width="2" stroke-dasharray="5 4"/>`
          : `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="8" fill="${g.fills[j]}"/><text x="${x + T / 2}" y="${y + T / 2 + 8}" text-anchor="middle" font-size="24" font-weight="700" fill="#fff">${esc(ch.toUpperCase())}</text>`,
      )
    })
    const lx = r + 14
    parts.push(`<text x="${lx}" y="${y + T / 2 + 5}" font-size="13" fill="${g.mark ? MARK_COLOR[g.mark] : '#a1a1aa'}">${esc(g.mark ? `${g.mark} ${g.label}` : g.label)}</text>`)
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>${parts.join('')}</svg>`
}

export const ladder: Game<LadderPuzzle, LadderSave> = {
  ...meta,
  puzzle,
  fresh: p => ({ path: [p.start] }),
  status: (p, s) => (isDone({ ...p, ...s }) ? 'won' : 'playing'),
  share: (p, s) => shareText({ ...p, ...s }).replace(/^Ladder #\d+ /, ''),
  view: v => {
    const { Box, Text, Button } = v.els
    const Input = v.surface === 'mobile' ? undefined : v.els.Input
    const p = v.puzzle
    const st: LadderState = { ...p, ...v.save }
    const playing = v.status === 'playing'
    const rungs = rungsOf(st)
    const n = moves(st)

    const submit = (value: string) =>
      v.play(s => {
        const r = step({ ...p, ...s }, value)
        return 'error' in r ? { note: r.error } : { save: { path: r.path } }
      })
    const takeBack = () => v.play(s => ({ save: { path: undo({ ...p, ...s }).path } }))
    const askHint = () =>
      v.play(s => {
        const h = hint({ ...p, ...s })
        return { note: h ? `Try ${h.toUpperCase()}.` : 'No route from here: undo a rung.' }
      })

    const isRich = v.surface !== 'terminal'
    const btn = isRich ? {} : { plain: true as const }
    const controls = playing && (
      <Box key="controls" flexDirection="row" gap={2}>
        <Button key="undo" {...btn} label={isRich ? 'Undo' : '[undo]'} onPress={takeBack} />
        <Button key="hint" {...btn} label={isRich ? 'Hint' : '[hint]'} onPress={askHint} />
      </Box>
    )
    const field = !playing ? null : Input ? (
      <Input key="word" autoFocus label="next rung" placeholder="four letters, Enter" submitLabel="climb" value="" onSubmit={submit} />
    ) : (
      <Text dimColor>Ladder needs a keyboard: play it in the terminal or desktop app.</Text>
    )
    const over = n - p.par
    const score = (
      <Box key="score"><Text>
        <Text bold>{p.start.toUpperCase()}</Text>
        <Text dimColor>{' → '}</Text>
        <Text bold>{p.target.toUpperCase()}</Text>
        <Text dimColor>{`  ·  ${n} ${n === 1 ? 'move' : 'moves'}  ·  par ${p.par}`}</Text>
        {!playing && <Text color={over === 0 ? '#4ade80' : '#fbbf24'}>{over === 0 ? '  ⛳ on par' : `  +${over}`}</Text>}
      </Text></Box>
    )

    if (isRich) {
      const { Svg } = v.els
      return (
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Box flexDirection="column" alignItems="center" gap={1} borderStyle="round" borderColor="#57534e" paddingX={2} paddingY={1}>
            {score}
            <Svg source={ladderSvg(rungs, !playing)} alt={`Ladder from ${p.start} to ${p.target}: ${st.path.join(', ')} (${n} of par ${p.par})`} />
            <Text dimColor>Change one letter per rung; every rung must be a word.</Text>
          </Box>
          {field}
          {controls}
        </Box>
      )
    }

    const rail = <Text color={C.rail}>┃</Text>
    const ladderRows = rungs.map(g => (
      <Box key={g.key} flexDirection="row">
        {rail}
        <Text> </Text>
        {[...g.word].map((ch, j) =>
          g.ghost ? (
            <Text backgroundColor="#34343a" color="#71717a">{' _ '}</Text>
          ) : (
            <Text backgroundColor={g.fills[j]} color="#ffffff" bold>{` ${ch.toUpperCase()} `}</Text>
          ),
        ).flatMap((t, j) => (j ? [<Text> </Text>, t] : [t]))}
        <Text> </Text>
        {rail}
        <Text color={g.mark ? MARK_COLOR[g.mark] : undefined} dimColor={!g.mark}>{` ${g.mark ? `${g.mark} ` : ''}${g.label}`}</Text>
      </Box>
    ))
    if (playing) ladderRows.splice(rungs.length - 1, 0, <Box key="gap" flexDirection="row">{rail}<Text dimColor>{'        ⋮        '}</Text>{rail}</Box>)
    return (
      <Box flexDirection="column">
        {score}
        <Box flexDirection="column" marginTop={1}>{ladderRows}</Box>
        <Text dimColor>▲ closer  ■ same  ▼ further · change one letter per rung</Text>
        {field && <Box marginTop={1}>{field}</Box>}
        {controls && <Box marginTop={field ? 0 : 1}>{controls}</Box>}
      </Box>
    )
  },
}

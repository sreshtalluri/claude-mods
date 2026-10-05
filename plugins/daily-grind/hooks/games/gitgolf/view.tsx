import { esc, FONT } from '../../shared'
import type { Game } from '../types'
import { current, format, fresh, meta, move, moves, puzzle, reachable, render, share, status, undo } from './logic'
import type { Puzzle, Repo, Save } from './logic'

const PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7', '#06b6d4', '#ef4444']
const CHEATS = [
  'commit · branch <name> · checkout <name> · merge <name>',
  'rebase <name> · cherry-pick <ref> · reset <ref>   (ref: main, C2, HEAD~1)',
]

const byMain = (a: string, b: string) => Number(b === 'main') - Number(a === 'main') || a.localeCompare(b)

/** One color per branch name, shared by both graphs so `feature` looks the same in each. */
const colorsFor = (p: Puzzle): Record<string, string> =>
  Object.fromEntries(
    [...new Set([...Object.keys(p.start.branches), ...Object.keys(p.target.branches)])].sort(byMain).map((b, i) => [b, PALETTE[i % PALETTE.length]!]),
  )

/** render() lines with `main*` spelled git's way: `HEAD → main`. */
const lines = (repo: Repo) => render(repo).map(l => l.replace(/([\w-]+)\*/, 'HEAD → $1'))

// ---- Desktop: the graph as an SVG ----

const [DX, DY, R, PAD] = [58, 54, 13, 22]

function graphSvg(repo: Repo, colors: Record<string, string>): string {
  const live = [...reachable(repo)]
  const depth = new Map<string, number>()
  const d = (c: string): number => depth.get(c) ?? (depth.set(c, Math.max(-1, ...repo.commits[c]!.map(d)) + 1), depth.get(c)!)
  live.forEach(d)

  // Lanes along first parents, branches first (main on top), as render() does.
  const lane = new Map<string, number>()
  const laneColor: string[] = []
  const names = Object.keys(repo.branches).sort(byMain)
  const claim = (tip: string, color: string) => {
    let n = 0
    for (let c: string | undefined = tip; c !== undefined && !lane.has(c); c = repo.commits[c]?.[0], n++) lane.set(c, laneColor.length)
    if (n) laneColor.push(color)
  }
  for (const b of names) claim(repo.branches[b]!, colors[b] ?? '#8a8a8a')
  for (const c of live.sort((a, b) => d(b) - d(a))) claim(c, '#8a8a8a')

  const at = (c: string) => [PAD + d(c) * DX, PAD + 14 + lane.get(c)! * DY] as const
  const edges = live.flatMap(c =>
    repo.commits[c]!.map(p => {
      const [[x1, y1], [x2, y2]] = [at(p), at(c)]
      const mid = x1 + DX / 2
      const path = y1 === y2 ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`
      return `<path d="${path}" fill="none" stroke="${laneColor[lane.get(c)!]}" stroke-width="3" stroke-opacity="0.75"/>`
    }),
  )
  const nodes = live.map(c => {
    const [x, y] = at(c)
    const isHead = repo.branches[repo.head] === c
    const ring = isHead ? `<circle cx="${x}" cy="${y}" r="${R + 4}" fill="none" stroke="currentColor" stroke-width="2" opacity="0.6"/>` : ''
    return `${ring}<circle cx="${x}" cy="${y}" r="${R}" fill="${laneColor[lane.get(c)!]}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${esc(c)}</text>`
  })

  // Branch pills: right of a lane's last commit, above one that has a child on its lane.
  let right = 0
  const byTip = new Map<string, string[]>()
  for (const b of names) byTip.set(repo.branches[b]!, [...(byTip.get(repo.branches[b]!) ?? []), b])
  const pills = [...byTip].flatMap(([c, bs]) => {
    const [cx, cy] = at(c)
    const hasNext = live.some(k => repo.commits[k]![0] === c && lane.get(k) === lane.get(c))
    let x = hasNext ? cx - R : cx + R + 8
    const y = hasNext ? cy - R - 22 : cy - 10
    return bs.map(b => {
      const text = b === repo.head ? `HEAD → ${b}` : b
      const w = text.length * 7 + 14
      const out = `<rect x="${x}" y="${y}" width="${w}" height="20" rx="10" fill="${colors[b]}"/><text x="${x + w / 2}" y="${y + 14}" text-anchor="middle" font-size="12" font-weight="${b === repo.head ? 700 : 500}" fill="#fff">${esc(text)}</text>`
      x += w + 4
      right = Math.max(right, x)
      return out
    })
  })
  const w = Math.max(right, ...live.map(c => at(c)[0] + R)) + PAD
  const h = PAD + 14 + (laneColor.length - 1) * DY + R + PAD
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>${edges.join('')}${nodes.join('')}${pills.join('')}</svg>`
}

export const gitgolf: Game<Puzzle, Save> = {
  ...meta,
  tagline: 'Match the commit graph, under par',
  puzzle,
  fresh,
  status,
  share,
  view: v => {
    const { Box, Text, Button } = v.els
    const Input = v.surface === 'mobile' ? undefined : v.els.Input
    const p = v.puzzle
    const repo = current(p, v.save)
    const colors = colorsFor(p)
    const strokes = v.save.moves.length
    const isPlaying = v.status === 'playing'
    const isRich = v.surface !== 'terminal'
    const run = (text: string) => v.play(s => (text.trim() ? move(p, s, text) : { note: 'type a git command, e.g. commit' }))

    const other = Object.keys(repo.branches).find(b => b !== repo.head)
    const hint = other ? `e.g. checkout ${other}` : 'e.g. commit'
    const field = isPlaying && Input && (
      <Input key="cmd" autoFocus label="git" placeholder={hint} submitLabel="run" value="" onSubmit={run} />
    )
    const flat = isRich ? {} : { plain: true as const }
    const controls = isPlaying && (
      <Box key="controls" flexDirection="row" gap={2}>
        <Button key="undo" {...flat} label={isRich ? 'Undo' : '↶ undo'} onPress={() => v.play(s => ({ save: undo(s) }))} />
        <Button key="reset" {...flat} label={isRich ? 'Start over' : '⟲ reset'} onPress={() => v.play(() => ({ save: fresh() }))} />
      </Box>
    )
    const over = strokes - p.par
    const score = (
      <Box key="score"><Text>
        <Text bold>{strokes}</Text>
        <Text dimColor>{` stroke${strokes === 1 ? '' : 's'} · par `}</Text>
        <Text bold>{p.par}</Text>
        {over > 0 && <Text color="#f87171">{`  +${over}`}</Text>}
      </Text></Box>
    )
    const log = strokes > 0 && <Text key="log" dimColor wrap="truncate-start">{'$ ' + v.save.moves.join(' → ')}</Text>
    const cheats = isPlaying && <Box key="cheats" flexDirection="column">{CHEATS.map(c => <Text dimColor>{c}</Text>)}</Box>

    if (isRich) {
      const { Svg } = v.els
      const card = (title: string, r: Repo, k: string) => (
        <Box key={k} flexDirection="column" borderStyle="round" borderColor={k === 'target' && !isPlaying ? '#22c55e' : '#57534e'} paddingX={1}>
          <Text bold dimColor={k !== 'target'}>{title}</Text>
          <Svg source={graphSvg(r, colors)} alt={`${title}: ${render(r).join('; ')}`} />
        </Box>
      )
      // Mobile has no text field: offer every command worth trying as a button.
      const pad = isPlaying && !Input && (
        <Box key="pad" flexDirection="row" flexWrap="wrap" gap={1}>
          {moves(repo, p.target).map(c => (
            <Button key={`do-${format(c)}`} label={format(c)} onPress={() => run(format(c))} />
          ))}
        </Box>
      )
      return (
        <Box flexDirection="column" gap={1}>
          <Text><Text bold>{p.title}</Text><Text dimColor>  ·  make your repo match the target</Text></Text>
          <Box flexDirection="row" flexWrap="wrap" gap={2}>
            {card(isPlaying ? 'Your repo' : 'Holed out', repo, 'now')}
            {card('Target', p.target, 'target')}
          </Box>
          {score}
          {log}
          {field}
          {pad}
          {controls}
          {cheats}
        </Box>
      )
    }

    // Terminal: the ASCII graphs, branch names in their colors, HEAD spelled out.
    const graph = (title: string, r: Repo, k: string) => {
      const ls = lines(r)
      return (
        <Box key={k} flexDirection="column" flexShrink={0}>
          <Text bold dimColor={k !== 'target'}>{title}</Text>
          {ls.map((l, i) => (
            <Text key={`${k}-${i}`}>
              {l.split(/(\([^)]*\))/).map((part, j) =>
                j % 2 === 0 ? (
                  part.split(/(C\d+'*)/).map((s, n) => (n % 2 ? <Text>{s}</Text> : <Text dimColor>{s}</Text>))
                ) : (
                  <Text>
                    <Text dimColor>(</Text>
                    {part.slice(1, -1).split(', ').map((b, n) => {
                      const name = b.replace('HEAD → ', '')
                      return (
                        <Text>
                          {n > 0 && <Text dimColor>, </Text>}
                          {name !== b && <Text><Text bold>HEAD</Text><Text dimColor> → </Text></Text>}
                          <Text color={colors[name]} bold={name !== b}>{name}</Text>
                        </Text>
                      )
                    })}
                    <Text dimColor>)</Text>
                  </Text>
                ),
              )}
            </Text>
          ))}
        </Box>
      )
    }
    const width = (r: Repo) => Math.max(8, ...lines(r).map(l => l.length))
    const isWide = width(repo) + width(p.target) + 6 <= v.width
    return (
      <Box flexDirection="column">
        <Text><Text bold>{p.title}</Text><Text dimColor>  make your repo match the target</Text></Text>
        <Box flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 6 : 1} marginTop={1}>
          {graph(isPlaying ? 'your repo' : 'holed out', repo, 'now')}
          {graph('target', p.target, 'target')}
        </Box>
        <Box flexDirection="row" gap={3} marginTop={1}>
          {score}
          {controls}
        </Box>
        {log}
        {field && <Box marginTop={1}>{field}</Box>}
        {cheats && <Box marginTop={1}>{cheats}</Box>}
      </Box>
    )
  },
}

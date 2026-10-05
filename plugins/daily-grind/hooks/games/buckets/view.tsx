import type { Game } from '../types'
import { bucketsFor, bucketsProgress, bucketsShare, GROUP_MARK, MISTAKES, pick, submit } from './logic'
import type { Buckets, BucketsSave } from './logic'

const GROUP_BG = ['#e5c07b', '#61afef', '#98c379', '#c678dd']
const HOTKEYS = 'abcdefghijklmnop'

export const buckets: Game<Buckets, BucketsSave> = {
  id: 'buckets',
  name: 'Buckets',
  category: 'Classics',
  tagline: 'Sort 16 dev terms into four groups',
  puzzle: bucketsFor,
  fresh: () => ({ tries: [], picked: [] }),
  status: (b, s) => bucketsProgress(b, s.tries).status,
  share: bucketsShare,
  view: v => {
    const { Box, Text, Button } = v.els
    const b = v.puzzle
    const { solved, mistakes } = bucketsProgress(b, v.save.tries)
    const shown = v.status === 'lost' ? [...solved, ...[0, 1, 2, 3].filter(i => !solved.includes(i))] : solved
    const left = b.terms.filter(t => !shown.some(i => b.groups[i]!.terms.includes(t)))
    const picked = v.save.picked
    const toggle = (t: string) => v.play(s => ({ save: pick(s, t) }))
    const misses = (
      <Text>
        <Text dimColor>misses </Text>
        <Text color="#e06c75">{'●'.repeat(MISTAKES - mistakes)}</Text>
        <Text dimColor>{'○'.repeat(mistakes)}</Text>
      </Text>
    )
    const flat = v.surface === 'terminal' ? { plain: true as const } : {}
    const controls = v.status === 'playing' && [
      <Button key="submit" variant="primary" {...flat} hotkey="s" label={`submit ${picked.length}/4`} onPress={() => v.play(s => submit(b, s))} />,
      <Button key="clear" {...flat} hotkey="x" label="clear" onPress={() => v.play(s => ({ save: { ...s, picked: [] } }))} />,
    ]

    if (v.surface !== 'terminal') {
      return (
        <Box flexDirection="column" gap={1}>
          {shown.map(i => (
            <Box key={`solved-${i}`} flexDirection="column" alignItems="center" backgroundColor={GROUP_BG[i]} paddingY={1} borderStyle="round" borderColor={GROUP_BG[i]}>
              <Text bold color="#1f2328">{b.groups[i]!.name}</Text>
              <Text color="#1f2328">{b.groups[i]!.terms.join(' · ')}</Text>
            </Box>
          ))}
          {Array.from({ length: Math.ceil(left.length / 4) }, (_, r) => (
            <Box key={`terms-${r}`} flexDirection="row" gap={1}>
              {left.slice(r * 4, r * 4 + 4).map(t => (
                <Box width="25%" flexGrow={1} justifyContent="center">
                  <Button key={`term-${t}`} variant={picked.includes(t) ? 'primary' : 'secondary'} label={t} onPress={() => toggle(t)} />
                </Box>
              ))}
            </Box>
          ))}
          {v.status === 'playing' && (
            <Box key="controls" flexDirection="row" gap={2} alignItems="center" justifyContent="center">
              {controls}
              {misses}
            </Box>
          )}
        </Box>
      )
    }

    const cols = v.width >= 72 ? 4 : 2
    const colWidth = Math.min(22, Math.floor(v.width / cols))
    return (
      <Box flexDirection="column">
        {shown.map(i => (
          <Box key={`solved-${i}`} flexDirection="row">
            <Text backgroundColor={GROUP_BG[i]} color="#1f2328" bold>{` ${GROUP_MARK[i]} ${b.groups[i]!.name} `}</Text>
            <Text color={GROUP_BG[i]} wrap="truncate">{`  ${b.groups[i]!.terms.join(' · ')}`}</Text>
          </Box>
        ))}
        {shown.length > 0 && left.length > 0 && <Text> </Text>}
        {Array.from({ length: Math.ceil(left.length / cols) }, (_, r) => (
          <Box key={`terms-${r}`} flexDirection="row">
            {left.slice(r * cols, r * cols + cols).map((t, j) => {
              const isPicked = picked.includes(t)
              return (
                <Box width={colWidth} paddingRight={1}>
                  <Box {...(isPicked ? { backgroundColor: '#5b21b6' } : {})}>
                    <Button key={`term-${t}`} plain hotkey={HOTKEYS[r * cols + j]} label={isPicked ? `${t} ✓` : t} onPress={() => toggle(t)} />
                  </Box>
                </Box>
              )
            })}
          </Box>
        ))}
        {v.status === 'playing' && (
          <Box key="controls" flexDirection="row" gap={3} marginTop={1}>
            {controls}
            {misses}
          </Box>
        )}
      </Box>
    )
  },
}

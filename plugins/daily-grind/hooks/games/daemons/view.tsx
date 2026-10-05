import type { Game } from '../types'
import { boardFor, cellName, clashes, isSolved, N, parseCell, toggle } from './logic'
import type { DaemonsSave } from './logic'

const REGION_BG = ['#9f1239', '#1d4ed8', '#15803d', '#a16207', '#7e22ce', '#0e7490', '#57534e']
const COLS = 'abcdefg'

export const daemons: Game<number[], DaemonsSave> = {
  id: 'daemons',
  name: 'Daemons',
  category: 'Classics',
  tagline: 'One per row, column and color',
  puzzle: boardFor,
  fresh: () => ({ cells: [], moves: 0 }),
  status: (board, s) => (isSolved(board, s.cells) ? 'won' : 'playing'),
  share: (_, s) => `◆ ${s.moves} moves`,
  view: v => {
    const { Box, Text, Button } = v.els
    const Input = v.surface === 'mobile' ? undefined : v.els.Input
    const board = v.puzzle
    const { cells } = v.save
    const bad = clashes(board, cells)
    const isPlaying = v.status === 'playing'
    const flip = (list: number[]) => v.play(s => (isPlaying ? { save: toggle(s, list) } : {}))
    const isRich = v.surface !== 'terminal'
    // Terminal cells are 3 columns by 1 row (about square); desktop cells get room to breathe.
    const [cw, ch] = isRich ? [5, 2] : [3, 1]
    const glyph = (i: number) => (cells.includes(i) ? (bad.has(i) ? '✖' : '◆') : isRich ? '' : ' ')

    const grid = (
      <Box flexDirection="column" flexShrink={0} {...(isRich ? { borderStyle: 'round', borderColor: '#57534e' } : {})}>
        <Box flexDirection="row">
          <Text dimColor>{'   '}</Text>
          {[...COLS].map(c => (
            <Box width={cw} justifyContent="center">
              <Text dimColor>{c}</Text>
            </Box>
          ))}
        </Box>
        {Array.from({ length: N }, (_, r) => (
          <Box key={`grid-${r}`} flexDirection="row">
            <Box width={3} height={ch} alignItems="center">
              <Text dimColor>{` ${r + 1}`}</Text>
            </Box>
            {Array.from({ length: N }, (_, c) => {
              const i = r * N + c
              return (
                <Box width={cw} height={ch} backgroundColor={REGION_BG[board[i]!]} justifyContent="center" alignItems="center">
                  <Button key={`cell-${cellName(i)}`} plain label={isRich ? glyph(i) || '·' : ` ${glyph(i)} `} onPress={() => flip([i])} />
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    )
    const placed = cells.length - bad.size
    const status = (
      <Text>
        <Text color={bad.size ? '#f87171' : '#a3e635'}>{'◆'.repeat(Math.max(0, placed))}</Text>
        <Text color="#f87171">{'✖'.repeat(bad.size)}</Text>
        <Text dimColor>{'·'.repeat(Math.max(0, N - cells.length))} {cells.length}/{N}</Text>
      </Text>
    )
    const field = isPlaying && Input && (
      <Input key="cell" autoFocus label="cell" placeholder="e.g. c4 (toggles)" submitLabel="toggle" value=""
        onSubmit={value => {
          const list = value.split(/[\s,]+/).filter(Boolean).map(parseCell)
          if (list.length === 0 || list.some(c => c === null)) return void v.play(() => ({ note: 'Cells look like c4: column a-g, row 1-7.' }))
          flip(list as number[])
        }}
      />
    )
    const reset = isPlaying && (
      <Button key="reset" {...(isRich ? {} : { plain: true as const })} hotkey="r" label="reset" onPress={() => v.play(s => ({ save: { ...s, cells: [] } }))} />
    )
    const rules = <Text dimColor>Place 7 ◆: one per row, column and color. None may touch, even diagonally.</Text>

    if (isRich)
      return (
        <Box flexDirection="column" alignItems="center" gap={1}>
          {rules}
          {grid}
          <Box key="controls" flexDirection="row" gap={2} alignItems="center">
            {status}
            {reset}
          </Box>
          {field}
        </Box>
      )
    const isWide = v.width >= 60
    return (
      <Box flexDirection="column">
        <Box flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 3 : 0}>
          {grid}
          <Box key="controls" flexDirection="column" flexShrink={1} marginTop={1} gap={1}>
            {rules}
            {status}
            {reset}
          </Box>
        </Box>
        {field && <Box marginTop={1}>{field}</Box>}
      </Box>
    )
  },
}

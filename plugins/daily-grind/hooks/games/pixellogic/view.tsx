import type { Game } from '../types'
import { clues, emptyBoard, isMistake, isSolved, meta, puzzle, shareText, wrongCells } from './logic'
import type { Cell, Puzzle } from './logic'

export type PixelSave = { board: Cell[]; mode: 1 | 2; hints: number; mistakes: number; wrong: number[] }

const LETTERS = 'abcdefghij'
const FILL = '#3b82f6'
const SOLVED = '#f59e0b'
const WRONG = '#dc2626'
const BLOCK = ['#3f3f46', undefined] // 5×5 blocks shaded alternately so cells are easy to count (no bg survives any color depth)

const cellName = (size: number, i: number) => `${LETTERS[i % size]}${Math.floor(i / size) + 1}`
const clueText = (c: number[]) => (c.length ? c : [0]).join(' ')

/**
 * "c4" fills, "xc4" marks, "a1-e1" covers a run within one row or column. Several separated by spaces or commas.
 * Returns the cells and what to set them to, or null if anything does not parse.
 */
export const parseMove = (size: number, text: string): { cells: number[]; to: 1 | 2 } | null => {
  const tokens = text.trim().toLowerCase().split(/[\s,]+/).filter(Boolean)
  if (!tokens.length) return null
  const cells: number[] = []
  let to: 1 | 2 = 1
  for (const t of tokens) {
    const m = /^(x?)([a-j])(\d{1,2})(?:-([a-j])(\d{1,2}))?$/.exec(t)
    if (!m) return null
    if (m[1]) to = 2
    const [c1, r1] = [LETTERS.indexOf(m[2]!), Number(m[3]) - 1]
    const [c2, r2] = m[4] ? [LETTERS.indexOf(m[4]), Number(m[5]) - 1] : [c1, r1]
    if ([c1, r1, c2, r2].some(n => n < 0 || n >= size) || (c1 !== c2 && r1 !== r2)) return null
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) cells.push(r * size + c)
  }
  return { cells, to }
}

/** Sets `cells` to `to`, or clears them all if they all already are; counts cells set wrongly. */
const apply = (p: Puzzle, s: PixelSave, cells: number[], to: 1 | 2): PixelSave => {
  const isClear = cells.every(i => s.board[i] === to)
  const board = [...s.board]
  let mistakes = s.mistakes
  for (const i of cells) {
    if (!isClear && board[i] !== to && isMistake(p, i, to)) mistakes++
    board[i] = isClear ? 0 : to
  }
  return { ...s, board, mistakes, wrong: [] }
}

const pictureSvg = (p: Puzzle) => {
  const [T, G] = [22, 3]
  const n = p.size
  const side = n * T + (n - 1) * G
  const rects = p.rows.flatMap((row, r) =>
    [...row].map((ch, c) => `<rect x="${c * (T + G)}" y="${r * (T + G)}" width="${T}" height="${T}" rx="4" fill="${ch === '#' ? SOLVED : '#8882'}"/>`),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">${rects.join('')}</svg>`
}

export const pixellogic: Game<Puzzle, PixelSave> = {
  ...meta,
  puzzle,
  fresh: p => ({ board: emptyBoard(p), mode: 1, hints: 0, mistakes: 0, wrong: [] }),
  status: (p, s) => (isSolved(p, s.board) ? 'won' : 'playing'),
  share: (p, s) => shareText(p, { hints: s.hints, mistakes: s.mistakes }).replace(/^Pixel Logic #\d+ /, ''),
  view: v => {
    const { Box, Text, Button } = v.els
    const Input = v.surface === 'mobile' ? undefined : v.els.Input
    const p = v.puzzle
    const n = p.size
    const { board, mode, hints, mistakes, wrong } = v.save
    const isPlaying = v.status === 'playing'
    const isRich = v.surface !== 'terminal'
    const bad = new Set(wrong)

    // A line is satisfied when the runs drawn so far equal its clue: its clue goes dim.
    const drawn = clues(Array.from({ length: n }, (_, r) => board.slice(r * n, r * n + n).map(c => (c === 1 ? '#' : '.')).join('')))
    const rowDone = p.clues.rows.map((c, r) => !isPlaying || clueText(c) === clueText(drawn.rows[r]!))
    const colDone = p.clues.cols.map((c, k) => !isPlaying || clueText(c) === clueText(drawn.cols[k]!))

    const play = (cells: number[], to: 1 | 2) => v.play(s => (isPlaying ? { save: apply(p, s, cells, to) } : {}))
    const check = () =>
      v.play(s => {
        const w = wrongCells(p, s.board)
        return { save: { ...s, hints: s.hints + 1, wrong: w }, note: w.length ? `${w.length} wrong cell${w.length === 1 ? '' : 's'}, shown in red.` : 'Nothing wrong so far.' }
      })
    const toggleMode = () => v.play(s => ({ save: { ...s, mode: s.mode === 1 ? 2 : 1 } }))

    // Terminal cells are 2 columns by 1 row; elsewhere they get room to breathe.
    const [cw, ch] = !isRich ? [2, 1] : v.surface === 'mobile' ? [3, 1] : [4, 2]
    const rowW = Math.max(...p.clues.rows.map(c => clueText(c).length))
    const colH = Math.max(...p.clues.cols.map(c => Math.max(1, c.length)))

    const cellBg = (i: number) => {
      const c = board[i]
      if (bad.has(i)) return WRONG
      if (!isPlaying || c === 1) return isRich && c === 1 ? (isPlaying ? FILL : SOLVED) : undefined
      return BLOCK[(Math.floor(i / n / 5) + Math.floor((i % n) / 5)) % 2]
    }
    const cellLabel = (i: number) => {
      const c = board[i]
      if (isRich) return c === 1 ? '■' : c === 2 ? '×' : '·'
      // Solid blocks in the text color read in any theme and color depth.
      return c === 1 ? (bad.has(i) ? '▒▒' : '██') : c === 2 ? '× ' : '  '
    }

    const colClues = Array.from({ length: colH }, (_, line) => (
      <Box key={`colclue-${line}`} flexDirection="row">
        <Box width={rowW + 1} flexShrink={0} />
        {p.clues.cols.map((c, k) => {
          const list = c.length ? c : [0]
          const at = line - (colH - list.length)
          return (
            <Box width={cw} flexShrink={0} justifyContent={isRich ? 'center' : 'flex-end'}>
              <Text dimColor={colDone[k]} bold={!colDone[k]}>{at >= 0 ? String(list[at]) : ''}</Text>
            </Box>
          )
        })}
      </Box>
    ))
    const letters = (
      <Box flexDirection="row">
        <Box width={rowW + 1} flexShrink={0} />
        {[...LETTERS.slice(0, n)].map(l => (
          <Box width={cw} flexShrink={0} justifyContent={isRich ? 'center' : 'flex-end'}>
            <Text color="#71717a">{l}</Text>
          </Box>
        ))}
      </Box>
    )
    const rows = Array.from({ length: n }, (_, r) => (
      <Box key={`row-${r}`} flexDirection="row">
        <Box width={rowW + 1} height={ch} flexShrink={0} justifyContent="flex-end" alignItems="center" paddingRight={1}>
          <Text dimColor={rowDone[r]} bold={!rowDone[r]}>{clueText(p.clues.rows[r]!)}</Text>
        </Box>
        {Array.from({ length: n }, (_, c) => {
          const i = r * n + c
          return (
            <Box width={cw} height={ch} flexShrink={0} backgroundColor={cellBg(i)} justifyContent="center" alignItems="center">
              {isPlaying ? (
                <Button key={`cell-${cellName(n, i)}`} plain label={cellLabel(i)} onPress={() => play([i], v.save.mode)} />
              ) : (
                <Text color={SOLVED}>{!isRich && board[i] === 1 ? '██' : '  '}</Text>
              )}
            </Box>
          )
        })}
        <Box width={3} height={ch} flexShrink={0} alignItems="center">
          <Text color="#71717a">{` ${r + 1}`}</Text>
        </Box>
      </Box>
    ))
    const grid = (
      <Box key="grid" flexDirection="column" flexShrink={0} {...(isRich ? { borderStyle: 'round', borderColor: '#57534e', paddingX: 1 } : {})}>
        {colClues}
        {letters}
        {rows}
      </Box>
    )

    const tally = (
      <Box key="tally"><Text>
        <Text dimColor>hints </Text>
        <Text>{hints}</Text>
        <Text dimColor>{'  ·  mistakes '}</Text>
        <Text color={mistakes ? '#f87171' : undefined}>{mistakes}</Text>
      </Text></Box>
    )
    const title = !isPlaying && (
      <Box key="title"><Text>
        <Text dimColor>It's </Text>
        <Text bold color={SOLVED}>{p.title}</Text>
        <Text dimColor>{` · ${n}×${n}`}</Text>
      </Text></Box>
    )
    const rules = <Text dimColor>Numbers are runs of filled cells, in order. Fill them all to reveal the picture.</Text>
    const field = isPlaying && Input && (
      <Input key="cell" autoFocus label="cell" placeholder="c4 fills, xc4 marks, a1-e1 a run" submitLabel="go" value=""
        onSubmit={text => {
          const m = parseMove(n, text)
          if (!m) return void v.play(() => ({ note: `Cells look like c4 (column a-${LETTERS[n - 1]}, row 1-${n}); xc4 marks; a1-e1 a run.` }))
          play(m.cells, m.to)
        }}
      />
    )

    if (isRich) {
      const controls = isPlaying && (
        <Box key="controls" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap" justifyContent="center">
          <Button key="mode-fill" {...(mode === 1 ? { variant: 'primary' as const } : {})} label="■ Fill" onPress={() => mode !== 1 && toggleMode()} />
          <Button key="mode-mark" {...(mode === 2 ? { variant: 'primary' as const } : {})} label="× Mark" onPress={() => mode !== 2 && toggleMode()} />
          <Button key="check" label="Check (hint)" onPress={check} />
        </Box>
      )
      return (
        <Box flexDirection="column" alignItems="center" gap={1}>
          {isPlaying ? rules : title}
          {isPlaying ? grid : <v.els.Svg source={pictureSvg(p)} alt={`The finished picture: ${p.title}`} />}
          {controls}
          {tally}
          {field}
        </Box>
      )
    }

    const side = (
      <Box key="controls" flexDirection="column" flexShrink={1} marginTop={1} gap={1}>
        {isPlaying ? rules : title}
        {isPlaying && (
          <Box flexDirection="row" gap={2}>
            <Button key="mode" plain hotkey="m" label={mode === 1 ? 'filling ■' : 'marking ×'} onPress={toggleMode} />
            <Button key="check" plain hotkey="c" label="check (hint)" onPress={check} />
          </Box>
        )}
        {tally}
      </Box>
    )
    const isWide = v.width >= 60
    return (
      <Box flexDirection="column">
        <Box flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 3 : 0}>
          {grid}
          {side}
        </Box>
        {field && <Box marginTop={1}>{field}</Box>}
      </Box>
    )
  },
}

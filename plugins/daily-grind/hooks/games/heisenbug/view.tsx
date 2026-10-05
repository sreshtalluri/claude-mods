import type { Game } from '../types'
import { PUZZLES } from './data'
import { cluesShown, guess, isDone, isWon, MAX_GUESSES, meta, puzzle, shareText, wrongGuesses } from './logic'
import type { Clue, Puzzle, State } from './logic'

type Save = { guesses: number[] }

// Line pickers: a, b, c… skipping the shell's q (back) and y (copy).
const HOTKEYS = 'abcdefghijklmnoprstuvwxz'
const EXT = { javascript: 'js', typescript: 'ts', python: 'py' } as const
const C = { kw: '#c678dd', str: '#98c379', num: '#d19a66', fn: '#61afef', com: '#5c6370', red: '#e06c75', green: '#98c379' }
const KEYWORDS = new Set(
  ('function return if else for while const let var of in new class extends import export from async await try catch finally throw ' +
    'typeof instanceof break continue switch case default do def elif lambda not and or is pass with as yield raise except global nonlocal')
    .split(' '),
)
const CONSTANTS = new Set('true false null undefined this None True False self NaN Infinity'.split(' '))
const TOKEN = /("""[^]*?"""|'''[^]*?'''|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b(\s*\()?/g

/** One line split into colored runs: keywords, strings, numbers, calls, a trailing comment. */
const colorize = (line: string, lang: Puzzle['lang']): { text: string; color?: string }[] => {
  const ci = line.search(lang === 'python' ? /#(?=(?:[^'"]|'[^']*'|"[^"]*")*$)/ : /\/\/(?=(?:[^'"`]|'[^']*'|"[^"]*"|`[^`]*`)*$)/)
  const [code, comment] = ci < 0 ? [line, ''] : [line.slice(0, ci), line.slice(ci)]
  const out: { text: string; color?: string }[] = []
  let last = 0
  for (const m of code.matchAll(TOKEN)) {
    const [all, str, num, id, call] = m
    if (m.index > last) out.push({ text: code.slice(last, m.index) })
    if (str) out.push({ text: str, color: C.str })
    else if (num) out.push({ text: num, color: C.num })
    else if (id) {
      const color = KEYWORDS.has(id) ? C.kw : CONSTANTS.has(id) ? C.num : call ? C.fn : undefined
      out.push({ text: id, color }, ...(call ? [{ text: call }] : []))
    }
    last = m.index + all.length
  }
  if (last < code.length) out.push({ text: code.slice(last) })
  if (comment) out.push({ text: comment, color: C.com })
  return out
}

/** The logic keys everything by day; the shell hands us the puzzle, which is the day's entry of PUZZLES. */
const state = (p: Puzzle, s: Save): State => ({ day: PUZZLES.indexOf(p), guesses: s.guesses })

export const heisenbug: Game<Puzzle, Save> = {
  ...meta,
  puzzle,
  fresh: () => ({ guesses: [] }),
  status: (p, s) => {
    const st = state(p, s)
    return isWon(st) ? 'won' : isDone(st) ? 'lost' : 'playing'
  },
  share: (p, s) => shareText(state(p, s))?.replace(/^Heisenbug #\d+ /, '') ?? '',
  view: v => {
    const { Box, Text, Button, Code } = v.els
    const p = v.puzzle
    const st = state(p, v.save)
    const isPlaying = v.status === 'playing'
    const clues = cluesShown(st)
    const left = MAX_GUESSES - st.guesses.length
    const file = `${p.title}.${EXT[p.lang]}`
    const pick = (i: number) =>
      v.play(s => {
        const before = state(p, s)
        const after = guess(before, i)
        if (after === before) return { note: isDone(before) ? undefined : `Line ${i + 1} is already ruled out.` }
        return {
          save: { guesses: after.guesses },
          note: isDone(after) ? undefined : `Line ${i + 1} checks out. A new test is failing.`,
        }
      })
    const bugs = (
      <Box key="guesses">
        <Text>
          <Text dimColor>guesses left </Text>
          <Text>{'🐞'.repeat(left)}</Text>
        </Text>
      </Box>
    )
    const fixedAt = `line ${p.bugLine + 1}`

    if (v.surface !== 'terminal') {
      const clueCard = (c: Clue, k: number) => (
        <Box key={`clue-${k}`} flexDirection="column" borderStyle="round" borderColor="#e06c7566" paddingX={1} flexGrow={1}>
          <Text bold>{c.input}</Text>
          <Text color={C.green}>expected {c.expected}</Text>
          <Text color={C.red}>actual   {c.actual}</Text>
        </Box>
      )
      const mark = (i: number) => (i === p.bugLine && !isPlaying ? (isWon(st) ? '✓ ' : '🐞 ') : st.guesses.includes(i) ? '✗ ' : '')
      return (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>One line is wrong. Read the code, then pick the line you think is the bug.</Text>
          <Box key="listing" flexDirection="column" borderStyle="round" borderColor="#5c6370" paddingX={1}>
            <Text bold>{file}</Text>
            <Code source={p.lines.join('\n')} language={p.lang} startLine={1} />
          </Box>
          <Box key="picker" flexDirection="column" gap={1}>
            <Text dimColor>{isPlaying ? 'Which line is the bug?' : 'Lines'}</Text>
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {p.lines.map((_, i) => (
                <Button key={`line-${i}`} hotkey={isPlaying ? HOTKEYS[i] : undefined}
                  variant={!isPlaying && i === p.bugLine ? 'primary' : 'secondary'} dimColor={st.guesses.includes(i) && i !== p.bugLine}
                  label={`${mark(i)}${i + 1}`} onPress={() => pick(i)} />
              ))}
            </Box>
            {isPlaying && bugs}
          </Box>
          {clues.length > 0 && (
            <Box key="clues" flexDirection="column" gap={1}>
              <Text bold color={C.red}>Failing tests</Text>
              <Box flexDirection="row" flexWrap="wrap" gap={1}>{clues.map(clueCard)}</Box>
            </Box>
          )}
          {!isPlaying && (
            <Box key="diff" flexDirection="column" borderStyle="round" borderColor={isWon(st) ? C.green : C.red} paddingX={1} gap={1}>
              <Text bold>{isWon(st) ? `Found it: ${fixedAt}` : `The bug was ${fixedAt}`}</Text>
              <Code format="diff" language={p.lang}
                source={`@@ -${p.bugLine + 1},1 +${p.bugLine + 1},1 @@\n-${p.lines[p.bugLine]}\n+${p.fix}`} />
              <Text>{p.why}</Text>
            </Box>
          )}
        </Box>
      )
    }

    // Terminal: an editor gutter. [mark][hotkey: n] │ code
    const numW = String(p.lines.length).length
    const rows = p.lines.map((line, i) => {
      const n = String(i + 1).padStart(numW)
      const tried = st.guesses.includes(i)
      const isBug = !isPlaying && i === p.bugLine
      const markGlyph = isBug ? (isWon(st) ? '✓' : '▶') : tried ? '✗' : ' '
      const markColor = isBug ? (isWon(st) ? C.green : C.red) : C.red
      const bg = isBug ? (isWon(st) ? '#1f3a26' : '#4a1f24') : undefined
      return (
        <Box key={`row-${i}`} flexDirection="row">
          <Text color={markColor} bold>{`${markGlyph} `}</Text>
          {isPlaying && !tried ? (
            <Button key={`line-${i}`} plain hotkey={HOTKEYS[i]} label={n} onPress={() => pick(i)} />
          ) : (
            <Text dimColor={!isBug} bold={isBug}>{`   ${n}`}</Text>
          )}
          <Text dimColor>{' │ '}</Text>
          <Box flexShrink={1} {...(bg ? { backgroundColor: bg, flexGrow: 1 } : {})}>
            <Text wrap="truncate">
              {tried && !isBug
                ? <Text dimColor strikethrough>{line}</Text>
                : colorize(line, p.lang).map(t => (t.color ? <Text color={t.color}>{t.text}</Text> : <Text>{t.text}</Text>))}
            </Text>
          </Box>
        </Box>
      )
    })

    // Clues as a test table; one row each when it fits, else input over expected/actual.
    const [inW, exW] = [Math.max(13, ...clues.map(c => c.input.length)), Math.max(8, ...clues.map(c => c.expected.length))]
    const actW = Math.max(6, ...clues.map(c => c.actual.length))
    const oneRow = 4 + inW + 2 + exW + 2 + actW <= v.width
    const table = clues.length > 0 && (
      <Box key="clues" flexDirection="column" marginTop={1}>
        <Text>
          <Text color={C.red} bold>{'✗ failing tests'}</Text>
          {oneRow && <Text dimColor>{`  ${''.padEnd(inW - 11)}expected${''.padEnd(exW - 6)}actual`}</Text>}
        </Text>
        {clues.map((c, k) =>
          oneRow ? (
            <Text key={`clue-${k}`} wrap="truncate">
              <Text dimColor>{'  ✗ '}</Text>
              <Text>{c.input.padEnd(inW + 2)}</Text>
              <Text color={C.green}>{c.expected.padEnd(exW + 2)}</Text>
              <Text color={C.red}>{c.actual}</Text>
            </Text>
          ) : (
            <Box key={`clue-${k}`} flexDirection="column">
              <Text wrap="truncate"><Text dimColor>{'  ✗ '}</Text>{c.input}</Text>
              <Text wrap="truncate">
                <Text dimColor>{'    expected '}</Text><Text color={C.green}>{c.expected}</Text>
                <Text dimColor>{'  actual '}</Text><Text color={C.red}>{c.actual}</Text>
              </Text>
            </Box>
          ),
        )}
      </Box>
    )
    const diff = !isPlaying && (
      <Box key="diff" flexDirection="column" width={v.width}>
        <Text bold color={isWon(st) ? C.green : C.red}>{isWon(st) ? `✓ found it: ${fixedAt}` : `▶ the bug was ${fixedAt}`}</Text>
        <Text wrap="truncate" backgroundColor="#4a1f24" color="#ffb3b8">{`- ${p.lines[p.bugLine]!.trim()} `}</Text>
        <Text wrap="truncate" backgroundColor="#1f3a26" color="#b5f5c0">{`+ ${p.fix.trim()} `}</Text>
        <Text dimColor wrap="wrap">{p.why}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Text backgroundColor="#2c313a" color="#abb2bf">{` ${file} `}</Text>
          {isPlaying ? bugs : <Text dimColor>{`${wrongGuesses(st)} wrong`}</Text>}
          {isPlaying && v.width >= 70 && <Text dimColor>one line lies: press its letter</Text>}
        </Box>
        <Box flexDirection="column">{rows}</Box>
        {table}
        {diff}
      </Box>
    )
  },
}

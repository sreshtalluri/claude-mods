import { esc, FONT } from '../../shared'
import type { Game } from '../types'
import { answerFor, guessError, known, lexerShare, lexerStatus, score, TRIES } from './logic'
import type { LexerSave, Mark } from './logic'

const BG: Record<Mark, string> = { hit: '#7c3aed', near: '#d97706', miss: '#52525b' }
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

/** The board as an SVG: five tiles a row, six rows, rounded and colored. */
const boardSvg = (answer: string, guesses: string[]) => {
  const [T, G] = [52, 6]
  const tiles = Array.from({ length: TRIES * 5 }, (_, i) => {
    const [r, c] = [Math.floor(i / 5), i % 5]
    const [x, y] = [c * (T + G), r * (T + G)]
    const g = guesses[r]
    if (!g) return `<rect x="${x + 1}" y="${y + 1}" width="${T - 2}" height="${T - 2}" rx="7" fill="#8881" stroke="#8886" stroke-width="2"/>`
    const m = score(g, answer)[c]!
    return `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="7" fill="${BG[m]}"/><text x="${x + T / 2}" y="${y + T / 2 + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="#fff">${esc(g[c]!.toUpperCase())}</text>`
  })
  const [w, h] = [5 * T + 4 * G, TRIES * T + (TRIES - 1) * G]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>${tiles.join('')}</svg>`
}

/** The keyboard as an SVG, each key colored by the best mark its letter has earned. */
const keysSvg = (best: Map<string, Mark>) => {
  const [K, KH, G] = [26, 36, 5]
  const w = 10 * K + 9 * G
  const keys = KEYS.flatMap((row, r) =>
    [...row].map((ch, i) => {
      const x = (w - (row.length * K + (row.length - 1) * G)) / 2 + i * (K + G)
      const y = r * (KH + G)
      const m = best.get(ch)
      const fill = m ? BG[m] : '#8885'
      const ink = m === 'miss' ? '#a1a1aa' : '#fff'
      return `<rect x="${x}" y="${y}" width="${K}" height="${KH}" rx="5" fill="${fill}"/><text x="${x + K / 2}" y="${y + KH / 2 + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="${ink}">${ch.toUpperCase()}</text>`
    }),
  )
  const h = 3 * KH + 2 * G
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT}>${keys.join('')}</svg>`
}

export const lexer: Game<string, LexerSave> = {
  id: 'lexer',
  name: 'Lexer',
  category: 'Classics',
  tagline: 'Guess the five-letter dev word',
  puzzle: answerFor,
  fresh: () => ({ guesses: [] }),
  status: lexerStatus,
  share: lexerShare,
  view: v => {
    const { Box, Text } = v.els
    const Input = v.surface === 'mobile' ? undefined : v.els.Input
    const answer = v.puzzle
    const { guesses } = v.save
    const best = known(answer, guesses)
    const guess = (value: string) => {
      const word = value.trim().toLowerCase()
      v.play(s => {
        const err = guessError(word, s.guesses)
        return err ? { note: err } : { save: { guesses: [...s.guesses, word] } }
      })
    }
    const field =
      v.status !== 'playing' ? (
        v.status === 'lost' ? <Text>The word was <Text bold>{answer.toUpperCase()}</Text>.</Text> : null
      ) : Input ? (
        <Input key="guess" autoFocus label="guess" placeholder="five letters, Enter" submitLabel="guess" value="" onSubmit={guess} />
      ) : (
        <Text dimColor>Lexer needs a keyboard: play it in the terminal or desktop app.</Text>
      )

    if (v.surface !== 'terminal') {
      const { Svg } = v.els
      return (
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Svg source={boardSvg(answer, guesses)} alt={`Lexer board: ${guesses.length} of ${TRIES} guesses`} />
          <Svg source={keysSvg(best)} alt="Letters tried so far" />
          {field}
        </Box>
      )
    }

    const rows = Array.from({ length: TRIES }, (_, r) => {
      const g = guesses[r]
      const marks = g ? score(g, answer) : []
      const isNext = r === guesses.length && v.status === 'playing'
      return (
        <Box key={`row-${r}`} flexDirection="row" gap={1}>
          {Array.from({ length: 5 }, (_, i) =>
            g ? (
              <Text backgroundColor={BG[marks[i]!]} color="#ffffff" bold>{` ${g[i]!.toUpperCase()} `}</Text>
            ) : (
              <Text backgroundColor={isNext ? '#34343a' : '#1f1f23'} color="#52525b">{isNext ? ' _ ' : '   '}</Text>
            ),
          )}
        </Box>
      )
    })
    const keyboard = KEYS.map((row, r) => (
      <Box key={`keys-${r}`} flexDirection="row" marginLeft={r}>
        {[...row].map(ch => {
          const m = best.get(ch)
          return m === 'miss' ? <Text color="#52525b">{` ${ch} `}</Text>
            : m ? <Text backgroundColor={BG[m]} color="#ffffff" bold>{` ${ch} `}</Text>
            : <Text>{` ${ch} `}</Text>
        })}
      </Box>
    ))
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={4}>
          <Box flexDirection="column" rowGap={0}>{rows}</Box>
          {v.width >= 56 && <Box flexDirection="column" justifyContent="flex-end">{keyboard}</Box>}
        </Box>
        {v.width < 56 && <Box flexDirection="column" marginTop={1}>{keyboard}</Box>}
        {field && <Box marginTop={1}>{field}</Box>}
      </Box>
    )
  },
}

import { cycle } from '../../shared'
import type { Status } from '../types'
import { ANSWERS, EXTRA } from './data'

export const TRIES = 6
export type Mark = 'hit' | 'near' | 'miss'
export type LexerSave = { guesses: string[] }

const WORDS = new Set([...ANSWERS, ...EXTRA])

export const answerFor = (day: number) => cycle(ANSWERS, day)
export const isWord = (w: string) => WORDS.has(w)

/** Per letter: right spot, elsewhere in the word (each answer letter counted once), or absent. */
export const score = (guess: string, answer: string): Mark[] => {
  const marks: Mark[] = [...guess].map((c, i) => (answer[i] === c ? 'hit' : 'miss'))
  const left = [...answer].filter((_, i) => marks[i] !== 'hit')
  ;[...guess].forEach((c, i) => {
    const at = left.indexOf(c)
    if (marks[i] === 'miss' && at >= 0) {
      marks[i] = 'near'
      left.splice(at, 1)
    }
  })
  return marks
}

export const lexerStatus = (answer: string, s: LexerSave): Status =>
  s.guesses.includes(answer) ? 'won' : s.guesses.length >= TRIES ? 'lost' : 'playing'

/** Why a guess is refused, or null when it counts. */
export const guessError = (guess: string, guesses: string[]): string | null =>
  !/^[a-z]{5}$/.test(guess) ? 'Five letters, a to z.'
  : guesses.includes(guess) ? `Already tried ${guess}.`
  : !isWord(guess) ? `${guess} is not in the word list.`
  : null

/** The best mark each letter has earned so far, for the keyboard. */
export const known = (answer: string, guesses: string[]) => {
  const best = new Map<string, Mark>()
  for (const g of guesses)
    score(g, answer).forEach((m, i) => {
      const c = g[i]!
      if (m === 'hit' || (m === 'near' && best.get(c) !== 'hit') || !best.has(c)) best.set(c, m)
    })
  return best
}

const MARK: Record<Mark, string> = { hit: '🟣', near: '🟠', miss: '⚫' }

export const lexerShare = (answer: string, s: LexerSave) =>
  [
    `${lexerStatus(answer, s) === 'won' ? s.guesses.length : 'X'}/${TRIES}`,
    ...s.guesses.map(g => score(g, answer).map(m => MARK[m]).join('')),
  ].join('\n')

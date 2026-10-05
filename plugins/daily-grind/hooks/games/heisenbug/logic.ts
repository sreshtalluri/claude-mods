/**
 * Heisenbug: one line in a short function is wrong. Find it in four guesses or fewer.
 *
 * API (pure, no I/O):
 *   meta                      { id: 'heisenbug', name, category: 'Developer', tagline }
 *   MAX_GUESSES               4
 *   puzzle(day)               the Puzzle for a day index (cycles through PUZZLES; negative days wrap)
 *   start(day)                fresh State { day, guesses: [] }
 *   guess(state, line)        new State with `line` (0-based index into puzzle.lines) recorded;
 *                             returns the same state when done, out of range, or already guessed
 *   wrongGuesses(state)       count of guesses that missed the bug
 *   cluesShown(state)         clues revealed so far: one per wrong guess (max 3); all once done
 *   isWon(state) / isDone(state)
 *   shareText(state)          e.g. 'Heisenbug #12 🐞🐞✅' (🐞 per miss, ✅ solved, ❌ out of guesses), null while playing
 * After isDone, show puzzle.fix (replaces lines[bugLine]) and puzzle.why.
 */
import { PUZZLES, type Clue, type Puzzle } from './data'

export type { Clue, Puzzle }
export type State = { day: number; guesses: number[] }

export const meta = { id: 'heisenbug', name: 'Heisenbug', category: 'Developer', tagline: 'One line is lying. Find it.' } as const
export const MAX_GUESSES = 4

export const puzzle = (day: number): Puzzle => PUZZLES[((day % PUZZLES.length) + PUZZLES.length) % PUZZLES.length]!

export const start = (day: number): State => ({ day, guesses: [] })

export const isWon = (s: State): boolean => s.guesses.includes(puzzle(s.day).bugLine)
export const isDone = (s: State): boolean => isWon(s) || s.guesses.length >= MAX_GUESSES
export const wrongGuesses = (s: State): number => s.guesses.filter(g => g !== puzzle(s.day).bugLine).length

export const guess = (s: State, line: number): State => {
  const ok = Number.isInteger(line) && line >= 0 && line < puzzle(s.day).lines.length
  return isDone(s) || !ok || s.guesses.includes(line) ? s : { ...s, guesses: [...s.guesses, line] }
}

export const cluesShown = (s: State): Clue[] => {
  const { clues } = puzzle(s.day)
  return isDone(s) ? clues : clues.slice(0, wrongGuesses(s))
}

export const shareText = (s: State): string | null =>
  isDone(s) ? `Heisenbug #${s.day + 1} ${'🐞'.repeat(wrongGuesses(s))}${isWon(s) ? '✅' : '❌'}` : null

import { cycle, rng } from '../../shared'
import type { Status } from '../types'
import { BANDS } from './data'

export const MISTAKES = 4
export type Group = { name: string; terms: string[] }
export type Buckets = { groups: Group[]; terms: string[] }
/** Tries made (four terms each) and the terms picked for the next one. */
export type BucketsSave = { tries: string[][]; picked: string[] }

/** One group from each band (band lengths differ, so pairings rotate), terms shuffled by day. */
export const bucketsFor = (day: number): Buckets => {
  const groups = BANDS.map(band => {
    const [name = '', ...terms] = cycle(band, day)
    return { name, terms }
  })
  const terms = groups.flatMap(g => g.terms)
  const r = rng(day + 1)
  for (let i = terms.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[terms[i], terms[j]] = [terms[j]!, terms[i]!]
  }
  return { groups, terms }
}

export const groupOf = (b: Buckets, term: string) => b.groups.findIndex(g => g.terms.includes(term))

/** A try's verdict: a whole group, three of one group, or neither. */
export const judge = (b: Buckets, picked: string[]): 'hit' | 'close' | 'miss' => {
  const counts = [0, 0, 0, 0]
  for (const t of picked) counts[groupOf(b, t)]! += 1
  const most = Math.max(...counts)
  return most === 4 ? 'hit' : most === 3 ? 'close' : 'miss'
}

export const bucketsProgress = (b: Buckets, tries: string[][]) => {
  const solved = tries.filter(t => judge(b, t) === 'hit').map(t => groupOf(b, t[0]!))
  const mistakes = tries.length - solved.length
  const status: Status = solved.length === 4 ? 'won' : mistakes >= MISTAKES ? 'lost' : 'playing'
  return { solved, mistakes, status }
}

export const sameTry = (a: string[], b: string[]) => a.length === b.length && a.every(t => b.includes(t))

/** Picks or unpicks a term; at most four. */
export const pick = (s: BucketsSave, term: string): BucketsSave => ({
  ...s,
  picked: s.picked.includes(term) ? s.picked.filter(p => p !== term) : s.picked.length < 4 ? [...s.picked, term] : s.picked,
})

/** Submits the picked four: the new save and what to say about it. */
export const submit = (b: Buckets, s: BucketsSave): { save?: BucketsSave; note: string } => {
  if (s.picked.length !== 4) return { note: 'Pick four terms first.' }
  if (s.tries.some(t => sameTry(t, s.picked))) return { note: 'Already tried those four.' }
  const verdict = judge(b, s.picked)
  const note = verdict === 'hit' ? '' : verdict === 'close' ? 'One away…' : 'Not a group.'
  return { note, save: { tries: [...s.tries, s.picked], picked: verdict === 'hit' ? [] : s.picked } }
}

export const GROUP_MARK = ['❶', '❷', '❸', '❹']

export const bucketsShare = (b: Buckets, s: BucketsSave) => {
  const { mistakes, status } = bucketsProgress(b, s.tries)
  const head = status === 'won' ? `${mistakes} miss${mistakes === 1 ? '' : 'es'}` : 'X'
  return [head, ...s.tries.map(t => t.map(term => GROUP_MARK[groupOf(b, term)]).join(''))].join('\n')
}

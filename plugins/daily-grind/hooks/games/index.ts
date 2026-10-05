import { buckets } from './buckets/view'
import { gitgolf } from './gitgolf/view'
import { heisenbug } from './heisenbug/view'
import { installorder } from './installorder/view'
import { ladder } from './ladder/view'
import { pixellogic } from './pixellogic/view'
import { codebreaker } from './codebreaker/view'
import { daemons } from './daemons/view'
import { lexer } from './lexer/view'
import type { Category, Game } from './types'

/** Every game, in menu order within its category. Adding one is a folder and a line here. */
export const GAMES: Game[] = [lexer, buckets, gitgolf, heisenbug, installorder, daemons, ladder, pixellogic, codebreaker]

export const CATEGORIES: { name: Category; blurb: string }[] = [
  { name: 'Developer', blurb: 'for people who live in a terminal' },
  { name: 'Everyone', blurb: 'pure logic, no jargon' },
  { name: 'Classics', blurb: 'familiar daily formats, our own twist' },
]

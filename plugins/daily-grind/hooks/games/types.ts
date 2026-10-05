import type { Elements, RenderElement, RenderSurface } from 'claude-code'

export type Category = 'Developer' | 'Everyone' | 'Classics'
export type Status = 'playing' | 'won' | 'lost'

/** What a move returns: the new save, a feedback line, or both. A missing note clears the old one. */
export type Move<S> = { save?: S; note?: string }

/**
 * What a game's view draws with. `surface` narrows `els` (the surface's element
 * table): `Raster` only on 'terminal', `Svg` everywhere else, no `Input` on 'mobile'. Branch on `surface`, never on what `els` holds: every table answers every name (a missing one draws nothing).
 */
export type ViewProps<P, S> = { [K in RenderSurface]: { surface: K; els: Elements[K] } }[RenderSurface] & {
  /** Body columns the view has; size boards to it. */
  width: number
  day: number
  puzzle: P
  save: S
  status: Status
  /** Applies a move to the latest save: persisted, stats recorded when it ends the game, redrawn. */
  play: (move: (save: S) => Move<S>) => void
}

/** One daily game. Add one: a folder under games/ exporting this, plus a line in games/index.ts. */
export type Game<P = any, S = any> = {
  /** Stable id: the key of its save and stats. */
  id: string
  name: string
  category: Category
  /** One line for the menu. */
  tagline: string
  /** The day's puzzle; the same `day` must give the same puzzle everywhere. */
  puzzle: (day: number) => P
  /** An untouched save (plain JSON). The menu calls a game "not started" while its save equals this. */
  fresh: (puzzle: P) => S
  status: (puzzle: P, save: S) => Status
  /** The result after `Daily Grind · <name> #<n>  `: a score, then optional emoji rows ("3/6\n🟣🟣⚫⚫🟣"). Called once finished. */
  share: (puzzle: P, save: S) => string
  /** The board and its controls. The shell draws the header, back button, note and share card around it. */
  view: (v: ViewProps<P, S>) => RenderElement
}

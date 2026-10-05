# Games

Each game is a folder here exporting one `Game` (see `types.ts`), listed in `index.ts`.
Adding a game = a folder + one line in `GAMES`.

```
games/<id>/
  data.ts    daily content (optional)
  logic.ts   pure rules: no JSX, no `$`; tested in tests/
  view.tsx   exports the Game object: metadata, the rules wired in, and `view`
```

## The interface

```ts
type Game<P, S> = {
  id: string                       // key of its save and stats; never change it
  name: string
  category: 'Developer' | 'Everyone'
  tagline: string                  // one menu line, ≤ 48 chars (tested)
  puzzle(day: number): P           // same day → same puzzle everywhere
  fresh(puzzle: P): S              // untouched save, plain JSON; "not started" while save equals it
  status(puzzle: P, save: S): 'playing' | 'won' | 'lost'
  share(puzzle: P, save: S): string   // after "Daily Grind · <name> #<n>  ": "3/6\n🟣🟣⚫…"
  view(v: ViewProps<P, S>): RenderElement
}

type ViewProps<P, S> = {
  surface: 'terminal' | 'desktop' | 'vscode' | 'mobile'
  els                              // that surface's element table: Box, Text, Button, Input, Svg (not terminal), Raster (terminal)…
  width: number                    // body columns
  day: number; puzzle: P; save: S; status: Status
  play(move: (save: S) => { save?: S; note?: string }): void
}
```

The shell owns everything around the view: the menu, the header and back button, Esc,
the feedback note, the share card and stats, persistence. A view only draws the board
and calls `play`, which reads the latest save, stores the result, records the win or loss
the first time `status` leaves `'playing'`, and redraws. A move with no `note` clears
the previous one. A view never touches `$`.

## Drawing rules

- Branch on `v.surface`, never on `'X' in v.els`: every table answers every name.
- Terminal: compact, aligned, a few colors; `Box backgroundColor` around a `plain`
  Button makes a clickable colored cell. `Raster` paints a colored grid (no presses).
- Everything else: `Svg` for pictures (drawn as an image, no presses), native Buttons
  (`variant="primary"` for the selected/main one), bordered Boxes. No `Input` on mobile.
- Hotkeys the shell uses: `1-9` on the menu, `q` back, `y` copy. Avoid them in a view,
  and remember a focused `Input` takes every printable key.
- Keys a test may press or find: give each control a stable `key`.

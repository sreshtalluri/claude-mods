/**
 * Git Golf: pure logic. No imports, no Node, no DOM.
 *
 * Model
 *   Repo = { commits: id -> parent ids, branches: name -> id, head: branch name, next, base }
 *   Commits C0..C{base-1} are the puzzle's originals. `commit` makes C{next}. cherry-pick / rebase
 *   copy a commit as C2', C2'' ... HEAD is always a branch (no detached HEAD). Commits no branch
 *   reaches are orphans: hidden from render and sameShape, still cherry-pickable by hash (like
 *   the reflog), but not a reset target.
 *
 * Commands (an optional leading `git ` is ignored)
 *   commit | branch <name> | checkout <name> | merge <name> | rebase <name>
 *   cherry-pick <ref> | reset [--hard] <ref>        ref = branch | commit id, optional ~n / ^ suffix
 *
 * API
 *   parse(text): Command | string                    string = error message
 *   apply(repo, cmd): Repo | string                  never mutates; string = error, costs no stroke
 *   play(repo, text): Repo | string                  parse + apply
 *   sameShape(a, b): boolean                         see `shapeKey`
 *   solve(start, target, maxDepth): Command[] | null BFS, shortest solution (length = par)
 *   render(repo): string[]                           a few ASCII lines for any view
 *   format(cmd): string                              command back to text
 *
 * Game glue (matches games/types.ts; save = the successful commands typed, plain JSON)
 *   meta / id, name, category, tagline
 *   puzzle(day): Puzzle                              { title, start, target, par }, cycles PUZZLES
 *   fresh(): Save                                    { moves: [] }  (also "reset to start")
 *   current(puzzle, save): Repo                      replays the save
 *   move(puzzle, save, text): { save?, note? }       bad command -> note only, no stroke
 *   undo(save): Save
 *   status(puzzle, save): 'playing' | 'won'
 *   share(puzzle, save): string                      `⛳ 5 (par 5) ✓`
 *   shareText(day, strokes, par): string             `Git Golf #12 ⛳ 6 (par 5) +1`
 */

import { PUZZLES, type Puzzle } from './data'

export type { Puzzle }
export const meta = {
  id: 'gitgolf',
  name: 'Git Golf',
  category: 'Developer',
  tagline: 'Reshape the commit graph in as few git commands as you can.',
} as const
export const { id, name, category, tagline } = meta

export type Repo = {
  commits: Record<string, string[]>
  branches: Record<string, string>
  head: string
  next: number
  base: number
}

export type Op = 'commit' | 'branch' | 'checkout' | 'merge' | 'rebase' | 'cherry-pick' | 'reset'
export type Command = { op: Op; arg?: string }

const NEEDS_ARG: Record<Op, boolean> = {
  commit: false, branch: true, checkout: true, merge: true, rebase: true, 'cherry-pick': true, reset: true,
}
const NAME = /^[A-Za-z][\w-]*$/

export function parse(text: string): Command | string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words[0] === 'git') words.shift()
  const [op, ...rest] = words
  if (!op) return 'type a git command'
  if (!(op in NEEDS_ARG)) return `unknown command: ${op}`
  const o = op as Op
  const args = o === 'reset' ? rest.filter(w => w !== '--hard') : o === 'commit' ? [] : rest
  if (!NEEDS_ARG[o]) return { op: o }
  if (args.length !== 1) return `usage: ${o} <${o === 'branch' || o === 'checkout' ? 'name' : 'ref'}>`
  return { op: o, arg: args[0] }
}

export const format = (c: Command): string => (c.arg ? `${c.op} ${c.arg}` : c.op)

export function play(repo: Repo, text: string): Repo | string {
  const cmd = parse(text)
  return typeof cmd === 'string' ? cmd : apply(repo, cmd)
}

/** Resolve a branch name or commit id, with optional `~n` / `^` (first-parent) suffixes. */
export function resolve(repo: Repo, ref: string): string | undefined {
  const m = /^(.+?)((?:~\d*|\^)*)$/.exec(ref)
  if (!m) return undefined
  let base = m[1] === 'HEAD' ? repo.branches[repo.head] : repo.branches[m[1]!] ?? (m[1]! in repo.commits ? m[1] : undefined)
  for (const step of m[2]!.match(/~\d*|\^/g) ?? []) {
    const n = step === '^' || step === '~' ? 1 : Number(step.slice(1))
    for (let i = 0; i < n && base !== undefined; i++) base = repo.commits[base]?.[0]
  }
  return base
}

export function ancestors(repo: Repo, id: string): Set<string> {
  const seen = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const c = stack.pop()!
    if (seen.has(c)) continue
    seen.add(c)
    stack.push(...(repo.commits[c] ?? []))
  }
  return seen
}

/** Commits reachable from `tip` but not from `upstream`, oldest first. */
function onlyIn(repo: Repo, tip: string, upstream: string): string[] {
  const exclude = ancestors(repo, upstream)
  const out: string[] = []
  const seen = new Set<string>()
  const visit = (c: string) => {
    if (seen.has(c) || exclude.has(c)) return
    seen.add(c)
    for (const p of repo.commits[c] ?? []) visit(p)
    out.push(c)
  }
  visit(tip)
  return out
}

function copyId(repo: Repo, commits: Record<string, string[]>, id: string): string {
  let out = id.replace(/'+$/, '') + "'"
  while (out in commits || out in repo.commits) out += "'"
  return out
}

export function reachable(repo: Repo): Set<string> {
  const live = new Set<string>()
  for (const tip of Object.values(repo.branches)) for (const c of ancestors(repo, tip)) live.add(c)
  return live
}

export function apply(repo: Repo, cmd: Command): Repo | string {
  const at = repo.branches[repo.head]!
  const arg = cmd.arg ?? ''
  const move = (commits: Record<string, string[]>, tip: string, next = repo.next): Repo =>
    ({ ...repo, commits, next, branches: { ...repo.branches, [repo.head]: tip } })

  switch (cmd.op) {
    case 'commit': {
      const id = `C${repo.next}`
      return move({ ...repo.commits, [id]: [at] }, id, repo.next + 1)
    }
    case 'branch':
      if (!NAME.test(arg) || arg === 'HEAD') return `invalid branch name: ${arg}`
      if (arg in repo.branches) return `branch ${arg} already exists`
      return { ...repo, branches: { ...repo.branches, [arg]: at } }
    case 'checkout':
      if (!(arg in repo.branches)) return arg in repo.commits ? 'detached HEAD is out of bounds here; checkout a branch' : `no branch named ${arg}`
      if (arg === repo.head) return `already on ${arg}`
      return { ...repo, head: arg }
    case 'merge': {
      const other = repo.branches[arg]
      if (other === undefined) return `no branch named ${arg}`
      if (ancestors(repo, at).has(other)) return 'already up to date'
      if (ancestors(repo, other).has(at)) return move(repo.commits, other) // fast-forward
      const id = `C${repo.next}`
      return move({ ...repo.commits, [id]: [at, other] }, id, repo.next + 1)
    }
    case 'rebase': {
      const onto = repo.branches[arg]
      if (onto === undefined) return `no branch named ${arg}`
      if (ancestors(repo, onto).has(at)) return at === onto ? 'already up to date' : move(repo.commits, onto)
      if (ancestors(repo, at).has(onto)) return 'already up to date'
      const commits = { ...repo.commits }
      let tip = onto
      for (const c of onlyIn(repo, at, onto)) {
        if ((repo.commits[c] ?? []).length > 1) continue // like git: merges are dropped
        const id = copyId(repo, commits, c)
        commits[id] = [tip]
        tip = id
      }
      return move(commits, tip)
    }
    case 'cherry-pick': {
      const c = resolve(repo, arg)
      if (c === undefined) return `unknown revision: ${arg}`
      if (ancestors(repo, at).has(c)) return `${c} is already on ${repo.head}`
      const commits = { ...repo.commits }
      const id = copyId(repo, commits, c)
      commits[id] = [at]
      return move(commits, id)
    }
    case 'reset': {
      const c = resolve(repo, arg)
      if (c === undefined) return `unknown revision: ${arg}`
      if (!reachable(repo).has(c)) return `${c} is not on any branch; cherry-pick it instead`
      if (c === at) return `${repo.head} is already at ${c}`
      return move(repo.commits, c)
    }
  }
}

/**
 * Structural fingerprint. Commit names never matter, only:
 *   - topology (parent order kept: first parent = the branch you were on),
 *   - which original each commit carries (C2, C2', C2'' all carry "C2"; anything made by
 *     `commit` carries "*", so any fresh commit matches any other),
 *   - which commit each branch points at, and HEAD.
 * Commits get numbered by a DFS from the branches in name order, which depends on nothing but
 * the structure, so equal keys <=> isomorphic graphs.
 */
export function shapeKey(repo: Repo): string {
  const index = new Map<string, number>()
  const nodes: string[] = []
  const visit = (c: string): number => {
    const known = index.get(c)
    if (known !== undefined) return known
    const i = nodes.length
    index.set(c, i)
    nodes.push('')
    nodes[i] = label(repo, c) + ':' + (repo.commits[c] ?? []).map(visit).join(',')
    return i
  }
  const names = Object.keys(repo.branches).sort()
  const tips = names.map(b => `${b}=${visit(repo.branches[b]!)}`)
  return `${nodes.join(';')}|${tips.join(',')}|${repo.head}`
}

/** What a commit carries: its original (C2' -> C2), or '*' for anything made by `commit`. */
function label(repo: Repo, c: string): string {
  const root = c.replace(/'+$/, '')
  return Number(root.slice(1)) < repo.base ? root : '*'
}

export const sameShape = (a: Repo, b: Repo): boolean => shapeKey(a) === shapeKey(b)

/** Every command worth trying from `repo` toward `target` (branch names limited to the target's: there is no `branch -d`). */
export function moves(repo: Repo, target: Repo): Command[] {
  const out: Command[] = [{ op: 'commit' }]
  const names = Object.keys(repo.branches).sort()
  for (const b of Object.keys(target.branches).sort()) if (!(b in repo.branches)) out.push({ op: 'branch', arg: b })
  for (const b of names) {
    if (b === repo.head) continue
    out.push({ op: 'checkout', arg: b }, { op: 'merge', arg: b }, { op: 'rebase', arg: b })
  }
  for (const c of Object.keys(repo.commits).sort()) out.push({ op: 'cherry-pick', arg: c })
  for (const c of [...reachable(repo)].sort()) out.push({ op: 'reset', arg: c })
  return out
}

/** Shape plus what orphans could still be cherry-picked (only their labels matter). */
function searchKey(repo: Repo): string {
  const live = reachable(repo)
  const orphans = new Set(Object.keys(repo.commits).filter(c => !live.has(c)).map(c => label(repo, c)))
  return `${shapeKey(repo)}|${[...orphans].sort().join(',')}`
}

/** Breadth-first search for a shortest command list, or null if none within maxDepth. */
export function solve(start: Repo, target: Repo, maxDepth: number): Command[] | null {
  const goal = shapeKey(target)
  if (shapeKey(start) === goal) return []
  const seen = new Set([searchKey(start)])
  let frontier: { repo: Repo; path: Command[] }[] = [{ repo: start, path: [] }]
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const nextFrontier: typeof frontier = []
    for (const { repo, path } of frontier) {
      for (const cmd of moves(repo, target)) {
        const r = apply(repo, cmd)
        if (typeof r === 'string') continue
        if (shapeKey(r) === goal) return [...path, cmd]
        const key = searchKey(r)
        if (seen.has(key)) continue
        seen.add(key)
        nextFrontier.push({ repo: r, path: [...path, cmd] })
      }
    }
    frontier = nextFrontier
  }
  return null
}

/**
 * ASCII graph. One row per branch (main first), drawn along first parents; a row forking off an
 * earlier one starts with ╰ under its parent. Columns are commit depth, so parents sit left of
 * children. Merges and branches parked on mid-row commits are spelled out on footer lines.
 *
 *   C0─C1─C2 (main*)
 *      ╰──C3 (feature)
 */
export function render(repo: Repo): string[] {
  const depth = new Map<string, number>()
  const d = (c: string): number => {
    const known = depth.get(c)
    if (known !== undefined) return known
    const v = Math.max(-1, ...(repo.commits[c] ?? []).map(d)) + 1
    depth.set(c, v)
    return v
  }
  const ids = [...reachable(repo)]
  ids.forEach(d)
  const w = Math.max(...ids.map(i => i.length)) + 1
  const col = (c: string) => d(c) * w

  const labels = new Map<string, string[]>()
  const branchOrder = Object.keys(repo.branches).sort((a, b) => Number(b === 'main') - Number(a === 'main') || a.localeCompare(b))
  for (const b of branchOrder) {
    const c = repo.branches[b]!
    labels.set(c, [...(labels.get(c) ?? []), b === repo.head ? `${b}*` : b])
  }

  const rowOf = new Map<string, number>()
  const grid: string[][] = []
  const rowTips: string[] = []
  const put = (row: string[], x: number, s: string) => {
    while (row.length < x) row.push(' ')
    for (let i = 0; i < s.length; i++) row[x + i] = s[i]!
  }
  const draw = (tip: string) => {
    if (rowOf.has(tip)) return
    const chain: string[] = []
    let c: string | undefined = tip
    while (c !== undefined && !rowOf.has(c)) {
      chain.unshift(c)
      c = repo.commits[c]?.[0]
    }
    const r = grid.length
    const row: string[] = []
    grid.push(row)
    rowTips.push(tip)
    let x = 0
    if (c !== undefined) {
      const px = col(c)
      for (let i = rowOf.get(c)! + 1; i < r; i++) {
        const ch = grid[i]![px] ?? ' '
        if (ch === ' ' || ch === '╰') put(grid[i]!, px, ch === ' ' ? '│' : '├')
      }
      put(row, px, '╰')
      x = px + 1
    }
    for (const id of chain) {
      put(row, x, '─'.repeat(Math.max(0, col(id) - x)))
      put(row, col(id), id)
      x = col(id) + id.length
      rowOf.set(id, r)
    }
  }
  for (const b of branchOrder) draw(repo.branches[b]!)
  const rest = () => ids.filter(i => !rowOf.has(i)).sort((a, b) => d(b) - d(a))
  for (let left = rest(); left.length; left = rest()) draw(left[0]!)

  const lines = grid.map((row, r) => {
    const tip = rowTips[r]!
    const names = labels.get(tip)
    return (row.join('') + (names ? ` (${names.join(', ')})` : '')).trimEnd()
  })
  for (const [c, names] of labels) if (!rowTips.includes(c)) lines.push(`(${names.join(', ')}) at ${c}`)
  for (const id of ids.sort()) {
    const ps = repo.commits[id]!
    if (ps.length > 1) lines.push(`${id} merges ${ps.slice(1).join(', ')} into ${ps[0]}`)
  }
  return lines
}

export type Save = { moves: string[] }

export const puzzle = (day: number): Puzzle => PUZZLES[((day % PUZZLES.length) + PUZZLES.length) % PUZZLES.length]!
export const fresh = (): Save => ({ moves: [] })
export const undo = (save: Save): Save => ({ moves: save.moves.slice(0, -1) })

export function current(p: Puzzle, save: Save): Repo {
  let repo = p.start
  for (const m of save.moves) {
    const r = play(repo, m)
    if (typeof r !== 'string') repo = r
  }
  return repo
}

export const status = (p: Puzzle, save: Save): 'playing' | 'won' => (sameShape(current(p, save), p.target) ? 'won' : 'playing')

export function move(p: Puzzle, save: Save, text: string): { save?: Save; note?: string } {
  if (status(p, save) === 'won') return { note: 'already holed out' }
  const r = play(current(p, save), text)
  if (typeof r === 'string') return { note: r }
  const next = { moves: [...save.moves, text.trim()] }
  return { save: next, note: sameShape(r, p.target) ? scoreWord(next.moves.length, p.par) : undefined }
}

// Par is the BFS optimum, so strokes >= par.
const scoreWord = (strokes: number, par: number): string =>
  strokes === par ? 'holed out at par. clean.' : `holed out, ${strokes - par} over par`

const strokeLine = (strokes: number, par: number): string =>
  `⛳ ${strokes} (par ${par})${strokes > par ? ` +${strokes - par}` : ' ✓'}`

export const share = (p: Puzzle, save: Save): string => strokeLine(save.moves.length, p.par)
export const shareText = (day: number, strokes: number, par: number): string => `Git Golf #${day} ${strokeLine(strokes, par)}`

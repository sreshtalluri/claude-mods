import { expect, test } from 'claude-code/testing'

import { PUZZLES } from '../hooks/games/gitgolf/data'
import {
  apply, current, format, fresh, meta, move, parse, play, puzzle, render, resolve, sameShape, share, shareText, solve, status, undo,
  type Repo,
} from '../hooks/games/gitgolf/logic'

const root: Repo = { commits: { C0: [] }, branches: { main: 'C0' }, head: 'main', next: 1, base: 1 }

function run(repo: Repo, script: string): Repo {
  for (const c of script.split(';').map(s => s.trim()).filter(Boolean)) {
    const r = play(repo, c)
    if (typeof r === 'string') throw new Error(`${c}: ${r}`)
    repo = r
  }
  return repo
}

// main: C0─C1, feature: C0─C2 (HEAD), base 3
const forked: Repo = { ...run(root, 'branch feature; commit; checkout feature; commit'), base: 3 }

test('parse accepts the subset, strips git and --hard, rejects junk', async () => {
  expect(parse('git commit')).toEqual({ op: 'commit' })
  expect(parse('  checkout   feature ')).toEqual({ op: 'checkout', arg: 'feature' })
  expect(parse('reset --hard HEAD~1')).toEqual({ op: 'reset', arg: 'HEAD~1' })
  expect(parse('cherry-pick C2')).toEqual({ op: 'cherry-pick', arg: 'C2' })
  expect(typeof parse('push origin')).toBe('string')
  expect(typeof parse('merge')).toBe('string')
  expect(typeof parse('')).toBe('string')
  expect(format({ op: 'rebase', arg: 'main' })).toBe('rebase main')
})

test('commit, branch, checkout', async () => {
  const r = run(root, 'commit; branch dev; checkout dev; commit')
  expect(r.commits).toEqual({ C0: [], C1: ['C0'], C2: ['C1'] })
  expect(r.branches).toEqual({ main: 'C1', dev: 'C2' })
  expect(r.head).toBe('dev')
  expect(typeof apply(r, { op: 'branch', arg: 'dev' })).toBe('string')
  expect(typeof apply(r, { op: 'checkout', arg: 'C1' })).toBe('string') // no detached HEAD
  expect(root.commits).toEqual({ C0: [] }) // never mutated
})

test('merge: fast-forward, true merge, already up to date', async () => {
  const ff = run(root, 'branch f; checkout f; commit; checkout main; merge f')
  expect(ff.branches.main).toBe('C1')
  const m = run(forked, 'checkout main; merge feature')
  expect(m.commits.C3).toEqual(['C1', 'C2'])
  expect(m.branches.main).toBe('C3')
  expect(play(m, 'merge feature')).toBe('already up to date')
})

test('rebase copies commits with primes; cherry-pick and reset', async () => {
  const r = run(forked, 'rebase main')
  expect(r.commits["C2'"]).toEqual(['C1'])
  expect(r.branches.feature).toBe("C2'")
  expect(r.commits.C2).toEqual(['C0']) // orphan kept for cherry-pick...
  expect(render(r).join('\n').includes('C2 ')).toBe(false) // ...but not drawn
  const c = run(forked, 'checkout main; cherry-pick feature')
  expect(c.commits["C2'"]).toEqual(['C1'])
  expect(typeof play(c, 'cherry-pick C1')).toBe('string') // already on main
  expect(resolve(c, 'HEAD~2')).toBe('C0')
  const back = run(c, 'reset HEAD^')
  expect(back.branches.main).toBe('C1')
  expect(run(back, "cherry-pick C2'").commits["C2''"]).toEqual(['C1']) // orphan pickable by hash
  expect(typeof play(back, "reset C2'")).toBe('string') // orphans are not reset targets
})

test('sameShape ignores names but not topology, labels, branches or HEAD', async () => {
  const a = run(forked, 'checkout main; commit')
  const b = run(forked, 'checkout main; cherry-pick C2; reset C1; commit') // fresh C4 vs C5: same shape
  expect(sameShape(a, b)).toBe(true)
  expect(sameShape(a, run(forked, 'checkout main; cherry-pick C2'))).toBe(false) // copy of C2 != fresh commit
  expect(sameShape(forked, run(forked, 'checkout main'))).toBe(false)
  expect(sameShape(run(forked, 'rebase main'), run(forked, 'reset C1; cherry-pick C2'))).toBe(true)
})

test('solve finds the shortest route', async () => {
  const target = run(forked, 'rebase main; checkout main; merge feature')
  expect(solve(forked, target, 3)?.length).toBe(3)
  expect(solve(forked, target, 2)).toBe(null)
  expect(solve(forked, forked, 3)).toEqual([])
})

test('every shipped puzzle is solvable in exactly its par', async () => {
  expect(PUZZLES.length >= 40).toBe(true)
  for (let i = 0; i < PUZZLES.length; i++) {
    const p = PUZZLES[i]!
    if (i > 0) expect(p.par >= PUZZLES[i - 1]!.par).toBe(true)
    expect(p.par > 0).toBe(true)
    const s = solve(p.start, p.target, p.par)
    expect(s?.length).toBe(p.par) // BFS: none shorter exists
    expect(sameShape(s!.reduce<Repo>((r, c) => apply(r, c) as Repo, p.start), p.target)).toBe(true)
  }
})

test('renderer output is stable', async () => {
  expect(render(forked)).toEqual(['C0─C1 (main)', '╰──C2 (feature*)'])
  expect(render(run(forked, 'checkout main; merge feature; branch old; checkout old; reset C1'))).toEqual([
    'C0─C1─C3 (main)',
    '╰──C2 (feature)',
    '(old*) at C1',
    'C3 merges C2 into C1',
  ])
  expect(render(run(root, 'commit; commit; branch a; checkout a; commit; checkout main; reset C1; branch b'))).toEqual([
    'C0─C1 (main*, b)',
    '   ╰──C2─C3 (a)',
  ])
  expect(render(run(root, 'branch a; branch b; checkout a; commit; checkout b; commit'))).toEqual([
    'C0 (main)',
    '├──C1 (a)',
    '╰──C2 (b*)',
  ])
})

test('game glue: moves, undo, win, share', async () => {
  expect(meta.id).toBe('gitgolf')
  expect(puzzle(0)).toBe(PUZZLES[0])
  expect(puzzle(PUZZLES.length + 3)).toBe(PUZZLES[3])
  const p = puzzle(0) // par 1: commit
  let save = fresh()
  expect(move(p, save, 'push').note?.startsWith('unknown')).toBe(true)
  save = move(p, save, 'branch x').save!
  expect(status(p, save)).toBe('playing')
  save = undo(save)
  expect(save).toEqual(fresh())
  const done = move(p, save, 'git commit')
  expect(status(p, done.save!)).toBe('won')
  expect(current(p, done.save!).branches.main).toBe('C1')
  expect(share(p, done.save!)).toBe('⛳ 1 (par 1) ✓')
  expect(shareText(12, 6, 5)).toBe('Git Golf #12 ⛳ 6 (par 5) +1')
})

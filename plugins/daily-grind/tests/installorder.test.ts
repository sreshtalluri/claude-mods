import { expect, test } from 'claude-code/testing'

import { clueText, generate, judge, meta, move, puzzle, satisfies, shareText, solutions } from '../hooks/games/installorder/logic'

test('every puzzle in the first year has exactly one answer and at least 4 clues', async () => {
  for (let day = 0; day < 365; day++) {
    const p = puzzle(day)
    expect(p.answer.length >= 5 && p.answer.length <= 7).toBe(true)
    expect(p.clues.length >= 4).toBe(true)
    const sols = solutions(p.packages, p.clues)
    expect(sols.length).toBe(1)
    expect(sols[0]!.join()).toBe(p.answer.join())
    expect(p.packages.join() === p.answer.join()).toBe(false)
  }
})

test('generator is deterministic and days differ', async () => {
  expect(JSON.stringify(puzzle(42))).toBe(JSON.stringify(generate(42)))
  expect(JSON.stringify(puzzle(42))).toBe(JSON.stringify(puzzle(42)))
  expect(JSON.stringify(puzzle(42)) === JSON.stringify(puzzle(43))).toBe(false)
})

test('clues read naturally and check positions', async () => {
  const o = ['core', 'theme', 'icons', 'ui', 'cli', 'docs']
  expect(satisfies(o, { kind: 'needs', a: 'ui', b: 'theme' })).toBe(true)
  expect(satisfies(o, { kind: 'needs', a: 'theme', b: 'ui' })).toBe(false)
  expect(satisfies(o, { kind: 'between', a: 'cli', lo: 'ui', hi: 'docs' })).toBe(true)
  expect(satisfies(o, { kind: 'within', a: 'icons', k: 3, end: 'first' })).toBe(true)
  expect(satisfies(o, { kind: 'within', a: 'icons', k: 3, end: 'last' })).toBe(false)
  expect(satisfies(o, { kind: 'adjacent', a: 'icons', b: 'theme' })).toBe(true)
  expect(satisfies(o, { kind: 'ends', a: 'docs' })).toBe(true)
  expect(satisfies(o, { kind: 'gap', a: 'docs', b: 'ui', k: 1 })).toBe(true)
  expect(clueText({ kind: 'between', a: 'cli', lo: 'ui', hi: 'docs' })).toBe('cli installs after ui but before docs')
  expect(clueText({ kind: 'within', a: 'icons', k: 3, end: 'first' })).toBe('icons is in the first three')
  expect(clueText({ kind: 'adjacent', a: 'theme', b: 'icons' })).toBe('nothing installs between theme and icons')
  expect(clueText({ kind: 'gap', a: 'a', b: 'b', k: 1 })).toBe('exactly one package installs between a and b')
  expect(meta.id).toBe('installorder')
})

test('feedback names exactly the broken clues', async () => {
  const p = puzzle(12)
  expect(judge(p, p.answer)).toEqual({ solved: true, violated: [] })
  const wrong = [...p.answer].reverse()
  const { solved, violated } = judge(p, wrong)
  expect(solved).toBe(false)
  expect(violated.length > 0).toBe(true)
  p.clues.forEach((c, i) => expect(violated.includes(i)).toBe(!satisfies(wrong, c)))
  expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  const share = shareText(p, [violated, []])
  expect(share.split('\n')[0]).toBe('Install Order #12 📦 2 tries')
  expect(share.split('\n').length).toBe(3)
})

// Dev-time check, not imported by the mod: runs every puzzle's buggy and fixed code against its clues.
// Buggy code must produce each clue's `actual` (and differ from `expected`); fixed code must produce `expected`.
// Usage: bun plugins/daily-grind/hooks/games/heisenbug/verify.mjs   (needs bun for .ts import + transpiling; python3 for Python)
import { spawnSync } from 'node:child_process'
import { PUZZLES } from './data.ts'

const tsc = new Bun.Transpiler({ loader: 'ts' })

const fmt = v =>
  v === undefined ? 'undefined'
  : typeof v === 'number' ? (Object.is(v, -0) ? '0' : String(v))
  : typeof v === 'string' ? JSON.stringify(v)
  : Array.isArray(v) ? '[' + v.map(fmt).join(', ') + ']'
  : v && typeof v === 'object' ? (Object.keys(v).length ? '{ ' + Object.entries(v).map(([k, x]) => k + ': ' + fmt(x)).join(', ') + ' }' : '{}')
  : String(v)

const runJs = (lang, lines, input) => {
  let code = lines.join('\n')
  if (lang === 'typescript') code = tsc.transformSync(code)
  try {
    return fmt(new Function(code + '\nreturn (' + input + ')')())
  } catch (e) {
    return 'throws ' + e.constructor.name
  }
}

const PY = `
import json, sys
out = []
for job in json.load(sys.stdin):
    try:
        ns = {}
        exec(job['code'], ns)
        out.append(repr(eval(job['input'], ns)))
    except Exception as e:
        out.append('throws ' + type(e).__name__)
print(json.dumps(out))
`

const jobs = [] // { i, variant, input, want }
PUZZLES.forEach((pz, i) => {
  const fixed = pz.lines.map((l, j) => (j === pz.bugLine ? pz.fix : l))
  for (const c of pz.clues) {
    jobs.push({ i, lang: pz.lang, variant: 'buggy', lines: pz.lines, input: c.input, want: c.actual })
    jobs.push({ i, lang: pz.lang, variant: 'fixed', lines: fixed, input: c.input, want: c.expected })
  }
})

const py = jobs.filter(j => j.lang === 'python')
const res = spawnSync('python3', ['-c', PY], { input: JSON.stringify(py.map(j => ({ code: j.lines.join('\n'), input: j.input }))) })
if (res.status !== 0) throw new Error(String(res.stderr))
JSON.parse(String(res.stdout)).forEach((got, k) => (py[k].got = got))
for (const j of jobs) if (j.lang !== 'python') j.got = runJs(j.lang, j.lines, j.input)

const bad = jobs.filter(j => j.got !== j.want)
for (const j of bad) console.log(`#${j.i} ${PUZZLES[j.i].title} [${j.variant}] ${j.input}\n   want ${j.want}\n   got  ${j.got}`)
for (const [i, pz] of PUZZLES.entries()) {
  if (pz.clues.some(c => c.expected === c.actual)) console.log(`#${i} ${pz.title}: a clue does not fail`)
  if (pz.lines.length < 8 || pz.lines.length > 15) console.log(`#${i} ${pz.title}: ${pz.lines.length} lines`)
}
const by = l => PUZZLES.filter(p => p.lang === l).length
console.log(`${PUZZLES.length} puzzles (js ${by('javascript')}, ts ${by('typescript')}, py ${by('python')}); ${jobs.length} runs, ${bad.length} mismatches`)
process.exit(bad.length ? 1 : 0)

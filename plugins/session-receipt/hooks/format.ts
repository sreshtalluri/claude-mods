import type { ReceiptStats } from '../types'

export const WIDTH = 34
export const RULE = '-'.repeat(WIDTH)
export const DOUBLE_RULE = '='.repeat(WIDTH)

export const emptyStats = (): ReceiptStats => ({
  turns: 0,
  interrupts: 0,
  toolCalls: 0,
  failedCalls: 0,
  deniedCalls: 0,
  toolCounts: {},
  editCounts: {},
  longest: null,
  tokensIn: 0,
  tokensOut: 0,
  cacheRead: 0,
  cacheWrite: 0,
  absolutelyRight: 0,
  apologies: 0,
})

export type ReceiptInput = {
  stats: ReceiptStats
  usd: number | null
  startedAt: number
  now: number
  cwd: string
  sessionId: string
  number: number
  model: string | null
}

/** Where to get one: the receipt's small print, so a shared screenshot says it. */
export const CREDIT = 'sreshtalluri/claude-mods'

/** `claude-opus-5-5[1m]` reads as `OPUS 5.5` on a receipt; anything else, as given. */
export const prettyModel = (model: string): string => {
  const m = /(opus|sonnet|haiku|fable)-(\d+)(?:-(\d{1,2}))?(?!\d)/i.exec(model)
  return (m ? `${m[1]} ${m[2]}${m[3] ? '.' + m[3] : ''}` : model.replace(/\[.*\]$/, '')).toUpperCase()
}

const ABSOLUTELY_RIGHT = /you'?re (absolutely|completely|totally) right/gi
const APOLOGY = /\b(i apologi[sz]e|my apologies|sorry about that|i'm sorry)\b/gi

export const countMatches = (text: string, re: RegExp): number =>
  (text.match(re) ?? []).length

export const countAbsolutelyRight = (text: string) => countMatches(text, ABSOLUTELY_RIGHT)
export const countApologies = (text: string) => countMatches(text, APOLOGY)

/** Left label, right value, dots in between, exactly WIDTH wide. */
export const row = (label: string, rawValue: string): string => {
  const max = WIDTH - 10
  const value = rawValue.length > max ? '~' + rawValue.slice(rawValue.length - max + 1) : rawValue
  const room = WIDTH - value.length - 1
  const left = label.length > room - 1 ? label.slice(0, room - 2) + '~' : label
  const dots = Math.max(1, WIDTH - left.length - value.length)
  return left + (dots > 2 ? ' ' + '.'.repeat(dots - 2) + ' ' : ' '.repeat(dots)) + value
}

export const center = (text: string): string => {
  const t = text.length > WIDTH ? text.slice(0, WIDTH) : text
  const pad = Math.floor((WIDTH - t.length) / 2)
  return ' '.repeat(pad) + t + ' '.repeat(WIDTH - t.length - pad)
}

export const compact = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'k'
  return String(n)
}

export const duration = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export const stamp = (ms: number): string => {
  const d = new Date(ms)
  const h = d.getHours()
  const hh = String(h % 12 === 0 ? 12 : h % 12)
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}  ${hh}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

/** mcp__github__create_issue reads as github.create_issue on a receipt. */
export const shortTool = (tool: string): string => {
  const parts = tool.split('__')
  return parts[0] === 'mcp' && parts.length >= 3 ? `${parts[1]}.${parts.slice(2).join('__')}` : tool
}

const basename = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path

/** A fake barcode that is stable per session id, for the screenshot. */
export const barcode = (seed: string): string => {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  const glyphs = ['|', '|', '||', ' ', '|', '| ', '|||', ' ']
  let out = ''
  while (out.length < WIDTH - 4) {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0
    out += glyphs[hash % glyphs.length]
  }
  return center(out.slice(0, WIDTH - 4))
}

/** Footer, barcode and small print: how every slip ends. */
const close = (push: (line: string) => void, thanks: string, seed: string) => {
  push(center(thanks))
  push(barcode(seed))
  push(center(CREDIT))
}

const footer = (s: ReceiptStats): string => {
  if (s.absolutelyRight >= 3) return 'YOU WERE ABSOLUTELY RIGHT'
  if (s.failedCalls >= 10) return 'IT WORKED ON MY MACHINE'
  if (s.toolCalls === 0) return 'JUST HERE TO TALK'
  if (s.interrupts >= 3) return 'PATIENCE IS A VIRTUE'
  return 'THANK YOU, COME AGAIN'
}

/** The receipt as plain lines, every one exactly WIDTH wide. */
export const formatReceipt = (r: ReceiptInput): string[] => {
  const s = r.stats
  const lines: string[] = []
  const push = (line: string) => lines.push(line.padEnd(WIDTH))

  push(center('*  SESSION RECEIPT  *'))
  push(center('CLAUDE CODE'))
  push(center(`RECEIPT #${String(r.number).padStart(4, '0')}`))
  push(center(stamp(r.now)))
  push(center(basename(r.cwd) || '~'))
  if (r.model) push(center(`SERVED BY ${prettyModel(r.model)}`))
  push(RULE)

  const tools = Object.entries(s.toolCounts).sort((a, b) => b[1] - a[1])
  if (tools.length === 0) {
    push(center('(no tools were harmed)'))
  } else {
    for (const [tool, count] of tools.slice(0, 6)) push(row(shortTool(tool), `x${count}`))
    if (tools.length > 6) {
      const rest = tools.slice(6).reduce((n, [, c]) => n + c, 0)
      push(row(`+${tools.length - 6} MORE`, `x${rest}`))
    }
  }
  push(RULE)

  const files = Object.entries(s.editCounts).sort((a, b) => b[1] - a[1])
  const totalIn = s.tokensIn + s.cacheRead + s.cacheWrite
  const cacheHit = totalIn > 0 ? Math.round((s.cacheRead / totalIn) * 100) : 0

  push(row('TIME', duration(r.now - r.startedAt)))
  push(row('TURNS', String(s.turns)))
  push(row('TOOL CALLS', String(s.toolCalls)))
  push(row('FILES CHANGED', String(files.length)))
  if (files[0]) push(row('MOST EDITED', `${basename(files[0][0])} x${files[0][1]}`))
  if (s.longest) {
    const wait = s.longest.ms < 10_000 ? `${(s.longest.ms / 1000).toFixed(1)}s` : duration(s.longest.ms)
    push(row('LONGEST WAIT', `${shortTool(s.longest.tool)} ${wait}`))
  }
  push(row('FAILED CALLS', String(s.failedCalls)))
  if (s.deniedCalls > 0) push(row('DENIED', String(s.deniedCalls)))
  push(row('TOKENS IN', compact(totalIn)))
  push(row('TOKENS OUT', compact(s.tokensOut)))
  push(row('CACHE HIT', `${cacheHit}%`))
  push(RULE)
  push(row('"ABSOLUTELY RIGHT"', `x${s.absolutelyRight}`))
  push(row('APOLOGIES', `x${s.apologies}`))
  push(row('INTERRUPTIONS', `x${s.interrupts}`))
  push(DOUBLE_RULE)
  push(row('TOTAL', r.usd === null ? 'n/a' : `$${r.usd.toFixed(2)}`))
  push(DOUBLE_RULE)
  close(push, footer(s), `${r.sessionId}:${r.startedAt}:${r.number}`)

  return lines
}

/** Lines the drawing styles differently, by exact content. */
export const isRule = (line: string) => line === RULE || line === DOUBLE_RULE
export const isTotal = (line: string) => line.startsWith('TOTAL')
export const isCredit = (line: string) => line.trim() === CREDIT
const isBarcode = (line: string) => line.includes('|') && /^[| ]+$/.test(line)

/** The receipt's lines out of a CommandOutput row: what sits between the ``` fences. */
export const slipLines = (text: string): string[] => {
  const lines = text.split('\n')
  const open = lines.findIndex(l => l.includes('```'))
  const close = lines.findLastIndex(l => l.includes('```'))
  return close > open && open >= 0 ? lines.slice(open + 1, close) : lines
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The receipt as a paper slip for surfaces that draw SVG (desktop, mobile).
 * Rules and the barcode are drawn as shapes, so only the text depends on the
 * font being monospace.
 */
export const receiptSvg = (lines: string[], { backdrop = false } = {}): string => {
  const FS = 13
  const CW = FS * 0.6 // monospace advance
  const LH = 19
  const PAD = 18
  const TOOTH = 7
  const w = Math.round(PAD * 2 + WIDTH * CW)
  const bodyH = PAD * 2 + lines.length * LH
  const h = bodyH + TOOTH * 2

  // Torn edges: a zigzag along the top and bottom.
  const teeth = Math.round(w / (TOOTH * 2))
  const step = w / teeth
  const f = (n: number) => +n.toFixed(1)
  let edge = `M0 ${TOOTH}`
  for (let i = 0; i < teeth; i++) edge += ` L${f((i + 0.5) * step)} 0 L${f((i + 1) * step)} ${TOOTH}`
  edge += ` L${w} ${h - TOOTH}`
  for (let i = teeth; i > 0; i--) edge += ` L${f((i - 0.5) * step)} ${h} L${f((i - 1) * step)} ${h - TOOTH}`
  edge += ' Z'

  const body = lines.map((line, i) => {
    const y = TOOTH + PAD + i * LH
    const mid = y + LH / 2
    if (line === RULE) return `<line x1="${PAD}" x2="${w - PAD}" y1="${mid}" y2="${mid}" stroke="#9a968c" stroke-dasharray="4 3"/>`
    if (line === DOUBLE_RULE)
      return `<line x1="${PAD}" x2="${w - PAD}" y1="${mid - 2}" y2="${mid - 2}" stroke="#2b2a27"/><line x1="${PAD}" x2="${w - PAD}" y1="${mid + 2}" y2="${mid + 2}" stroke="#2b2a27"/>`
    if (isBarcode(line))
      return [...line]
        .map((c, j) => (c === '|' ? `<rect x="${(PAD + j * CW).toFixed(1)}" y="${y - 2}" width="${(CW * 0.55).toFixed(1)}" height="${LH + 1}" fill="#2b2a27"/>` : ''))
        .join('')
    const style =
      i === 0 ? ' font-weight="700"'
      : isTotal(line) ? ' font-weight="700" fill="#1f7a3a"'
      : isCredit(line) ? ` fill="#6b675e" font-size="${FS - 2}"`
      : ''
    // Centered lines anchor on the middle; rows are stretched to the slip's
    // width, so the dot leaders line up whatever monospace the surface has.
    const text = line.trimEnd()
    return line.startsWith(' ')
      ? `<text x="${w / 2}" y="${y + FS}" text-anchor="middle"${style}>${xml(text.trim())}</text>`
      : `<text x="${PAD}" y="${y + FS}" textLength="${(text.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs"${style}>${xml(text)}</text>`
  })

  const slip =
    `<path d="${edge}" fill="#000" opacity="0.18" transform="translate(0 3)"/>` +
    `<path d="${edge}" fill="#fbf9f3"/>` +
    `<g font-family="ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace" font-size="${FS}" fill="#2b2a27" xml:space="preserve" style="white-space:pre">` +
    body.join('') +
    '</g>'
  // The shareable image: the slip centred on a dark square, the shape feeds crop to.
  const side = Math.max(w, h) + 80
  return backdrop
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 ${side} ${side}">` +
        `<rect width="${side}" height="${side}" fill="#1f1e1c"/>` +
        `<g transform="translate(${Math.round((side - w) / 2)} ${Math.round((side - h) / 2)})">${slip}</g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + 12}" viewBox="0 0 ${w} ${h + 12}">${slip}</svg>`
}

/** `2026-10-03-claude-mods-0042.txt`: sorts by date, says where and which. */
export const receiptFileName = (now: number, cwd: string, number: number): string => {
  const d = new Date(now)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const project = (basename(cwd) || 'home').replace(/[^\w.-]+/g, '_')
  return `${date}-${project}-${String(number).padStart(4, '0')}.txt`
}

/** A Bash command that ships something: a commit or a new PR. */
export const isShipCommand = (command: string) => /\bgit\s+commit\b|\bgh\s+pr\s+create\b/.test(command)

/** One finished session, kept for `/receipt week`. */
export type SessionSummary = {
  at: number
  ms: number
  usd: number
  turns: number
  toolCalls: number
  files: number
  tokensIn: number
  tokensOut: number
  absolutelyRight: number
  apologies: number
  project: string
  model: string | null
  toolCounts: Record<string, number>
}

export const DAY = 86_400_000

export const summarize = (s: ReceiptStats, r: Omit<ReceiptInput, 'stats' | 'sessionId' | 'number'>): SessionSummary => ({
  at: r.now,
  ms: r.now - r.startedAt,
  usd: r.usd ?? 0,
  turns: s.turns,
  toolCalls: s.toolCalls,
  files: Object.keys(s.editCounts).length,
  tokensIn: s.tokensIn + s.cacheRead + s.cacheWrite,
  tokensOut: s.tokensOut,
  absolutelyRight: s.absolutelyRight,
  apologies: s.apologies,
  project: basename(r.cwd) || '~',
  model: r.model,
  toolCounts: s.toolCounts,
})

const top = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1])

/** The last seven days as one slip, every line exactly WIDTH wide. */
export const formatWeek = (sessions: SessionSummary[], now: number): string[] => {
  const week = sessions.filter(x => now - x.at < 7 * DAY)
  const lines: string[] = []
  const push = (line: string) => lines.push(line.padEnd(WIDTH))
  const sum = (f: (x: SessionSummary) => number) => week.reduce((n, x) => n + f(x), 0)
  const tally = (key: (x: SessionSummary) => string | null, weight: (x: SessionSummary) => number = () => 1) => {
    const out: Record<string, number> = {}
    for (const x of week) {
      const k = key(x)
      if (k) out[k] = (out[k] ?? 0) + weight(x)
    }
    return out
  }
  const tools: Record<string, number> = {}
  for (const x of week) for (const [t, c] of Object.entries(x.toolCounts)) tools[t] = (tools[t] ?? 0) + c

  push(center('*  WEEKLY RECEIPT  *'))
  push(center('CLAUDE CODE'))
  push(center(`${stamp(now - 6 * DAY).slice(4, 10).trim()} - ${stamp(now).slice(4, 10).trim()}`))
  push(RULE)

  const ranked = top(tools)
  if (ranked.length === 0) push(center('(no tools were harmed)'))
  for (const [tool, count] of ranked.slice(0, 5)) push(row(shortTool(tool), `x${count}`))
  push(RULE)

  const busiest = top(tally(x => DAYS[new Date(x.at).getDay()] ?? null, x => x.ms))[0]
  const project = top(tally(x => x.project, x => x.ms))[0]
  const model = top(tally(x => (x.model ? prettyModel(x.model) : null), x => x.ms))[0]
  push(row('SESSIONS', String(week.length)))
  push(row('TIME', duration(sum(x => x.ms))))
  push(row('TURNS', String(sum(x => x.turns))))
  push(row('TOOL CALLS', String(sum(x => x.toolCalls))))
  push(row('FILES CHANGED', String(sum(x => x.files))))
  if (busiest) push(row('BUSIEST DAY', busiest[0]))
  if (project) push(row('TOP PROJECT', project[0]))
  if (model) push(row('USUAL ORDER', model[0]))
  push(row('TOKENS IN', compact(sum(x => x.tokensIn))))
  push(row('TOKENS OUT', compact(sum(x => x.tokensOut))))
  push(RULE)
  push(row('"ABSOLUTELY RIGHT"', `x${sum(x => x.absolutelyRight)}`))
  push(row('APOLOGIES', `x${sum(x => x.apologies)}`))
  push(DOUBLE_RULE)
  push(row('TOTAL', `$${sum(x => x.usd).toFixed(2)}`))
  push(DOUBLE_RULE)
  close(push, week.length >= 20 ? 'SEE YOU TOMORROW' : 'THANK YOU, COME AGAIN', `week:${week.map(x => x.at).join(',')}`)
  return lines
}

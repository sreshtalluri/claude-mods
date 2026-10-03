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
  push(center(footer(s)))
  push(barcode(`${r.sessionId}:${r.startedAt}:${r.number}`))

  return lines
}

/** Lines the drawing styles differently, by exact content. */
export const isRule = (line: string) => line === RULE || line === DOUBLE_RULE
export const isTotal = (line: string) => line.startsWith('TOTAL')

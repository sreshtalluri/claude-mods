import type { SideBetMarket, SideBetOffer, SideBetPick, SideBetResult, SideBetSide, SideBetSlip } from '../types'

export const STAKE = 100
export const FLOOR = 1000
export const EDGE = 0.05
export const DAY = 86_400_000
const HISTORY = 50

export type Rate = { hits: number; n: number }
export type Rates = { tests: Rate; ask: Rate; files: number[] }
export type BetRecord = { wins: number; losses: number; voids: number; streak: number; bestWin: number; implied: number }
export type Book = { chips: number; day: number; rates: Rates; record: BetRecord }
/** What a turn did. `tests` is null when no test command ran. */
export type Observed = { tests: boolean | null; files: number; asked: boolean }

export const newBook = (): Book => ({
  chips: FLOOR,
  day: -1,
  rates: { tests: { hits: 0, n: 0 }, ask: { hits: 0, n: 0 }, files: [] },
  record: { wins: 0, losses: 0, voids: 0, streak: 0, bestWin: 0, implied: 0 },
})

/** A stored book, missing fields filled from a new one. */
export const loadBook = (raw: unknown): Book => {
  const b = (raw ?? {}) as Partial<Book>
  const d = newBook()
  return { ...d, ...b, rates: { ...d.rates, ...b.rates }, record: { ...d.record, ...b.record } }
}

/** Once a UTC day, a bankroll under the floor is topped back up to it. */
export const refill = (book: Book, now: number): Book => {
  const day = Math.floor(now / DAY)
  return book.day === day ? book : { ...book, day, chips: Math.max(book.chips, FLOOR) }
}

const LAUNCH = String.raw`(?:(?:npx|bunx|uvx|pnpm(?:\s+exec)?|yarn|poetry\s+run|uv\s+run|pipenv\s+run|python3?\s+-m)\s+)?`
const RUNNER = String.raw`(?:jest|vitest|mocha|pytest|tox|nox|rspec|phpunit|ava|playwright\s+test)`
const SUBCMD = String.raw`(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|(?:cargo|go|bun|deno|dotnet|mix|swift)\s+test|cargo\s+nextest|make\s+(?:test|check)|(?:\./)?gradlew?\s+test|mvn\s+test|python3?\s+-m\s+unittest|claude\s+plugin\s+test)`
// ponytail: regex at command position (start, after ; & | or env assignments); a custom script name is missed.
const TEST = new RegExp(String.raw`(?:^|[;&|(]\s*)(?:\w+=\S+\s+)*(?:${SUBCMD}|${LAUNCH}${RUNNER})(?![\w-])`)

export const isTestCommand = (command: string) => TEST.test(command.trim())

/** Laplace-smoothed base rate. */
export const chance = (hits: number, n: number) => (hits + 1) / (n + 2)

/** What a winning stake returns at probability `p`, less the house edge; `p` kept off the extremes. */
export const payout = (p: number, stake = STAKE) => Math.round((stake * (1 - EDGE)) / Math.min(0.9, Math.max(0.05, p)))

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length === 0 ? null : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** The over/under line: the median files touched, on a half so it never pushes. */
export const fileLine = (history: number[]) => {
  const m = median(history)
  return m === null ? 2.5 : Math.floor(m) + 0.5
}

const pick = (market: SideBetMarket, side: SideBetSide, label: string, p: number, line?: number): SideBetPick => ({
  market, side, label, p, payout: payout(p), ...(line === undefined ? {} : { line }),
})

export const offers = (r: Rates): SideBetOffer[] => {
  const tests = chance(r.tests.hits, r.tests.n)
  const ask = chance(r.ask.hits, r.ask.n)
  const line = fileLine(r.files)
  const over = chance(r.files.filter(n => n > line).length, r.files.length)
  return [
    { market: 'tests', title: 'Tests pass?', picks: [pick('tests', 'yes', 'Yes', tests), pick('tests', 'no', 'No', 1 - tests)] },
    { market: 'files', title: `Files touched, ${line}`, picks: [pick('files', 'over', 'Over', over, line), pick('files', 'under', 'Under', 1 - over, line)] },
    { market: 'ask', title: 'Asks permission?', picks: [pick('ask', 'yes', 'Yes', ask), pick('ask', 'no', 'No', 1 - ask)] },
  ]
}

/** The side that won a market, or 'void' (no test command ran). */
export const winner = (bet: SideBetPick, o: Observed): SideBetSide | 'void' =>
  bet.market === 'tests' ? (o.tests === null ? 'void' : o.tests ? 'yes' : 'no')
  : bet.market === 'ask' ? (o.asked ? 'yes' : 'no')
  : o.files > (bet.line ?? 2.5) ? 'over' : 'under'

const SHORT: Record<SideBetMarket, string> = { tests: 'Tests', files: 'Files', ask: 'Ask' }

/**
 * Pays out the turn's bets (stakes were taken when placed). `o` null voids all:
 * an aborted or errored turn. Returns the new book, the net and one line per bet.
 */
export const settle = (book: Book, bets: SideBetPick[], o: Observed | null) => {
  let { chips } = book
  const rec = { ...book.record }
  let net = 0
  const results: SideBetResult[] = []
  const lines = bets.map(bet => {
    const won = o === null ? 'void' : winner(bet, o)
    const name = `${SHORT[bet.market]} ${bet.label}`
    if (won === 'void') {
      chips += STAKE
      rec.voids += 1
      results.push({ bet, outcome: 'void', delta: 0 })
      return `${name} void`
    }
    rec.implied += bet.p
    if (won === bet.side) {
      chips += bet.payout
      net += bet.payout - STAKE
      rec.wins += 1
      rec.streak = Math.max(rec.streak, 0) + 1
      rec.bestWin = Math.max(rec.bestWin, bet.payout - STAKE)
      results.push({ bet, outcome: 'won', delta: bet.payout - STAKE })
      return `${name} won +${bet.payout - STAKE}`
    }
    net -= STAKE
    rec.losses += 1
    rec.streak = Math.min(rec.streak, 0) - 1
    results.push({ bet, outcome: 'lost', delta: -STAKE })
    return `${name} lost -${STAKE}`
  })
  return { book: { ...book, chips, record: rec }, net, lines, results }
}

/** Folds a finished turn into the base rates the odds come from. */
export const learn = (r: Rates, o: Observed): Rates => ({
  tests: o.tests === null ? r.tests : { hits: r.tests.hits + (o.tests ? 1 : 0), n: r.tests.n + 1 },
  ask: { hits: r.ask.hits + (o.asked ? 1 : 0), n: r.ask.n + 1 },
  files: [...r.files, o.files].slice(-HISTORY),
})

const pct = (x: number) => `${Math.round(x * 100)}%`
const fmt = (n: number) => n.toLocaleString('en-US')

/** A pick's price in cents: its implied probability, as a prediction market quotes it. */
export const cents = (p: number) => `${Math.min(99, Math.max(1, Math.round(p * 100)))}¢`
export const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '±0')
export const MARK: Record<SideBetResult['outcome'], string> = { won: '✓', lost: '✗', void: '○' }

/** Rows in a rounded frame, `title` and `tag` set into the top rule. */
export const boxed = (title: string, tag: string, rows: string[], foot?: string) => {
  const c = Math.max(title.length + tag.length + 5, ...rows.map(r => r.length), foot?.length ?? 0)
  const line = (r: string) => `│ ${r.padEnd(c)} │`
  return [
    `╭─ ${title} ${'─'.repeat(c - title.length - tag.length - 4)} ${tag} ─╮`,
    ...rows.map(line),
    ...(foot ? [`├${'─'.repeat(c + 2)}┤`, line(foot)] : []),
    `╰${'─'.repeat(c + 2)}╯`,
  ]
}

const SLIP_NAME: Record<SideBetMarket, string> = { tests: 'Tests pass', files: 'Files o/u', ask: 'Asks perm.' }

/** A settled turn as a bet slip. */
export const formatSlip = (s: SideBetSlip) =>
  boxed('BET SLIP', s.isVoid ? 'REFUNDED' : 'SETTLED', s.results.map(({ bet, outcome, delta }) =>
    `${MARK[outcome]} ${`${SLIP_NAME[bet.market]}${bet.line === undefined ? '' : ` ${bet.line}`}`.padEnd(14)} ${bet.label.toUpperCase().padEnd(5)} @ ${cents(bet.p).padStart(3)}  ${(outcome === 'void' ? 'void' : signed(delta)).padStart(5)}`),
  `Net ${signed(s.net)} · bankroll ${fmt(s.chips)}`)

export const formatStats = (b: Book) => {
  const { wins, losses, voids, streak, bestWin, implied } = b.record
  const decided = wins + losses
  const { tests, ask, files } = b.rates
  return boxed('SIDE BET', 'PLAY MONEY', [
    `Bankroll     ${fmt(b.chips)} chips (tops up to ${fmt(FLOOR)} daily)`,
    `Record       ${wins}W ${losses}L ${voids} void${streak ? ` · streak ${streak > 0 ? 'W' : 'L'}${Math.abs(streak)}` : ''}`,
    `Best win     ${bestWin ? `+${bestWin}` : 'none yet'}`,
    `Calibration  ${decided ? `won ${pct(wins / decided)} of ${decided} decided; prices implied ${pct(implied / decided)}` : 'no decided bets yet'}`,
    `Base rates   tests ${tests.hits}/${tests.n} passed · asked ${ask.hits}/${ask.n} · median files ${median(files) ?? 'n/a'}`,
  ], 'Play money only: never bought, never cashed out')
}

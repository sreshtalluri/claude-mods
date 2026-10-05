export type SideBetMarket = 'tests' | 'files' | 'ask'
export type SideBetSide = 'yes' | 'no' | 'over' | 'under'

/** One side of a market at the odds offered: `payout` is what a winning stake returns, stake included. */
export type SideBetPick = { market: SideBetMarket; side: SideBetSide; label: string; p: number; payout: number; line?: number }
export type SideBetOffer = { market: SideBetMarket; title: string; picks: [SideBetPick, SideBetPick] }

export type SideBetResult = { bet: SideBetPick; outcome: 'won' | 'lost' | 'void'; delta: number }
/** A settled turn: `isVoid` when it was cut short and every stake came back. */
export type SideBetSlip = { results: SideBetResult[]; net: number; chips: number; isVoid: boolean }

/** The book for the next or current turn, for the band; `turnId` is null until that turn starts; `last` the previous turn's slip. */
export type SideBetRound = { turnId: string | null; isOpen: boolean; offers: SideBetOffer[]; bets: SideBetPick[]; chips: number; last?: SideBetSlip }

declare module 'claude-code' {
  interface PluginState {
    'side-bet': { round: SideBetRound | null }
  }
}

export type NextAsksIdeas = string[]

declare module 'claude-code' {
  interface PluginState {
    'next-asks': { ideas: NextAsksIdeas; isHidden: boolean; isSearching: boolean }
  }
}

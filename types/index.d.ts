export type Level = 'beginner' | 'intermediate' | 'expert'

declare module 'claude-code' {
  interface PluginState {
    'matt-flow': {
      // The session's working directory: the key progress is stored under.
      project: string | null
      level: Level
      // Step keys finished this round.
      done: string[]
      // Rounds finished before this one.
      rounds: number
      // Whether /setup-matt-pocock-skills has run in this project.
      isSetUp: boolean
      // Input tokens of the last response, null until one arrives.
      tokens: number | null
      // Promoted skills edited since README, plugin.json, docs or ask-matt were last touched.
      unsynced: string[]
    }
  }
}

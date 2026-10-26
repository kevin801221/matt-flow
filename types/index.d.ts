export type Level = 'beginner' | 'intermediate' | 'expert'

// A step with no state has not passed yet.
export type StepState = 'passed' | 'skipped'

// One project's progress, kept across sessions under its working directory.
export type Progress = {
  level: Level
  // By step key. Building has started once the build step is passed or skipped.
  steps: Record<string, StepState>
  // The feature under way: `name` is its spec's folder once there is one,
  // `since` when it started, so only artifacts written after it count.
  feature: { name: string | null; since: number } | null
  // Whether code-review has run since building started.
  isReviewed: boolean
  // Whether the person turned the rail off in this project.
  isOff: boolean
  // Features finished before this one.
  features: number
}

declare module 'claude-code' {
  interface PluginState {
    'matt-flow': {
      // The session's working directory: the key progress is stored under.
      project: string | null
      progress: Progress
      // Whether /setup-matt-pocock-skills has run in this project.
      isSetUp: boolean
      // Input tokens of the last response, null until one arrives.
      tokens: number | null
      // Promoted skills edited since README, plugin.json, docs or ask-matt were last touched.
      unsynced: string[]
    }
  }
}

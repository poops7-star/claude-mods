export type Column = {
  name: string
  kind: 'number' | 'date' | 'text' | 'empty'
  missing: number
  distinct: number
  min?: number
  max?: number
  mean?: number
  spark?: string
  sample?: string
}

export type Profile = {
  path: string
  rows: number
  isTruncated: boolean
  columns: Column[]
}

export type Peek = Profile | { path: string; error: string }

declare module 'claude-code' {
  interface PluginState {
    'data-peek': { peek: Shaped<Peek | null> }
  }
}

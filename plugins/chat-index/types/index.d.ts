export type Row = { date: string; title: string; about: string }

export type Draft =
  | { status: 'idle' }
  | { status: 'drafting' }
  | { status: 'ready'; row: Row }
  | { status: 'error'; reason: string }
  | { status: 'added'; row: Row }

declare module 'claude-code' {
  interface PluginState {
    'chat-index': { draft: Shaped<Draft>; turns: number }
  }
}

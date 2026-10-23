export type Lang = 'he' | 'ru' | 'en'
export type Mismatch = { asked: Lang; got: Lang }

declare module 'claude-code' {
  interface PluginState {
    'lang-guard': { asked: Lang | null; mismatch: Mismatch | null }
  }
}

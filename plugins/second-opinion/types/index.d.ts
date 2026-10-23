export type Review =
  | { status: 'idle' }
  | { status: 'loading'; model: string }
  | { status: 'done'; model: string; text: string }
  | { status: 'error'; model: string; reason: string }

declare module 'claude-code' {
  interface PluginState {
    'second-opinion': { review: Shaped<Review> }
  }
}

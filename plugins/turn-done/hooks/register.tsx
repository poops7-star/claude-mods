import type { Register } from 'claude-code'

const LONG_MS = 60_000

export function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')} דק׳` : `${s} שנ׳`
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || e.isAborted || e.durationMs < LONG_MS) return result

    const text = `סיימתי אחרי ${duration(e.durationMs)}`
    $.ui.toast(text, { timeoutMs: 8000 })
    try {
      await $.ui.notify(text, { title: 'Claude' })
    } catch {}
    return result
  })
}

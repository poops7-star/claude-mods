import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])

const WIDTH = 20
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

// Israel time without relying on Intl tz data: DST runs from the Friday
// before the last Sunday of March, 02:00, to the last Sunday of October, 02:00.
function lastSunday(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0))
  return d.getUTCDate() - d.getUTCDay()
}

function israelOffsetHours(ms: number): number {
  const year = new Date(ms).getUTCFullYear()
  const start = Date.UTC(year, 2, lastSunday(year, 2) - 2, 0) // 02:00 IST = 00:00 UTC
  const end = Date.UTC(year, 9, lastSunday(year, 9) - 1, 23) // 02:00 IDT = 23:00 UTC the day before
  return ms >= start && ms < end ? 3 : 2
}

function israelParts(ms: number) {
  let tz: { y: number; m: number; d: number; wd: number; hh: number; mm: number } | null = null
  try {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    })
    const p: Record<string, string> = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
    const num = (k: string) => Number(p[k] ?? NaN)
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday ?? '')
    const parts = { y: num('year'), m: num('month'), d: num('day'), wd, hh: num('hour'), mm: num('minute') }
    if (wd >= 0 && Object.values(parts).every(Number.isFinite)) tz = parts
  } catch {}
  if (tz) return tz
  const local = new Date(ms + israelOffsetHours(ms) * 3600_000)
  return {
    y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(),
    wd: local.getUTCDay(), hh: local.getUTCHours(), mm: local.getUTCMinutes(),
  }
}

function dayNumber(p: { y: number; m: number; d: number }): number {
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000)
}

export function resetLabel(resetsAt: string | undefined, now: number): string {
  const at = resetsAt ? Date.parse(resetsAt) : NaN
  if (Number.isNaN(at)) return ''
  if (at <= now) return 'מתאפס עכשיו'
  const r = israelParts(at)
  const n = israelParts(now)
  const time = `${String(r.hh).padStart(2, '0')}:${String(r.mm).padStart(2, '0')}`
  const diff = dayNumber(r) - dayNumber(n)
  if (diff === 0) return `מתאפס היום ב-${time}`
  if (diff === 1) return `מתאפס מחר ב-${time}`
  if (diff < 7) return `מתאפס ביום ${DAYS[r.wd]} ב-${time}`
  return `מתאפס ב-${r.d}.${r.m} ב-${time}`
}

function bar(percent: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((percent / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function colorFor(percent: number): string {
  if (percent >= 90) return 'error'
  if (percent >= 70) return 'warning'
  return 'success'
}

function keep(rateLimits: readonly Limit[]): Limit[] {
  return rateLimits
    .filter(l => l.kind === 'five_hour' || l.kind === 'seven_day')
    .map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    const found = keep(usage.rateLimits)
    if (found.length > 0) await update($, limits, () => found)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const found = keep(e.rateLimits)
    if (found.length > 0) await update($, limits, () => found)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, limits)
    if (e.props.hasSurvey || list.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const rows = [
      { kind: 'five_hour', label: '5 שעות ' },
      { kind: 'seven_day', label: 'שבועי  ' },
    ]

    return (
      <Box flexDirection="column">
        {rows.map(row => {
          const l = list.find(x => x.kind === row.kind)
          if (!l) return null
          const pct = Math.round(l.percentUsed)
          return (
            <Box key={row.kind}>
              <Text dimColor>{row.label} </Text>
              <Text color={colorFor(l.percentUsed)}>{bar(l.percentUsed)}</Text>
              <Text> {String(pct).padStart(3, ' ')}%  </Text>
              <Text dimColor>{resetLabel(l.resetsAt, now)}</Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}

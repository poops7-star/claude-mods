import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage } from 'claude-code'

import type { Fill } from '../types'

const fill = atom({ plugin: 'context-bar', key: 'fill' } as const, null as Fill | null)

const WIDTH = 20
const WARN_AT = 85

function toFill(c: SessionContextUsage): Fill | null {
  if (c.tokens === undefined || c.percent === undefined) return null
  return { tokens: c.tokens, window: c.window, percent: c.percent }
}

function bar(percent: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((percent / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

export function kTokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`
}

function colorFor(percent: number): string {
  if (percent >= WARN_AT) return 'error'
  if (percent >= 60) return 'warning'
  return 'success'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const f = toFill((await $.session.usage()).context)
    await update($, fill, () => f)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const f = toFill(e.context)
    if (f) await update($, fill, () => f)
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    const f = toFill((await $.session.usage()).context)
    await update($, fill, () => f)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, fill)
    if (e.props.hasSurvey || f === null) return next(e)
    const below = await next(e)

    const { Box, Text } = $.ui.resolve(e)
    const pct = Math.round(f.percent)

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>{'קונטקסט '}</Text>
          <Text color={colorFor(f.percent)}>{bar(f.percent)}</Text>
          <Text> {String(pct).padStart(3, ' ')}%  </Text>
          <Text dimColor>
            {kTokens(f.tokens)} / {kTokens(f.window)}
          </Text>
          {pct >= WARN_AT && <Text color="error">{'  כדאי /compact או שיחה חדשה'}</Text>}
        </Box>
        {below}
      </Box>
    )
  })
}

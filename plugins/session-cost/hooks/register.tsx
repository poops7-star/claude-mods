import type { Register } from 'claude-code'

export function usd(n: number): string {
  return n < 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(1)}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { cost } = await $.session.usage()
    if (cost) $.ui.status(`עלות הסשן: ${usd(cost.usd)}`)
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.cost && e.changed.includes('cost')) $.ui.status(`עלות הסשן: ${usd(e.cost.usd)}`)
    return next(e)
  })
}

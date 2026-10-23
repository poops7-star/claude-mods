import { expect, test } from 'claude-code/testing'

import { resetLabel } from '../hooks/register'

const BAND = {
  plugin: 'usage-bars',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20 },
} as const

test('reset labels in Israel time', () => {
  // 2026-10-23 10:00 IDT (UTC+3)
  const now = Date.UTC(2026, 9, 23, 7, 0)
  expect(resetLabel('2026-10-23T14:40:00Z', now)).toBe('מתאפס היום ב-17:40')
  expect(resetLabel('2026-10-24T06:00:00Z', now)).toBe('מתאפס מחר ב-09:00')
  // after DST ends (Oct 25): UTC+2, Tuesday
  expect(resetLabel('2026-10-27T07:00:00Z', now)).toBe('מתאפס ביום ג׳ ב-09:00')
})

test('two bars after a measurement', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('clock.now', () => ({ value: Date.UTC(2029, 11, 31, 8, 0) }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.measure({
    context: {} as never,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 42, resetsAt: '2030-01-01T10:00:00Z' },
      { kind: 'seven_day', percentUsed: 91.5, resetsAt: '2030-01-05T10:00:00Z' },
    ],
    changed: ['rateLimits'],
  } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text', text: /42%/ }))?.text).toBe('  42%  ')
  expect(await ui.find({ type: 'Text', text: /92%/ })).toBeTruthy()
  // another mod's band, drawn beneath ours, still shows
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeTruthy()
  await ui.unmount()
})

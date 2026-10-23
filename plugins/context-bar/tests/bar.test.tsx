import { expect, test } from 'claude-code/testing'

import { kTokens } from '../hooks/register'

const BAND = {
  plugin: 'context-bar',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20 },
} as const

test('token counts read short', () => {
  expect(kTokens(42_300)).toBe('42K')
  expect(kTokens(1_000_000)).toBe('1.0M')
})

test('the bar warns past 85%', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.measure({
    context: { tokens: 180_000, window: 200_000, percent: 90 },
    rateLimits: [],
    changed: ['context'],
  } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text', text: /90%/ }))?.text).toBe('  90%  ')
  expect(await ui.find({ type: 'Text', text: /compact/ })).toBeTruthy()
  await ui.unmount()
})

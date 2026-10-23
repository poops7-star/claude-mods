import { expect, test } from 'claude-code/testing'

import { duration } from '../hooks/register'

test('durations read in Hebrew', () => {
  expect(duration(45_000)).toBe('45 שנ׳')
  expect(duration(192_000)).toBe('3:12 דק׳')
})

test('a long turn notifies, a short one does not', async ($, on) => {
  const sent: string[] = []
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.notify', (_, e) => (sent.push(e.text), { value: { isSent: true, channel: 'terminal_bell' } }))
  on('ui.toast', () => ({ value: undefined }))
  await $.turn.complete({ answer: 'a', durationMs: 5_000, isAborted: false, turnId: 't1', reason: 'completed' } as never)
  await $.turn.complete({ answer: 'b', durationMs: 192_000, isAborted: false, turnId: 't2', reason: 'completed' } as never)
  expect(sent).toEqual(['סיימתי אחרי 3:12 דק׳'])
})

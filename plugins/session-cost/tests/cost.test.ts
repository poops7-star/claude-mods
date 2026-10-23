import { expect, test } from 'claude-code/testing'

import { usd } from '../hooks/register'

test('dollars read short', () => {
  expect(usd(0.4)).toBe('$0.40')
  expect(usd(12.345)).toBe('$12.3')
})

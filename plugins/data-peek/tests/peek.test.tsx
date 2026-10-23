import { expect, test } from 'claude-code/testing'

import { parse, profile, spark } from '../hooks/register'

const PANE = {
  plugin: 'data-peek',
  component: 'Pane',
  requestId: 'data-peek',
  props: {
    title: 'נתונים',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const CSV = 'ts,temp,status\n2026-10-01 08:00,21.5,ok\n2026-10-01 09:00,,ok\n2026-10-01 10:00,23.5,"bad, very"\n2026-10-01 11:00,25,ok\n'

test('quoted fields keep their commas', () => {
  expect(parse('a,b\n"x, y","say ""hi"""\n', ',', 10)).toEqual([['a', 'b'], ['x, y', 'say "hi"']])
})

test('a time series profiles', () => {
  const p = profile('/d/s.csv', CSV)
  expect(p.rows).toBe(4)
  const [ts, temp, status] = p.columns
  expect(ts?.kind).toBe('date')
  expect(temp).toMatchObject({ kind: 'number', missing: 1, min: 21.5, max: 25 })
  expect(Math.round((temp?.mean ?? 0) * 1000)).toBe(23333)
  expect(status).toMatchObject({ kind: 'text', distinct: 2 })
})

test('semicolons are found', () => {
  expect(profile('/d/x.csv', 'a;b\n1;2\n').columns.map(c => c.name)).toEqual(['a', 'b'])
})

test('a sparkline rises with the values', () => {
  expect(spark([1, 2, 3, 4, 5, 6, 7, 8])).toBe('▁▂▃▄▅▆▇█')
})

test('reading a CSV opens its profile', async ($, on) => {
  on('tool.call', () => ({ result: {} as never }))
  on('fs.read', () => ({ value: CSV }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.tool.call({ tool: 'Read', file_path: '/d/sensor.csv' } as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect((await ui.find({ type: 'Text', text: 'sensor.csv' }))?.text).toBe('sensor.csv')
  expect(await ui.find({ type: 'Text', text: /חסרים 1/ })).toBeTruthy()
  await ui.unmount()
})

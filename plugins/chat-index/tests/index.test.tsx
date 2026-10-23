import { expect, test } from 'claude-code/testing'

import { appendPrompt, israelDate, parseRow, transcript } from '../hooks/register'

const PANE = {
  plugin: 'chat-index',
  component: 'Pane',
  requestId: 'chat-index',
  props: {
    title: 'CHAT-INDEX',
    isFocused: false,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the date is Israel time', () => {
  // 23:30 UTC on Oct 23 is already Oct 24 in Israel (UTC+3)
  expect(israelDate(Date.UTC(2026, 9, 23, 23, 30))).toBe('2026-10-24')
})

test('a reply parses into a row', () => {
  expect(parseRow('Here: {"title":"Моды","about":"Три мода"}', '2026-10-23')).toEqual({
    date: '2026-10-23',
    title: 'Моды',
    about: 'Три мода',
  })
  expect(parseRow('no json', 'd')).toBeNull()
})

test('the transcript keeps the newest when long', () => {
  const t = transcript(
    [
      { role: 'user', text: 'A'.repeat(100), toolUses: [] },
      { role: 'assistant', text: 'B', toolUses: [] },
      { role: 'user', text: 'last', toolUses: [] },
    ],
    20,
  )
  expect(t.includes('last')).toBe(true)
  expect(t.includes('A'.repeat(50))).toBe(false)
})

test('the append prompt only appends', () => {
  const p = appendPrompt({ date: '2026-10-23', title: 'Моды', about: 'Три мода' })
  expect(p).toContain('О чём: Три мода')
  expect(p).toContain('больше ничего не меняй')
})

test('draft, review, add', async ($, on) => {
  const sent: string[] = []
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 23, 12, 0) }))
  on('session.messages', () => ({ value: [{ role: 'user', text: 'Q', toolUses: [] }] }))
  on('model.complete', () => ({
    value: { isAnswered: true, text: '{"title":"Моды","about":"Шесть модов"}', usage: {} as never },
  }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => (sent.push(e.text), { text: e.text }))

  await $.command.run({ command: 'chat-index', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await ui.find({ type: 'Text', text: /Шесть модов/ })).toBeTruthy()
  await ui.press({ key: 'add' })
  await ui.unmount()
  expect(sent[0]).toContain('Название: Моды')
  expect(sent[0]).toContain('Дата: 2026-10-23')
})

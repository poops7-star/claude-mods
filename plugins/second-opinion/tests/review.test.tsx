import { expect, test } from 'claude-code/testing'

import { criticFor, lastExchange } from '../hooks/register'

const BAND = {
  plugin: 'second-opinion',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20 },
} as const

const PANE = {
  plugin: 'second-opinion',
  component: 'Pane',
  requestId: 'second-opinion',
  props: {
    title: 'דעה שנייה',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the critic is another model', () => {
  expect(criticFor('claude-opus-5-5')).toBe('sonnet')
  expect(criticFor('claude-sonnet-5-5')).toBe('opus')
})

test('the last exchange spans tool calls', () => {
  const ex = lastExchange([
    { role: 'user', text: 'old', toolUses: [] },
    { role: 'assistant', text: 'old answer', toolUses: [] },
    { role: 'user', text: 'Q', toolUses: [] },
    { role: 'assistant', text: 'part 1', toolUses: [] },
    { role: 'user', text: '', toolUses: [], toolResults: [{} as never] },
    { role: 'assistant', text: 'part 2', toolUses: [] },
  ])
  expect(ex).toEqual({ question: 'Q', answer: 'part 1\n\npart 2' })
})

test('press, read the critique, send it back', async ($, on) => {
  const submitted: string[] = []
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'Q', toolUses: [] },
      { role: 'assistant', text: 'A', toolUses: [] },
    ],
  }))
  on('model.complete', (_, e) => ({
    value: { isAnswered: true, text: `חולשה אחת (${e.model})`, usage: {} as never },
  }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => (submitted.push(e.text), { text: e.text }))

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  await band.press({ key: 'second-opinion' })
  await band.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect((await pane.find({ type: 'Text', text: /חולשה/ }))?.text).toBe('חולשה אחת (sonnet)')
  await pane.press({ key: 'apply' })
  await pane.unmount()

  expect(submitted.length).toBe(1)
  expect(submitted[0]).toContain('חולשה אחת (sonnet)')
})

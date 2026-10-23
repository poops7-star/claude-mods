import { expect, test } from 'claude-code/testing'

import { check, detect } from '../hooks/register'

const BAND = {
  plugin: 'lang-guard',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20 },
} as const

test('the prompt language', () => {
  expect(detect('תבנה לי מוד שמציג פסים')).toBe('he')
  expect(detect('Привет, как дела у тебя?')).toBe('ru')
  expect(detect('fix the `useEffect` in src/app.tsx please')).toBe('en')
  expect(detect('ok')).toBeNull()
})

test('a Hebrew answer full of English terms is no mismatch', () => {
  expect(check('he', 'המוד usage-bars רץ ב-Claude Code, וה-API מחזיר rateLimits אחרי כל תשובה של המודל.')).toBeNull()
})

test('a Russian answer to a Hebrew prompt is', () => {
  expect(check('he', 'Мод готов, тесты проходят, осталось только установить его на компьютер.')).toBe('ru')
})

test('the band speaks the prompt language and re-asks', async ($, on) => {
  const sent: string[] = []
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('prompt.submit', (_, e) => (sent.push(e.text), { text: e.text }))
  // A prompt from a test is a plugin's, not the person's: seed what the
  // person's Hebrew prompt and a Russian answer would have left.
  let isSeeded = false
  on('state.get', ($, e, next) => {
    if (isSeeded || e.key !== 'mismatch') return next(e)
    isSeeded = true
    return { value: { value: { asked: 'he', got: 'ru' }, version: 1 } }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect((await ui.find({ type: 'Text', text: /כתבת/ }))?.text).toBe('כתבת בעברית, והתשובה יצאה ברוסית. ')
  await ui.press({ key: 'lang-fix' })
  await ui.unmount()
  expect(sent.at(-1)).toBe('תענה בבקשה על ההודעה האחרונה שלי שוב, בעברית.')
})

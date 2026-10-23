import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Lang, Mismatch } from '../types'

const asked = atom({ plugin: 'lang-guard', key: 'asked' } as const, null as Lang | null)
const mismatch = atom({ plugin: 'lang-guard', key: 'mismatch' } as const, null as Mismatch | null)

const NAME: Record<Lang, Record<Lang, string>> = {
  he: { he: 'עברית', ru: 'רוסית', en: 'אנגלית' },
  ru: { he: 'иврите', ru: 'русском', en: 'английском' },
  en: { he: 'Hebrew', ru: 'Russian', en: 'English' },
}

const NOTICE: Record<Lang, (got: Lang) => string> = {
  he: got => `כתבת בעברית, והתשובה יצאה ב${NAME.he[got]}.`,
  ru: got => `Ты писал по-русски, а ответ пришёл на ${NAME.ru[got]}.`,
  en: got => `You wrote in English, but the answer came in ${NAME.en[got]}.`,
}

const FIX_LABEL: Record<Lang, string> = { he: 'לענות בעברית', ru: 'Ответить по-русски', en: 'Answer in English' }
const HIDE_LABEL: Record<Lang, string> = { he: 'זה בסדר', ru: 'Всё нормально', en: 'It is fine' }
const FIX_PROMPT: Record<Lang, string> = {
  he: 'תענה בבקשה על ההודעה האחרונה שלי שוב, בעברית.',
  ru: 'Ответь, пожалуйста, на моё последнее сообщение ещё раз, по-русски.',
  en: 'Please answer my last message again, in English.',
}

// Code, links and paths say nothing about the language a person writes in.
function prose(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S*[\\/]\S+/g, ' ')
}

export function letters(text: string): Record<Lang, number> {
  const t = prose(text)
  return {
    he: (t.match(/[א-ת]/g) ?? []).length,
    ru: (t.match(/[Ѐ-ӿ]/g) ?? []).length,
    en: (t.match(/[A-Za-z]/g) ?? []).length,
  }
}

// The prompt's language: one script holding most of its letters.
export function detect(text: string): Lang | null {
  const n = letters(text)
  const total = n.he + n.ru + n.en
  if (total < 8) return null
  for (const lang of ['he', 'ru', 'en'] as const) if (n[lang] / total >= 0.6) return lang
  return null
}

// A mismatch only when the asked language is all but absent from the answer,
// so an answer full of English terms is not taken for an English answer.
export function check(prompt: Lang, answer: string): Lang | null {
  const n = letters(answer)
  const total = n.he + n.ru + n.en
  if (total < 20 || n[prompt] / total >= 0.15) return null
  const got = (['he', 'ru', 'en'] as const).filter(l => l !== prompt).sort((a, b) => n[b] - n[a])[0]
  return got ?? null
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    const isPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (isPerson && !e.command) {
      const lang = detect(e.text)
      if (lang) await update($, asked, () => lang)
      await update($, mismatch, () => null)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || e.reason !== 'answer') return result
    const lang = await read($, asked)
    if (!lang) return result
    const got = check(lang, e.answer)
    await update($, mismatch, () => (got ? { asked: lang, got } : null))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const m = await read($, mismatch)
    if (e.props.hasSurvey || e.props.isWorking || !m) return below
    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Text color="warning">{NOTICE[m.asked](m.got)} </Text>
          <Button
            key="lang-fix"
            label={FIX_LABEL[m.asked]}
            onPress={async () => {
              await update($, mismatch, () => null)
              await $.prompt.submit({ text: FIX_PROMPT[m.asked], asUser: true })
            }}
          />
          <Text> </Text>
          <Button key="lang-hide" label={HIDE_LABEL[m.asked]} onPress={() => update($, mismatch, () => null)} />
        </Box>
        {below}
      </Box>
    )
  })
}

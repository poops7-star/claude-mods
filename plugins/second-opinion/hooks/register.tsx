import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { Review } from '../types'

const PANE = 'second-opinion'
const TITLE = 'דעה שנייה'
const review = atom({ plugin: 'second-opinion', key: 'review' } as const, { status: 'idle' } as Review, {
  shape: 'review-1',
})

const CRITIC = `You are a harsh, expert reviewer giving a second opinion on another AI assistant's answer.
Find what is wrong, weak, missing or risky: factual errors, flawed reasoning, bugs, unhandled edge cases,
unstated assumptions, overconfidence, parts of the question left unanswered, simpler or better alternatives.
Do not praise. Do not soften. If something is genuinely fine, skip it.
Order findings from most to least serious. For each: what is wrong, why it matters, how to fix it.
Be concrete and brief. If you find nothing serious, say so in one line.
Write in the same language as the answer you are reviewing.`

// The critic is a different model from the one the session runs on.
export function criticFor(sessionModel: string): string {
  return /opus/i.test(sessionModel) ? 'sonnet' : 'opus'
}

export function lastExchange(messages: readonly SessionMessage[]): { question: string; answer: string } | null {
  let a = messages.length - 1
  while (a >= 0 && !(messages[a]?.role === 'assistant' && messages[a]?.text.trim())) a--
  if (a < 0) return null
  // The answer is every assistant text from the person's last prompt to here.
  let q = a
  while (q >= 0 && !(messages[q]?.role === 'user' && messages[q]?.text.trim() && !messages[q]?.toolResults?.length)) q--
  const answer = messages
    .slice(q + 1, a + 1)
    .filter(m => m.role === 'assistant' && m.text.trim())
    .map(m => m.text)
    .join('\n\n')
  return { question: q >= 0 ? (messages[q]?.text ?? '') : '', answer }
}

async function runReview($: EngineInterface): Promise<void> {
  const model = criticFor(await $.session.model())
  await update($, review, (): Review => ({ status: 'loading', model }))
  void $.ui.open({ id: PANE, title: TITLE })

  const exchange = lastExchange(await $.session.messages())
  if (!exchange) {
    await update($, review, (): Review => ({ status: 'error', model, reason: 'אין עדיין תשובה לבקר.' }))
    return
  }

  const prompt = [
    exchange.question && `<question>\n${exchange.question}\n</question>`,
    `<answer>\n${exchange.answer}\n</answer>`,
    'Critique the answer.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const r = await $.model.complete({ model, system: CRITIC, prompt, maxTokens: 4000, timeoutMs: 180_000 })
  await update($, review, (): Review =>
    r.isAnswered
      ? { status: 'done', model, text: r.text.trim() }
      : { status: 'error', model, reason: r.reason === 'api-error' ? `שגיאת API: ${r.error}` : r.reason },
  )
}

async function applyReview($: EngineInterface): Promise<void> {
  const current = await read($, review)
  if (current.status !== 'done') return
  await $.prompt.submit({
    asUser: true,
    text: `מודל אחר (${current.model}) העביר ביקורת על התשובה האחרונה שלך. עבור על הנקודות, תקן את מה שבאמת שגוי, וציין במפורש מה דחית ולמה:\n\n${current.text}`,
  })
  await update($, review, (): Review => ({ status: 'idle' }))
  await $.ui.close({ id: PANE })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'second-opinion', description: 'ביקורת של מודל אחר על התשובה האחרונה' })
    return next(e)
  })

  on('command.run', { command: 'second-opinion' }, async $ => {
    void runReview($)
    return { text: 'שולח לדעה שנייה…' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || e.props.isWorking) return below
    const current = await read($, review)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Button
            key="second-opinion"
            label={current.status === 'loading' ? 'דעה שנייה…' : 'דעה שנייה'}
            onPress={() => (current.status === 'loading' ? undefined : void runReview($))}
          />
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const current = await read($, review)

    if (current.status === 'idle') return <Text dimColor>לחץ על "דעה שנייה" מעל תיבת הכתיבה.</Text>
    if (current.status === 'loading') return <Text dimColor>{current.model} קורא את התשובה ומחפש חולשות…</Text>
    if (current.status === 'error') {
      return (
        <Box flexDirection="column">
          <Text color="error">הביקורת נכשלה: {current.reason}</Text>
          <Button key="retry" label="נסה שוב" onPress={() => void runReview($)} />
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text dimColor>ביקורת של {current.model}</Text>
        <Text wrap="wrap">{current.text}</Text>
        <Box>
          <Button key="apply" label="תתקן לפי זה" onPress={() => void applyReview($)} />
          <Text> </Text>
          <Button key="close" label="סגור" onPress={() => void $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}

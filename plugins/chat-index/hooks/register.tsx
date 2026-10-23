import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { Draft, Row } from '../types'

const PANE = 'chat-index'
const MIN_TURNS = 3

const draft = atom({ plugin: 'chat-index', key: 'draft' } as const, { status: 'idle' } as Draft, { shape: 'draft-1' })
const turns = atom({ plugin: 'chat-index', key: 'turns' } as const, 0)

const DRAFTER = `You write one row for the user's index of their chats with Claude.
Return only JSON: {"title": "...", "about": "..."}.
- title: the chat's subject, 3-7 words, in the language the user wrote in.
- about: one line in Russian, at most 110 characters: what was done or decided, concrete, no filler.
  For health and family chats keep it neutral and free of personal details.`

export function israelDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ms))
  } catch {
    return new Date(ms + 3 * 3600_000).toISOString().slice(0, 10)
  }
}

// The conversation as the drafter reads it: the person's words whole, the
// answers clipped, the newest kept when it runs long.
export function transcript(messages: readonly SessionMessage[], budget = 40_000): string {
  const lines = messages
    .filter(m => m.text.trim() && !m.toolResults?.length)
    .map(m => (m.role === 'user' ? `USER: ${m.text}` : `CLAUDE: ${m.text.slice(0, 1500)}`))
  let out = ''
  for (let i = lines.length - 1; i >= 0 && out.length < budget; i--) out = `${lines[i]}\n\n${out}`
  return out.slice(-budget)
}

export function parseRow(text: string, date: string): Row | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return null
  try {
    const r = JSON.parse(json) as Partial<Record<'title' | 'about', unknown>>
    if (typeof r.title !== 'string' || typeof r.about !== 'string') return null
    return { date, title: r.title.trim(), about: r.about.trim() }
  } catch {
    return null
  }
}

// Claude does the write with its own connector and the index's own rules:
// the mod never touches the sheet and knows nothing of its contents.
export function appendPrompt(row: Row): string {
  return [
    'Добавь в CHAT-INDEX строку для этого чата, по правилам из START-HERE:',
    '',
    `Дата: ${row.date}`,
    `Название: ${row.title}`,
    `О чём: ${row.about}`,
    '',
    'Тему выбери из существующих тем индекса; если ни одна не подходит — спроси меня, не создавай новую.',
    'Ссылка: ссылка на эту сессию, если она тебе известна; иначе оставь пустой.',
    'Только добавь строку в конец, больше ничего не меняй. После записи перечитай её и подтверди одной фразой.',
  ].join('\n')
}

async function makeDraft($: EngineInterface): Promise<void> {
  await update($, draft, (): Draft => ({ status: 'drafting' }))
  void $.ui.open({ id: PANE, title: 'CHAT-INDEX' })
  const date = israelDate(await $.clock.now())
  const r = await $.model.complete({
    model: 'haiku',
    system: DRAFTER,
    prompt: transcript(await $.session.messages()),
    maxTokens: 400,
    effort: 'low',
    timeoutMs: 60_000,
  })
  const row = r.isAnswered ? parseRow(r.text, date) : null
  await update($, draft, (): Draft =>
    row
      ? { status: 'ready', row }
      : {
          status: 'error',
          reason: r.isAnswered ? 'модель вернула не JSON' : r.reason === 'api-error' ? `API: ${r.error}` : r.reason,
        },
  )
}

async function addRow($: EngineInterface): Promise<void> {
  const d = await read($, draft)
  if (d.status !== 'ready') return
  await $.prompt.submit({ text: appendPrompt(d.row), asUser: true })
  await update($, draft, (): Draft => ({ status: 'added', row: d.row }))
  await $.ui.close({ id: PANE })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'chat-index', description: 'Черновик строки CHAT-INDEX для этого чата' })
    return next(e)
  })

  on('command.run', { command: 'chat-index' }, async $ => {
    void makeDraft($)
    return { text: 'Готовлю строку для CHAT-INDEX…' }
  })

  on('prompt.submit', async ($, e, next) => {
    if ((e.origin.kind === 'composer' || e.origin.kind === 'bridge') && !e.command) {
      await update($, turns, n => n + 1)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || e.props.isWorking) return below
    const d = await read($, draft)
    if (d.status === 'added' || (await read($, turns)) < MIN_TURNS) return below
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Button
            key="chat-index"
            label={d.status === 'drafting' ? 'CHAT-INDEX…' : 'CHAT-INDEX'}
            onPress={() => (d.status === 'drafting' ? undefined : void makeDraft($))}
          />
        </Box>
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const d = await read($, draft)

    if (d.status === 'idle') return <Text dimColor>Нажми CHAT-INDEX над полем ввода.</Text>
    if (d.status === 'drafting') return <Text dimColor>Составляю строку…</Text>
    if (d.status === 'added') return <Text dimColor>Отправлено Claude на запись.</Text>
    if (d.status === 'error') {
      return (
        <Box flexDirection="column">
          <Text color="error">Не получилось: {d.reason}</Text>
          <Button key="redo" label="Ещё раз" onPress={() => void makeDraft($)} />
        </Box>
      )
    }

    const { row } = d
    return (
      <Box flexDirection="column">
        <Text>
          <Text dimColor>Дата      </Text>
          {row.date}
        </Text>
        <Text>
          <Text dimColor>Название  </Text>
          {row.title}
        </Text>
        <Text wrap="wrap">
          <Text dimColor>О чём     </Text>
          {row.about}
        </Text>
        <Text dimColor>Тему Claude выберет из тем индекса.</Text>
        <Text> </Text>
        <Box>
          <Button key="add" label="Добавить" onPress={() => void addRow($)} />
          <Text> </Text>
          <Button key="redo" label="Переписать" onPress={() => void makeDraft($)} />
          <Text> </Text>
          <Button key="close" label="Закрыть" onPress={() => void $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}

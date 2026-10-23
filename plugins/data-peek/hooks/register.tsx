import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Column, Peek, Profile } from '../types'

const PANE = 'data-peek'
const MAX_ROWS = 200_000
const SPARK = '▁▂▃▄▅▆▇█'
const SPARK_WIDTH = 24

const peek = atom({ plugin: 'data-peek', key: 'peek' } as const, null as Peek | null, { shape: 'peek-1' })

export function isTable(path: string): boolean {
  return /\.(csv|tsv)$/i.test(path)
}

function delimiterOf(head: string, path: string): string {
  if (/\.tsv$/i.test(path)) return '\t'
  const line = head.split(/\r?\n/, 1)[0] ?? ''
  const count = (d: string) => line.split(d).length
  return [',', ';', '\t', '|'].sort((a, b) => count(b) - count(a))[0] ?? ','
}

// RFC 4180: quoted fields may hold the delimiter, quotes ("") and newlines.
export function parse(text: string, delimiter: string, limit: number): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') (field += '"'), i++
        else quoted = false
      } else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) row.push(field), (field = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field), (field = '')
      rows.push(row), (row = [])
      if (rows.length > limit) return rows
    } else field += c
  }
  if (field !== '' || row.length > 0) row.push(field), rows.push(row)
  return rows
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/
const DATE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[-+]\d{2}:?\d{2})?)?$|^\d{1,2}[./]\d{1,2}[./]\d{2,4}( \d{1,2}:\d{2}(:\d{2})?)?$/

function isMissing(v: string): boolean {
  return /^\s*$|^(na|n\/a|nan|null|none|-)$/i.test(v.trim())
}

export function spark(values: readonly number[]): string {
  if (values.length === 0) return ''
  const step = values.length / Math.min(SPARK_WIDTH, values.length)
  const points: number[] = []
  for (let i = 0; i < values.length; i += step) {
    const chunk = values.slice(Math.floor(i), Math.floor(i + step))
    points.push(chunk.reduce((a, b) => a + b, 0) / chunk.length)
  }
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  return points.map(p => SPARK[hi === lo ? 3 : Math.round(((p - lo) / (hi - lo)) * 7)]).join('')
}

function column(name: string, cells: readonly string[]): Column {
  const present = cells.filter(c => !isMissing(c)).map(c => c.trim())
  const missing = cells.length - present.length
  const distinct = new Set(present).size
  if (present.length === 0) return { name, kind: 'empty', missing, distinct }
  if (present.every(c => NUMBER.test(c))) {
    // Missing cells drop out of the line; its order stays the rows' order.
    const nums = present.map(Number)
    let min = Infinity
    let max = -Infinity
    let sum = 0
    for (const n of nums) (min = Math.min(min, n)), (max = Math.max(max, n)), (sum += n)
    return { name, kind: 'number', missing, distinct, min, max, mean: sum / nums.length, spark: spark(nums) }
  }
  if (present.every(c => DATE.test(c))) {
    return { name, kind: 'date', missing, distinct, sample: `${present[0]} … ${present[present.length - 1]}` }
  }
  return { name, kind: 'text', missing, distinct, sample: present[0]?.slice(0, 30) }
}

export function profile(path: string, text: string): Profile {
  const rows = parse(text.replace(/^﻿/, ''), delimiterOf(text.slice(0, 4096), path), MAX_ROWS)
  const header = rows[0] ?? []
  const body = rows.slice(1, MAX_ROWS + 1).filter(r => !(r.length === 1 && r[0] === ''))
  const columns = header.map((name, i) => column(name.trim() || `#${i + 1}`, body.map(r => r[i] ?? '')))
  return { path, rows: body.length, isTruncated: rows.length > MAX_ROWS, columns }
}

async function look($: EngineInterface, path: string): Promise<void> {
  let next: Peek
  try {
    next = profile(path, await $.fs.read(path))
  } catch (err) {
    next = { path, error: err instanceof Error ? err.message : String(err) }
  }
  await update($, peek, () => next)
  void $.ui.open({ id: PANE, title: 'נתונים' })
}

function fmt(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '–'
  const a = Math.abs(n)
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return n.toExponential(2)
  return Number.isInteger(n) ? String(n) : n.toFixed(a >= 100 ? 1 : 3)
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'data-peek',
      description: 'פרופיל של קובץ CSV/TSV בחלונית צד',
      argumentHint: '<path>',
    })
    return next(e)
  })

  on('command.run', { command: 'data-peek' }, async ($, e) => {
    const path = e.args.trim().replace(/^["']|["']$/g, '')
    if (!path) return { text: 'צריך נתיב: /data-peek data.csv' }
    await look($, path)
    return { text: `פותח את ${baseName(path)}…` }
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || result.deny || result.isError) return result
    const path = e.tool === 'Read' || e.tool === 'Write' || e.tool === 'Edit' ? e.file_path : undefined
    if (path && isTable(path)) await look($, path)
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const p = await read($, peek)
    if (!p) return <Text dimColor>עוד לא נפתח קובץ CSV. אפשר גם: /data-peek נתיב</Text>
    if ('error' in p) return <Text color="error">{baseName(p.path)}: {p.error}</Text>

    const width = Math.max(10, Math.min(20, ...p.columns.map(c => c.name.length)))
    return (
      <Box flexDirection="column">
        <Text bold>{baseName(p.path)}</Text>
        <Text dimColor>
          {p.rows.toLocaleString('en-US')} שורות{p.isTruncated ? '+ (נקרא חלקית)' : ''} · {p.columns.length} עמודות
        </Text>
        <Text> </Text>
        {p.columns.map(c => (
          <Box key={c.name} flexDirection="column">
            <Box>
              <Text bold>{c.name.slice(0, width).padEnd(width)} </Text>
              <Text dimColor>{c.kind.padEnd(6)} </Text>
              <Text color={c.missing > 0 ? 'warning' : undefined}>
                {c.missing > 0 ? `חסרים ${c.missing}` : 'מלא'}
              </Text>
              <Text dimColor> · {c.distinct} שונים</Text>
            </Box>
            {c.kind === 'number' && (
              <Text>
                {'  '}
                {c.spark} <Text dimColor>min {fmt(c.min)} · mean {fmt(c.mean)} · max {fmt(c.max)}</Text>
              </Text>
            )}
            {c.sample !== undefined && <Text dimColor>{'  '}{c.sample}</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}

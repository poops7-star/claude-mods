import { expect, test } from 'claude-code/testing'

import { danger } from '../hooks/register'

test('destructive commands are caught', () => {
  for (const c of [
    'rm -rf build', 'rm -fr /tmp/x', 'rm -r -f x', 'sudo rm -Rf ~/data',
    'git push --force origin main', 'git push -f', 'git push origin +main',
    'git reset --hard HEAD~3', 'git clean -fdx', 'git checkout .',
    'psql -c "DROP TABLE users"', 'sqlite3 db "delete from logs"',
    'dd if=/dev/zero of=/dev/sda', 'Remove-Item C:\\data -Recurse -Force',
  ]) expect(danger(c)).not.toBeNull()
})

test('ordinary commands pass', () => {
  for (const c of [
    'rm file.txt', 'rm -f one.log', 'ls -la', 'git push -u origin feature',
    'git status', 'git reset HEAD file', 'psql -c "DELETE FROM logs WHERE ts < now()"',
    'grep -rf patterns.txt .', 'npm run format',
  ]) expect(danger(c)).toBeNull()
})

test('without an approval the command never runs', async ($, on) => {
  const ran: string[] = []
  // Stands for the engine: answers every tool, the confirmation dialog included,
  // with nothing that reads as an approval.
  on('tool.call', (_, e) => (ran.push(e.tool), { result: {} as never }))
  const r = await $.tool.call({ tool: 'Bash', command: 'rm -rf /' } as never)
  expect(ran).not.toContain('Bash')
  expect(String((r as { deny?: string }).deny)).toContain('bash-guard')
})

test('a safe command runs untouched', async ($, on) => {
  const ran: string[] = []
  on('tool.call', (_, e) => (ran.push(e.tool), { result: {} as never }))
  await $.tool.call({ tool: 'Bash', command: 'ls -la' } as never)
  expect(ran).toEqual(['Bash'])
})

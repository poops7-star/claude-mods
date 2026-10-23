import type { Register } from 'claude-code'

// Each rule: what it catches, and the name shown when asking.
const RULES: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*\s+-?[a-zA-Z]*[fF]|-[a-zA-Z]*[fF][a-zA-Z]*\s+-?[a-zA-Z]*[rR]|-[a-zA-Z]*([rR][fF]|[fF][rR]))/, label: 'rm -rf' },
  { re: /\brm\s+(-\S+\s+)*(\/|~|\$HOME|\*)(\s|$)/, label: 'מחיקת תיקייה רחבה' },
  { re: /\bgit\s+push\b[^|;&]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/, label: 'git push --force' },
  { re: /\bgit\s+reset\s+--hard\b/, label: 'git reset --hard' },
  { re: /\bgit\s+clean\s+-[a-zA-Z]*f/, label: 'git clean -f' },
  { re: /\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, label: 'ביטול כל השינויים' },
  { re: /\bgit\s+branch\s+-D\b/, label: 'git branch -D' },
  { re: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, label: 'DROP / TRUNCATE' },
  { re: /\bDELETE\s+FROM\s+\w+(?![^;]*\bWHERE\b)/i, label: 'DELETE בלי WHERE' },
  { re: /\b(mkfs(\.\w+)?|dd\s+[^|;&]*\bof=\/dev\/)/, label: 'כתיבה ישירה לדיסק' },
  { re: /\bchmod\s+-R\s+0?777\b/, label: 'chmod -R 777' },
  { re: /\b(Remove-Item|rd|rmdir)\b[^|;&]*\s-(Recurse|r)\b/i, label: 'מחיקה רקורסיבית (Windows)' },
  { re: /\bformat\s+[a-zA-Z]:/i, label: 'format' },
]

export function danger(command: string): string | null {
  for (const rule of RULES) if (rule.re.test(command)) return rule.label
  return null
}

const ALLOW = 'להריץ'
const REFUSE = 'לא להריץ'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const label = danger(e.command)
    if (!label) return next(e)

    const short = e.command.length > 300 ? `${e.command.slice(0, 300)}…` : e.command
    let answer = REFUSE
    try {
      answer = await $.ui.ask(`פקודה הרסנית (${label}):\n\n${short}\n\nלהריץ אותה?`, [REFUSE, ALLOW])
    } catch {
      // Nobody to ask (a -p run, a dismissed dialog): the safe answer.
    }
    if (answer === ALLOW) return next(e)
    return { deny: `bash-guard: the user did not approve this destructive command (${label}). Do not retry it or work around it; ask the user what they want instead.` }
  })
}

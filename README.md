# claude-mods

Personal Claude Code mods, one folder per mod under `plugins/`, all listed in
`.claude-plugin/marketplace.json`.

## Install

In a terminal (PowerShell, cmd, bash), once per computer:

```
claude plugin marketplace add poops7-star/claude-mods
claude plugin install usage-bars@claude-mods
claude plugin install context-bar@claude-mods
claude plugin install second-opinion@claude-mods
claude plugin install chat-index@claude-mods
claude plugin install lang-guard@claude-mods
claude plugin install data-peek@claude-mods
claude plugin install bash-guard@claude-mods
claude plugin install turn-done@claude-mods
claude plugin install session-cost@claude-mods
```

Then start a new session. Inside Claude Code the same works as `/plugin marketplace add ...`
and `/plugin install ...`. Updates: `claude plugin marketplace update claude-mods`.

The band above the prompt and the panes draw in the terminal and the desktop app.

## Mods

| Mod | What it does |
| --- | --- |
| `usage-bars` | Two bars above the prompt: how much of the 5-hour and the weekly limit is used, each with its reset time in Hebrew (`מתאפס היום ב-17:40`), in Israel time. Yellow at 70%, red at 90%. |
| `context-bar` | A bar above the prompt: how full the context window is (`42K / 200K`), yellow at 60%, red with a nudge to `/compact` at 85%. |
| `second-opinion` | A `דעה שנייה` button above the prompt (or `/second-opinion`): another Claude model (Sonnet when the session runs Opus, Opus otherwise) critiques the last answer harshly in a pane; `תתקן לפי זה` sends the critique back to Claude. |
| `chat-index` | After three prompts, a `CHAT-INDEX` button above the prompt (or `/chat-index`): Haiku drafts the chat's index row (date, title, one-line summary) in a pane; `Добавить` asks Claude to append it to the index with its own connector. The mod never touches the sheet. |
| `lang-guard` | Notices when the answer came in another language than the prompt (Hebrew, Russian, English; code and paths ignored) and offers, in the prompt's language, to answer again. |
| `data-peek` | Whenever Claude reads or writes a CSV/TSV (or `/data-peek <path>`), a side pane profiles it: rows, each column's type, missing values, distinct count, min/mean/max and a sparkline. Excel files are not read. |
| `bash-guard` | Asks for explicit confirmation before destructive shell commands: `rm -rf`, force push, `reset --hard`, `clean -f`, `DROP`/`TRUNCATE`, `DELETE` without `WHERE`, writes to `/dev/…`, recursive `Remove-Item`. Without an answer, the command is refused. |
| `turn-done` | When an answer took over a minute: a toast and a desktop notification, `סיימתי אחרי 3:12 דק׳`. |
| `session-cost` | The session's cost so far in the status line (useful on API billing; on a subscription `usage-bars` says more). |

## Adding a mod

Put it in `plugins/<mod>/` (`.claude-plugin/plugin.json`, `hooks/`, `tests/`), add an
entry to `marketplace.json` and a row to the table above. Check it with
`claude plugin validate plugins/<mod>` and `claude plugin test plugins/<mod>`.

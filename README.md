# claude-mods

Personal Claude Code mods, one folder per mod under `plugins/`, all listed in
`.claude-plugin/marketplace.json`.

Add the marketplace once:

```
/plugin marketplace add poops7-star/claude-mods
```

Then install any mod from it, or all of them:

```
/plugin install usage-bars@claude-mods
/plugin install context-bar@claude-mods
/plugin install second-opinion@claude-mods
```

## Mods

| Mod | What it does |
| --- | --- |
| `usage-bars` | Two bars above the prompt: how much of the 5-hour and the weekly limit is used, each with its reset time in Hebrew (`מתאפס היום ב-17:40`), in Israel time. Refreshes after every answer; yellow at 70%, red at 90%. Terminal and desktop app. |
| `context-bar` | A bar above the prompt: how full the context window is (`42K / 200K`), yellow at 60%, red with a nudge to `/compact` at 85%. |
| `second-opinion` | A `דעה שנייה` button above the prompt (or `/second-opinion`): another Claude model (Sonnet when the session runs Opus, Opus otherwise) critiques the last answer harshly in a pane; `תתקן לפי זה` sends the critique back to Claude. |

## Adding a mod

Put it in `plugins/<mod>/` (`.claude-plugin/plugin.json`, `hooks/`), add an
entry to `marketplace.json` and a row to the table above.

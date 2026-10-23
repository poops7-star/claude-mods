# claude-mods

Personal Claude Code mods, one folder per mod under `plugins/`, all listed in
`.claude-plugin/marketplace.json`.

Add the marketplace once:

```
/plugin marketplace add poops7-star/claude-mods
```

Then install any mod from it:

```
/plugin install <mod>@claude-mods
```

## Mods

| Mod | What it does |
| --- | --- |
| `usage-bars` | Two bars above the prompt: how much of the 5-hour and the weekly limit is used, each with its reset time in Hebrew (`מתאפס היום ב-17:40`), in Israel time. Refreshes after every answer; yellow at 70%, red at 90%. Terminal and desktop app. |

## Adding a mod

Put it in `plugins/<mod>/` (`.claude-plugin/plugin.json`, `hooks/`), add an
entry to `marketplace.json` and a row to the table above.

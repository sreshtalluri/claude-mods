# claude-mods

Claude Code mods by [@sreshtalluri](https://github.com/sreshtalluri).

![session-receipt: a receipt for every Claude Code session](assets/session-receipt-hero.png)

## Install

```
/plugin marketplace add sreshtalluri/claude-mods
/plugin install session-receipt@claude-mods
```

## Mods

| Mod | What it does |
| --- | --- |
| [session-receipt](plugins/session-receipt) | `/receipt` prints a shareable receipt of your session: model, tokens, cost, tools, files, and a few silly stats. `/receipt week` totals the last seven days, `/receipt last` shows the previous session. **Copy image** puts a square PNG on your clipboard (macOS, Windows, Linux). Receipts are saved to `~/.claude/receipts/`. |

## Adding a mod

1. Put it in `plugins/<name>/` (with `.claude-plugin/plugin.json`).
2. Add an entry to `.claude-plugin/marketplace.json`.
3. `claude plugin validate plugins/<name>` and `claude plugin validate .`

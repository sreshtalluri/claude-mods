# Contributing

Thanks for wanting to help. To keep everyone who installs these mods safe, every change is reviewed before it ships.

1. **Open an issue first** (bug or idea) and wait for a go-ahead, so nobody builds something that won't be merged.
2. **Fork, branch, and open a pull request** that links the issue.
3. **Run the checks** locally: `claude plugin validate plugins/<name>` and `claude plugin test plugins/<name>`.
4. The owner reviews every PR. CI must pass, and all review threads must be resolved.

Mods should do nothing they don't need to: no network calls or telemetry unless that's the mod's point, and no reading files outside what it uses.

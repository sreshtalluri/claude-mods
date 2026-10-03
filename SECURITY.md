# Security

Mods run inside Claude Code on your machine, so a bad change here would reach everyone who installed one.

**Reporting:** use [private vulnerability reporting](https://github.com/sreshtalluri/claude-mods/security/advisories/new), not a public issue.

**What protects `main`:** changes land only through pull requests reviewed by the owner, with CI validating and testing every mod. Force-pushes, branch deletion and moving release tags are blocked. Workflows from first-time contributors don't run until approved.

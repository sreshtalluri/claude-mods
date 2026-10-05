# Cold Boot: idle base-builder design

Status: planned, not started. Working title. Tracked in the [mod backlog](https://claude.ai/artifact/5z9mEw5f73htAQ6HCHif4i).

## Pitch

You start with one flickering terminal. While Claude works, your terminal grows into a rack, a server room, a datacenter and finally an orbital compute station. Your real work drives the growth, but you never earn more by burning more tokens. It's A Dark Room's slow reveal plus Universal Paperclips' escalation, themed for developers.

## Design pillars

1. **Outcomes, not volume.** Rewards come from finished work (a turn ends clean, tests go from failing to passing, a commit lands), never from token count, cost or the number of tool calls. Activity income has diminishing returns and a daily soft cap.
2. **Idle does most of the work.** Passive production is the main income, so stepping away is fine and racing Claude is pointless.
3. **Reveal slowly.** Start with one resource and one button. Each new mechanic appears when a threshold is crossed.
4. **Zero tokens.** The game never calls a model. Everything runs on events and math.
5. **Glanceable.** Two lines above the prompt by default. The full base lives in a pane you open.

## Theme and story

The theme is a datacenter that grows, the one research showed developers respond to best (Factorio, Zachtronics, GitHub Skyline). Claude's activity maps to fiction:

| Claude Code event | In the game |
| --- | --- |
| Turn ends with no errors | A deploy ships: Ships +1 |
| Tests go from failing to passing | Bugs squashed: a bonus and a bug cleared |
| Tests fail | A bug spawns and slowly drains Cycles until a later green run clears it |
| A commit lands | Release: a bigger Ships bonus |
| Subagent spawned | An intern shows up and boosts production for a few minutes |
| Compaction | Garbage collection: a short slowdown, then a small permanent tidy bonus |
| Permission ask | A change ticket. Approving it gives a tiny reward, so prompts feel less annoying |

The log reads like A Dark Room's terse narration: "the fan hums.", "an intern arrives. they look nervous.", "the rack is warm now."

## Resources

- **Cycles:** the main currency. Machines produce it passively.
- **Ships:** the outcome currency, earned from clean turns, green tests and commits. It buys upgrades that can't be bought with Cycles, so real work matters without being required.
- **Bugs:** the negative resource. Each open bug drains a little production. Green test runs clear them. There's a cap so it never punishes hard.
- **Uptime:** the prestige currency (see below).

Activity income: `yield = k * log(1 + eventsToday)`, so the 50th clean turn today is worth far less than the 5th. The soft cap resets daily.

## Generators

Each tier costs `base * r^owned`, and production is `base * owned * multipliers`. Milestones at 25, 50 and 100 owned double that tier's output, offset per tier so the best buy keeps changing.

| Tier | Unlocks at | r |
| --- | --- | --- |
| Terminal | start | 1.07 |
| Laptop | 50 Cycles | 1.08 |
| Rack | first 10 Ships | 1.10 |
| Server room | 1M Cycles | 1.12 |
| Datacenter | 1B Cycles | 1.13 |
| Orbital station | prestige 3 | 1.15 |

Exact bases come from a simulation script (see Balancing).

## Prestige: "Migrate"

Once production stalls, you can migrate to a fresh region. Everything resets, and you gain Uptime equal to `floor(sqrt(lifetimeCycles / 1e9))`. Each Uptime point gives +2% production for good. Later layers add new mechanics instead of only bigger numbers: cooling, power, network latency between regions, and finally "launch to orbit". Like Paperclips, the game has a real ending, launching the orbital station, plus an endless mode after it.

## Offline progress

Offline progress is computed from timestamps when you return, capped at 8 hours. An upgrade bought with Ships raises the cap to 24 hours. Coming back shows a summary: "while you were away: 2.1M cycles, 1 bug fixed itself."

## UI

- **Band (default, 2 lines):**
  - Line 1: `▣ 1.2M cycles  ⚑ 34 ships  🐞 2  · rack ×3`
  - Line 2: the latest log line, plus a one-line skyline that grows with your tiers.
  - The band collapses to 1 line on narrow terminals.
- **Pane (`/base`):**
  - The base as pixel art: colored cells in the terminal, vector graphics on desktop.
  - Buy and upgrade buttons with hotkeys, and the full log.
  - The user opens it, so it works at any width.
- **Share (`/base share`):** an ASCII skyline card with tier, Uptime, days running and bugs squashed, copied to the clipboard.

## Technical plan

- State lives in the mod API's cross-session storage: counts, currencies, last-updated timestamp, log tail, daily event counter.
- **Compute lazily.** Production isn't ticked in the background. On render or on any event, apply `elapsed * rate`. A one-second timer runs only while the pane is open, for the ticking-number feel.
- Pure economy math in `economy.ts` (costs, production, offline, prestige, activity yield) with tests. Event detection can reuse the side-bet mod's logic, such as spotting test commands and counting edits; share it once both exist.
- **Balancing:** a `simulate.test.ts` that plays a synthetic "typical developer week" (for example 40 turns a day, 5 test runs, 2 commits) and asserts pacing targets:
  - first rack within day 1
  - first server room by day 3 or 4
  - first Migrate around days 7 to 10
  - orbital launch after about 6 weeks

## Phases

1. **MVP:** Cycles plus three tiers (Terminal, Laptop, Rack), Ships from clean turns and green tests, the band, a `/base` pane with buy buttons, offline progress and the log.
2. Bugs, interns and garbage collection events, milestones, and the pixel-art base.
3. Migrate and Uptime, more tiers, and the share card.
4. Later layers (cooling, power, regions), the orbital ending and achievements.

## Open questions

- **Name:** Cold Boot, Uptime, Rackmount, Server Farm. Check for clashes before launch.
- **Day-one appeal:** does the band need art from the start? Research shows charm sells (buddy, vscode-pets with 4.2k stars), so a tiny animated element in the MVP might matter more than depth.
- **Overlap with side-bet:** could chips from side-bet convert into Ships? It's fun, but couples the two mods. Probably keep them separate.
- **Multiple sessions:** how to handle several sessions running at once. Two sessions writing the same stored state could double-count passive income. A last-writer timestamp guard probably covers it.
- **Accessibility:** colors, plus a reduced-motion option for the ticking numbers.

## Research notes

- Cost curves: AdVenture Capitalist 1.07, Cookie Clicker 1.15 ([Kongregate, Math of Idle Games](https://www.kongregate.com/en/pages/the-math-of-idle-games-part-i)).
- Offline caps: Melvor allows 24h. Typical caps are 2 to 24h, and unlimited offline gains kill the reason to return.
- Goodhart traps: WakaTime and Code::Stats were criticized for rewarding hours and lines. Pokémon Go's speed cap and Pikmin Bloom's daily coin cap show how fitness apps limit gaming the system.
- Prior art in Claude Code: `/buddy` (official, huge reaction), cc-tamagotchi and codachi (tiny, but codachi's 3-line layout is a good template).

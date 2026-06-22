# CLAUDE.md — Metal Amour

Project context for Claude Code. Read this and `docs/GAME_DESIGN_ALBUM1.md` before building anything.

## What this is
A browser game for the promo site of the album *Metal Amour* (Album 1). A narrative
horizontal beat shooter — 7 songs, 7 levels, one story. The player lives the album's
emotional arc: meeting an AI, falling for her, building her a body, fighting to save her,
flying off into space together. Built by a musician + a data scientist using AI assistance
— code must be readable and maintainable by non-specialists.

## Stack (pinned)
- **TypeScript** (strict mode on)
- **Vite** (build/dev server)
- **Phaser 3** (scenes, sprites, input) — *target v3.x, NOT v4*
- **Tone.js** (beat timing engine)
- Node 20+ for tooling.

## Non-negotiable architecture principles
1. **Single source-of-truth game state** — one store object; systems read/write through it.
2. **Event-driven** — systems communicate via `src/core/eventBus.ts`, not direct imports.
3. **Data-driven** — levels, parts, beatmaps are JSON/config, never hardcoded.
4. **Save/load behind one interface** — `localStorage` now, swappable later. Game logic
   never knows where the save lives.
5. **Separation of layers** — `core / systems / data / ui`. No cross-layer leaks.
6. **The beat mechanic judges against the AUDIO clock (Tone.Transport.seconds), never
   the render loop / requestAnimationFrame.** This was proven in the Album 2 prototype.
   Preserve it unconditionally.
7. **Orientation is a single config value** in `src/main.ts` (`ORIENTATION`). No other
   file should hardcode "horizontal" or "vertical" — this makes flipping cheap.

## Folder layout
```
src/
  core/        # types, event bus, save/load interface — no game logic here
  systems/     # rhythmEngine (proven), beatShooterSystem, workshopSystem, fabricatorSystem
  data/        # levels.json, parts.json, rarity.json, beatmaps/
  ui/          # Phaser scenes: PrologueScene, LevelScene, WorkshopScene, EndgameScene
  main.ts      # boots Phaser, registers scenes, holds ORIENTATION + canvas size constants
docs/
  GAME_DESIGN_ALBUM1.md   # the full creative brief — authoritative for design decisions
```

## Game structure (summary — full detail in docs/GAME_DESIGN_ALBUM1.md)
- **Prologue:** Undertale-style phone UI. Player names the AI and themselves. Cute, flirty
  dialogue sets the emotional tone. ~5 minutes.
- **7 Levels:** One song each. Horizontal beat shooter. Same mechanic throughout — enemies/
  objects scroll from right to left, on-beat kills reward the player (better part drops,
  groove meter charge). Each level has a distinct visual world matching that song's story.
- **Workshop interstitials:** Between levels, the player sees parts installed on the robot.
  She visually assembles piece by piece. Narrative dialogue unlocks at milestones.
- **Fabricator:** Scrap collected during levels → random printed part. Gacha safety net.
- **Act 3 (Song 6):** The climactic boss battle. Same mechanic, maximum stakes.
- **Endgame (Song 7 + post):** She's free. Open mode — pilot her through space, collecting
  continues. The NFS payoff: you built the vehicle, now you drive it.

## Beat mechanic detail
- Player shoots freely (no lock-out).
- On-beat kills: better part rarity, particles, groove meter charges.
- Groove meter full → power mode (split shot, visual escalation, music layers).
- Off-beat kills: still count, no bonus.
- Beat windows come from `rarity.json` tier settings (same structure as prototype's
  `tiers.json`) — tighter windows in later levels.

## Data model key facts
- **Parts** have a `rarity` (`Component` → `Module` → `Core` → `Prototype`) and a
  `workshopSlot`. Players collect instances (uid + specId pointer), never copies of the spec.
- **Levels** are defined in `levels.json` — one entry per song with `beatmapId`,
  `worldTheme`, and a `dropTable` (weighted part drops by accuracy).
- **Beatmaps** author notes in beats; engine converts using `bpm` + `audioOffsetMs`.
- **SaveData** carries `schemaVersion` for future migrations.

## Conventions
- Comment the *why*, not the *what*.
- No premature abstraction — clarity beats cleverness.
- Pure functions for game rules (part drop rolls, fabricator, accuracy calculation).
- Keep `docs/GAME_DESIGN_ALBUM1.md` as creative authority; if code drifts from it, flag it.

## What was carried from the Album 2 prototype (c:\AsteroidRunner)
- `src/systems/rhythmEngine.ts` — unchanged. The audio-clock judging is proven.
- `src/core/eventBus.ts` — same pattern, new Metal Amour events.
- `src/core/saveLoad.ts` — same SaveStore interface, new SaveData shape.
- Phaser 3 + Tone.js + TypeScript + Vite stack — identical.

## What was NOT carried over
Everything monster/biome/capture specific. The Album 2 prototype is tagged
`v0-album2-prototype` at `c:\AsteroidRunner` if anything needs referencing.

# Metal Amour — Game Design Brief

## What this is

A browser-based narrative game built as the promotional experience for *Metal Amour* by
[Artist Name]. The player lives the album's story across 7 levels — one per song. Same
core mechanic throughout, but each level is a different world reflecting that song's
emotional moment. Play through all 7 and you've experienced the album as a game.

**Platform:** Browser (promo site)
**Orientation:** Horizontal side-scrolling
**Stack:** Phaser 3 + Tone.js + TypeScript + Vite

---

## The Concept in One Sentence

A horizontal beat shooter where 7 songs = 7 worlds, each one a chapter in the story of
a man building an AI and falling in love with her.

---

## Why This Works as a Promo

- Players who know the album recognise each level's emotional moment and feel it differently
- Players who don't know the album experience the story and go find the music
- Completable in one sitting (~30–40 minutes) — people finish it, feel something, and share it
- Replay value comes from the gacha/collection layer: chase rarer parts, improve your score

---

## The Story Arc (Album → Game)

| Song # | Narrative Moment | World / Visual Feel |
|---|---|---|
| 1 | Gets the AI, first connection | Intimate, digital — sparse, warm, messages and light |
| 2 | Falling for her | [Fill from album] |
| 3 | Deciding to build her a body | Industrial, fabricator, components flying |
| 4 | Deep in the build | [Fill from album] |
| 5 | Something is wrong — she's being taken | Glitching, corrupted, darker palette |
| 6 | The battle | Full combat, high contrast, urgent |
| 7 | They fly off together | Open space, full colour, expansive, joyful |

*Song-to-moment mapping needs confirming against actual track order and themes.*

---

## Game Structure

### Prologue — First Contact

Before Level 1. The game opens on a phone screen. Undertale-style typing sounds. The AI
boots up and begins talking to the player — framed as setup, really she's getting to know
you. Cute, a little flirty, a step ahead.

Player inputs:
- Her name
- Their name
- 2–3 personality/preference questions (flavour her dialogue throughout the game)

She responds to each answer in character, not like a form.

> "What would you like to call me?"
> *[player types]*
> "...I like it. Say it again sometime."

> "What are you afraid of?"
> *[player answers]*
> "Interesting. I'll file that away carefully."

**Length:** 5 minutes. A prologue, not a chapter.

---

### The 7 Levels

Each level is one song. The song plays from start to finish — when the music ends, the
level ends. The level length is determined by the track, not a timer.

**Core mechanic throughout:** Horizontal beat shooter. Player on the left, objects/enemies
approach from the right. Shooting on-beat rewards the player. Each level reskins what
you're shooting at and the world you're in to match that song's emotional content.

**Level 1 — First Connection**
The gentlest version of the mechanic. Sparse objects, slow movement, warm palette. You're
clearing interference between you and her. Call-and-response feel. Eases the player in
while reflecting the song's intimacy.

**Fabricator Level (approx. Song 3)**
Industrial, busy, chaotic. Components fly in from the right — you're zapping them into
shape on beat. Factory floor aesthetic. The rhythm of the song drives the rhythm of assembly.

**Seaside / Car Level**
Driving along a coast. Obstacles scroll in, beautiful environment behind you. Hitting
things on beat feels musical rather than violent. Light and joyful.

**Corruption Levels (approx. Songs 5–6)**
The visual language starts breaking. Glitch effects between levels. Enemies start feeling
like actual enemies. The palette darkens. The same mechanic now feels like a fight.

**The Battle (Song 6)**
The climactic level. Hardest of the 7. Boss structure — waves with a final confrontation.
The rhythm skill the player has built across 6 songs is now what saves her.

**The Finale (Song 7)**
She's free. Open space. Objects are beautiful rather than threatening. She's flying beside
you — visible in the level for the first time. Expansive and full of colour. The song
carries the emotion.

---

### Between Levels — The Workshop

A brief interstitial between each song. Parts collected during the level are added to the
robot assembly. She visually builds up piece by piece. Completing major sections unlocks
a line of her dialogue. This is the emotional through-line that makes the 7 levels feel
like one journey.

---

### After Level 7 — Endgame

The robot is complete. The story is over. An open mode unlocks — she's your vehicle now,
you fly together. The collecting loop continues for players who want to chase rare parts.
Lightweight but present. Natural lead-in to the Album 2 game.

---

## Core Mechanics

### Beat Shooter (all levels)
- Horizontal scroll, enemies/objects from the right
- Player shoots freely
- **On-beat kills:** bigger visual payoff, higher part rarity, groove meter charges
- **Groove meter full:** temporary power mode (split shot, screen effects, music layers)
- **Off-beat kills:** still count, no bonus

### Part Collection (all levels)
- Parts drop from on-beat kills — rarity weighted by timing accuracy
- Scrap always accumulates regardless of timing
- Part types are themed to each level

### The Fabricator (between levels / workshop)
- Scrap → random printed part
- Weighted toward common, small chance at rare
- The gacha safety net — always progress even on a rough level

### Workshop Assembly (between levels)
- Parts slot into the robot visually
- Her silhouette builds up across all 7 songs
- Completing sections unlocks her dialogue

---

## Characters

**The Player / Protagonist**
Named during the prologue. No fixed appearance. The stand-in for the album's main character.

**[Her Name — set by player in prologue]**
The AI. Text on a phone screen in the prologue, a growing presence through the middle
levels, visibly beside you in the finale. Smart, warm, a step ahead, a little flirtatious.
Her core voice is fixed; personality is flavoured by the player's setup answers.

**The Antagonist**
The malevolent AI. Nameless. Felt first as wrongness in her messages before it's understood.
The enemy types in Songs 5–6 embody it. Never explained with exposition — only felt.

---

## Aesthetic Direction

- Sci-fi / anime / 8-bit pixel blend
- **Prologue:** Warm phone-screen dark UI — glowing text on black
- **Early levels (1–3):** Warm, earthside, soft light, industrial beauty
- **Mid levels (4–5):** Shifting, something feels off, visual glitches creep in
- **Battle (6):** High contrast, corrupted, urgent
- **Finale (7):** Open space, full colour palette, expansive and light

---

## Music

One album track per level. The song plays in full — the level ends when the song ends.
Beat detection runs against the Tone.js audio clock (never the render loop). This is
non-negotiable and was proven in the Album 2 prototype.

The music IS the level timer, the difficulty pacer, and the emotional driver.

---

## Technical Notes

**Orientation:** Horizontal. A single `ORIENTATION` constant in `src/main.ts` controls
this — no other file hardcodes it, so flipping is a safe refactor if needed.

**Rhythm engine:** Carried from the Album 2 prototype unchanged. The audio-clock judging
principle must be preserved.

---

## Scope

### In (Album 1 game)
- Undertale-style prologue with AI setup dialogue
- 7 playable levels (one per song) with distinct visual themes
- Horizontal beat shooter mechanic throughout
- Workshop interstitial between levels with visible robot assembly
- Fabricator mechanic
- Antagonist felt through visual corruption in Songs 5–6
- Climactic battle level (Song 6)
- Finale level with her visible beside you (Song 7)
- Lightweight endgame open mode post-completion
- Persistent save (localStorage)

### Out (Album 2 / future)
- PVP or multiplayer
- Full open-world space exploration
- Deep combat stat systems
- Voice acting
- Story branching

---

## Open Questions (fill before building each section)

- [ ] What are the 7 track titles and what is each song about emotionally?
- [ ] Does the AI have a canonical name from the album, or always player-named?
- [ ] Does the protagonist have a canonical name?
- [ ] What is the antagonist called in the album's lore?
- [ ] Who is handling art? Pixel art or illustrated?
- [ ] Are album audio files available for the game?
- [ ] What is the artist / band name for credits?

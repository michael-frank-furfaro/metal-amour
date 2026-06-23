// types.ts — single source of truth for all Metal Amour types.
// Every system imports from here; nothing is redefined elsewhere.
// Mirrors docs/GAME_DESIGN_ALBUM1.md — if code and doc diverge, the doc wins.

// ---- Rhythm engine types (carried from prototype — do not change) --------

// A single note in a beatmap. Authored in beats (tempo-independent).
export interface Note {
  beat: number;            // musical position from song start; engine converts to seconds
  type: "tap" | "hold";
  durationBeats?: number;  // hold notes only
  level?: number;          // density layer: 0 = always active; higher = harder tiers only
  pitches?: string[];      // e.g. ["F3"] — each pitch becomes a separate LiveNote
}

export interface Beatmap {
  id: string;
  songId: string;          // FK → audio asset
  title: string;
  artist: string;
  bpm: number;
  audioOffsetMs: number;   // per-song latency calibration, tuned at runtime
  leadInBeats: number;     // silent beats before first note — player reaction time
  notes: Note[];           // sorted ascending by beat
}

// Difficulty window settings — one row per rarity tier.
export interface TierSettings {
  perfectWindowMs: number;
  goodWindowMs: number;
  badWindowMs: number;
  scanSpeedMult: number;
  minNoteLevel: number;
  color: string;
}

// ---- Part / collection types --------------------------------------------

// Four rarity tiers, ascending. Mirrors the album's sense of scale.
export type PartRarity = "Component" | "Module" | "Core" | "Prototype";

// A part type definition (static content — same for all players).
export interface PartSpec {
  id: string;              // stable string key, e.g. "part_chassis_mk1"
  name: string;
  rarity: PartRarity;
  workshopSlot: string;    // which slot on the robot this occupies
  levelSource: string;     // which level id this part drops from
  flavour: string;
  art: { sprite: string };
}

// One part instance in the player's inventory.
export interface PartInstance {
  uid: string;             // uuid — unique per collected instance
  specId: string;          // FK → PartSpec.id
  collectedAtMs: number;
  fromLevel: string;       // level id it dropped from
  beatAccuracy: number;    // 0..1 — the accuracy that earned this drop
}

// ---- Level types --------------------------------------------------------

// One of the 7 song levels (static content).
export interface LevelConfig {
  id: string;              // e.g. "level_01"
  songIndex: number;       // 1..7 — order in the album
  title: string;           // song title
  beatmapId: string;       // FK → Beatmap
  audioFile: string;       // path to audio asset
  worldTheme: string;      // visual theme key for the scene
  narrative: string;       // brief description of this song's emotional moment
  dropTable: { specId: string; weight: number; minAccuracy: number }[];
}

// ---- Workshop types -----------------------------------------------------

// A slot on the robot being built.
export interface WorkshopSlot {
  id: string;              // e.g. "chassis", "left_arm", "head", "core"
  label: string;
  installedPartUid: string | null;
}

// ---- AI companion -------------------------------------------------------

// The AI's state — grows as the robot is built and the story progresses.
export type AIPhase = "voice_only" | "partial" | "complete" | "corrupted" | "freed";

export interface AIState {
  playerGivenName: string;    // name player gave the AI in the prologue
  playerName: string;         // the player's name, entered in prologue
  phase: AIPhase;
  prologueAnswers: Record<string, string>;  // flavours her dialogue throughout
}

// ---- Shmup level types --------------------------------------------------

export type Lane = "top" | "mid" | "bot";
export type LevelEventType = "heart" | "bubble";

// One spawn event in a level. beat = when the object should ARRIVE at the player's X.
// bubble = friend-text obstacle to fly around; heart = AI connection moment to fly through.
export interface LevelEvent {
  beat: number;
  type: LevelEventType;
  lane: Lane;
}

// The runtime data file for a shmup level (loaded from levelmaps/*.json).
export interface LevelMap {
  id:           string;
  title:        string;
  bpm:          number;
  audioOffsetMs: number;
  scrollSpeed:  number;   // px/s — how fast objects travel left across the screen
  events:       LevelEvent[];
}

// ---- Save data ----------------------------------------------------------

export interface SaveData {
  schemaVersion: number;
  ai: AIState;
  inventory: PartInstance[];
  workshopSlots: WorkshopSlot[];
  scrap: number;
  completedLevels: string[];   // level ids in completion order
  settings: {
    audioOffsetMs: number;
    masterVolume: number;
  };
}

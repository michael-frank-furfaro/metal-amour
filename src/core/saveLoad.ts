// saveLoad.ts — the single door between game logic and persistent storage.
// Game code calls save() / load() and never knows where the data lives.

import type { SaveData, WorkshopSlot } from "./types.ts";

export interface SaveStore {
  save(data: SaveData): void;
  load(): SaveData | null;
  clear(): void;
}

const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_WORKSHOP_SLOTS: WorkshopSlot[] = [
  { id: "chassis",    label: "Chassis",     installedPartUid: null },
  { id: "left_arm",   label: "Left Arm",    installedPartUid: null },
  { id: "right_arm",  label: "Right Arm",   installedPartUid: null },
  { id: "legs",       label: "Legs",        installedPartUid: null },
  { id: "core",       label: "Power Core",  installedPartUid: null },
  { id: "head",       label: "Head",        installedPartUid: null },
];

export function makeDefaultSave(): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ai: {
      playerGivenName: "",
      playerName: "",
      phase: "voice_only",
      prologueAnswers: {},
    },
    inventory: [],
    workshopSlots: DEFAULT_WORKSHOP_SLOTS,
    scrap: 0,
    completedLevels: [],
    settings: { audioOffsetMs: 0, masterVolume: 0.8 },
  };
}

const STORAGE_KEY = "metal_amour_save";

export class LocalStorageSaveStore implements SaveStore {
  save(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[saveLoad] Could not write save:", e);
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
        console.warn(`[saveLoad] Save schema v${parsed.schemaVersion} outdated (current: v${CURRENT_SCHEMA_VERSION}). Starting fresh.`);
        return null;
      }
      return parsed;
    } catch (e) {
      console.warn("[saveLoad] Could not read save:", e);
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// eventBus.ts — typed publish/subscribe. Systems talk to each other through
// this bus, never by importing each other directly.

import type { PartRarity } from "./types.ts";

export interface GameEvents {
  // Beat mechanic
  beat_hit: { verdict: "perfect" | "good" | "bad"; x: number; groovePct: number };
  beat_miss: { x: number };
  groove_full: Record<string, never>;   // groove meter maxed — power mode trigger
  groove_reset: Record<string, never>;

  // Level flow
  level_started: { levelId: string; songIndex: number };
  level_completed: { levelId: string; accuracy: number; score: number };

  // Part drops
  part_dropped: { specId: string; rarity: PartRarity; uid: string };
  scrap_collected: { amount: number };

  // Workshop
  part_installed: { uid: string; slot: string };
  workshop_section_complete: { section: string };

  // AI companion
  ai_message: { text: string };
  ai_phase_change: { phase: string };

  // Persistence
  game_saved: Record<string, never>;
}

type Listener<T> = (payload: T) => void;
type Unsubscribe = () => void;

class EventBus {
  private listeners: Partial<Record<keyof GameEvents, Listener<unknown>[]>> = {};

  on<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): Unsubscribe {
    if (!this.listeners[event]) this.listeners[event] = [];
    (this.listeners[event] as Listener<GameEvents[K]>[]).push(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): void {
    const list = this.listeners[event] as Listener<GameEvents[K]>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter(l => l !== listener) as Listener<unknown>[];
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const list = this.listeners[event] as Listener<GameEvents[K]>[] | undefined;
    list?.forEach(l => l(payload));
  }
}

export const bus = new EventBus();

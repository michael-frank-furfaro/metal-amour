// rhythmEngine.ts — the rhythm minigame logic, decoupled from rendering.
//
// DAW mode: each note in the beatmap carries a pitches[] array. The constructor
// expands these into one LiveNote per pitch so every key is judged independently.
//
// KEY INVARIANT: all timing judgements are against Tone.Transport.seconds (the
// audio clock), never requestAnimationFrame / performance.now(). Preserve this.

import * as Tone from "tone";
import type { Beatmap, TierSettings, Note } from "../core/types.ts";

// ---- Judgement constants ------------------------------------------------

const PTS_PERFECT    = 100;
const PTS_GOOD       = 55;
const PTS_BAD        = 20;
const HOLD_BONUS_MAX = 50;

// ---- Types exposed to the scene ----------------------------------------

export type JudgeVerdict = "perfect" | "good" | "bad" | "miss";

export interface LiveNote {
  beat: number;
  timeSec: number;
  type: "tap" | "hold";
  pitch: string;
  holdEndSec?: number;
  judged: JudgeVerdict | null;
  popT: number;
  isHolding: boolean;
  holdProgress: number;
}

export interface JuiceState {
  shake: number;
  lockFlash: number;
  particles: Particle[];
  floats: FloatText[];
}

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  color: string; r: number;
}

export interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number; max: number;
  text: string; color: string; big: boolean;
}

export interface RhythmResult {
  accuracy: number;
  maxCombo: number;
  nPerfect: number;
  nGood: number;
  nBad: number;
  nMiss: number;
  score: number;
  holdBonus: number;
}

// ---- Helper: beat → seconds --------------------------------------------

export function beatToSec(beat: number, bpm: number, leadInBeats: number, audioOffsetMs: number): number {
  return (leadInBeats + beat) * (60 / bpm) + audioOffsetMs / 1000;
}

// ---- RhythmEngine -------------------------------------------------------

export class RhythmEngine {
  readonly songEndSec: number;

  noteToX: (timeSec: number) => number = (t) => t;
  noteToY: (pitch: string)   => number = () => 0;

  onPerfectHit:  (x: number) => void = () => {};
  onGoodHit:     (x: number) => void = () => {};
  onBadHit:      (x: number) => void = () => {};
  onMissHit:     ()           => void = () => {};
  onHoldRelease: (x: number, bonus: number) => void = () => {};

  scanProgress: number = 0;

  notes: LiveNote[] = [];
  juice: JuiceState = { shake: 0, lockFlash: 0, particles: [], floats: [] };

  activeHolds = new Map<string, LiveNote>();

  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private earned = 0;
  private possible = 0;
  private nPerfect = 0;
  private nGood = 0;
  private nBad = 0;
  private nMiss = 0;
  private holdBonusEarned = 0;

  private perfectWin: number;
  private goodWin: number;
  private badWin: number;
  readonly scanSpeedMult: number;

  private finished = false;
  private holdParticleTimer = 0;

  constructor(
    beatmap: Beatmap,
    tier: TierSettings,
    playerOffsetSec: number = 0,
  ) {
    this.perfectWin    = tier.perfectWindowMs / 1000;
    this.goodWin       = tier.goodWindowMs    / 1000;
    this.badWin        = tier.badWindowMs     / 1000;
    this.scanSpeedMult = tier.scanSpeedMult;

    const activeNotes: Note[] = beatmap.notes.filter(
      n => (n.level ?? 0) <= tier.minNoteLevel,
    );

    for (const n of activeNotes) {
      const pitches = n.pitches ?? [];
      if (pitches.length === 0) continue;

      const timeSec = beatToSec(n.beat, beatmap.bpm, beatmap.leadInBeats, beatmap.audioOffsetMs) + playerOffsetSec;
      const holdEndSec = n.type === "hold" && n.durationBeats
        ? beatToSec(n.beat + n.durationBeats, beatmap.bpm, beatmap.leadInBeats, beatmap.audioOffsetMs) + playerOffsetSec
        : undefined;

      for (const pitch of pitches) {
        if (n.type === "hold") this.possible += HOLD_BONUS_MAX;
        this.notes.push({
          beat: n.beat,
          timeSec,
          type: n.type,
          pitch,
          holdEndSec,
          judged: null,
          popT: -2,
          isHolding: false,
          holdProgress: 0,
        });
      }
    }

    const lastRaw = activeNotes[activeNotes.length - 1];
    const lastRawSec = lastRaw
      ? beatToSec(
          lastRaw.beat + (lastRaw.durationBeats ?? 0),
          beatmap.bpm, beatmap.leadInBeats, beatmap.audioOffsetMs,
        ) + playerOffsetSec
      : 0;
    const lastNoteSec = this.notes.length > 0
      ? Math.max(...this.notes.map(n => n.holdEndSec ?? n.timeSec))
      : 0;
    this.songEndSec = Math.max(lastRawSec, lastNoteSec) + 1.0;
  }

  update(_dt: number): void {
    if (this.finished) return;
    const t = Tone.getTransport().seconds;

    this.scanProgress = Math.max(0, Math.min(1, t / this.songEndSec));

    for (const note of this.notes) {
      if (note.judged !== null || note.isHolding) continue;
      if (t - note.timeSec > this.badWin) {
        this.registerMiss(note);
      }
    }

    this.holdParticleTimer += _dt;
    const emitParticles = this.holdParticleTimer > 0.08;
    if (emitParticles) this.holdParticleTimer = 0;

    const toComplete: LiveNote[] = [];
    for (const hold of this.activeHolds.values()) {
      if (hold.holdEndSec === undefined) continue;
      const elapsed  = t - hold.timeSec;
      const duration = hold.holdEndSec - hold.timeSec;
      hold.holdProgress = Math.min(1, elapsed / duration);

      if (emitParticles) {
        this.burst(this.noteToX(t), this.noteToY(hold.pitch), "#2ce0d8", 3);
      }

      if (t >= hold.holdEndSec + 0.05) {
        toComplete.push(hold);
      }
    }
    for (const hold of toComplete) {
      this.completeHold(hold, t);
      this.activeHolds.delete(hold.pitch);
    }

    if (this.activeHolds.size > 0) {
      this.juice.lockFlash = 0.35 + Math.sin(t * 8) * 0.15;
    } else {
      this.juice.lockFlash *= 0.86;
      if (this.juice.lockFlash < 0.02) this.juice.lockFlash = 0;
    }

    this.juice.shake *= 0.86;
    if (this.juice.shake < 0.4) this.juice.shake = 0;

    this.juice.particles = this.juice.particles.filter(p => p.life < p.max);
    for (const p of this.juice.particles) {
      p.life += 0.016;
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.13; p.vx *= 0.98;
    }

    this.juice.floats = this.juice.floats.filter(f => f.life < f.max);
    for (const f of this.juice.floats) {
      f.life += 0.016;
      f.y += f.vy;
    }

    if (t >= this.songEndSec) {
      this.finished = true;
    }
  }

  onKeyDown(pitch: string): void {
    if (this.finished) return;
    const t = Tone.getTransport().seconds;

    let best: LiveNote | null = null;
    let bestDelta = Infinity;
    for (const note of this.notes) {
      if (note.pitch !== pitch) continue;
      if (note.judged !== null || note.isHolding) continue;
      const delta = Math.abs(note.timeSec - t);
      if (delta < bestDelta) { bestDelta = delta; best = note; }
    }

    if (best && bestDelta <= this.badWin) {
      if (best.type === "hold") {
        this.startHold(best, bestDelta, t);
      } else {
        this.registerHit(best, bestDelta, t);
      }
    } else {
      const px = this.noteToX(t);
      const py = this.noteToY(pitch);
      this.burst(px, py, "#4a4f6b", 4);
    }
  }

  onKeyUp(pitch: string): void {
    const hold = this.activeHolds.get(pitch);
    if (!hold) return;
    this.completeHold(hold, Tone.getTransport().seconds);
    this.activeHolds.delete(pitch);
  }

  isFinished(): boolean { return this.finished; }

  getResult(): RhythmResult {
    return {
      accuracy:  this.possible > 0 ? this.earned / this.possible : 0,
      maxCombo:  this.maxCombo,
      nPerfect:  this.nPerfect,
      nGood:     this.nGood,
      nBad:      this.nBad,
      nMiss:     this.nMiss,
      score:     this.score,
      holdBonus: this.holdBonusEarned,
    };
  }

  private startHold(note: LiveNote, delta: number, t: number): void {
    if (delta <= this.perfectWin)   note.judged = "perfect";
    else if (delta <= this.goodWin) note.judged = "good";
    else                            note.judged = "bad";

    note.popT = t;
    const px = this.noteToX(note.timeSec);
    const py = this.noteToY(note.pitch);

    if (note.judged === "perfect") {
      this.earned += PTS_PERFECT; this.nPerfect++;
      this.score  += 100 + this.combo * 10;
      this.juice.lockFlash = 0.5;
      this.addShake(5);
      this.onPerfectHit(px);
    } else if (note.judged === "good") {
      this.earned += PTS_GOOD; this.nGood++;
      this.score  += 50 + this.combo * 4;
      this.addShake(3);
      this.onGoodHit(px);
    } else {
      this.earned += PTS_BAD; this.nBad++;
      this.score  += 20;
      this.addShake(1);
      this.onBadHit(px);
    }

    this.possible += PTS_PERFECT;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    note.isHolding    = true;
    note.holdProgress = 0;
    this.activeHolds.set(note.pitch, note);
    this.holdParticleTimer = 0;
    void py;
  }

  private completeHold(note: LiveNote, _t: number): void {
    const bonus = Math.round(HOLD_BONUS_MAX * note.holdProgress);
    this.holdBonusEarned += bonus;
    this.earned += bonus;
    this.score  += bonus;

    const px = this.noteToX(note.timeSec);
    const py = this.noteToY(note.pitch);
    this.burst(px, py, "#9ed119", 8 + Math.round(note.holdProgress * 12));
    this.addShake(note.holdProgress > 0.8 ? 8 : 4);
    this.popText(px, py, `HELD +${bonus}`, "#9ed119", true);
    this.onHoldRelease(px, bonus);

    note.isHolding = false;
    note.popT = Tone.getTransport().seconds;
  }

  private registerHit(note: LiveNote, delta: number, t: number): void {
    if (delta <= this.perfectWin)   note.judged = "perfect";
    else if (delta <= this.goodWin) note.judged = "good";
    else                            note.judged = "bad";
    note.popT = t;

    const px = this.noteToX(note.timeSec);
    const py = this.noteToY(note.pitch);

    if (note.judged === "perfect") {
      this.earned += PTS_PERFECT; this.nPerfect++;
      this.combo++; this.score += 100 + this.combo * 10;
      this.burst(px, py, "#9ed119", 16);
      this.popText(px, py, "PERFECT", "#2ce0d8", true);
      this.juice.lockFlash = 1;
      this.addShake(this.combo % 8 === 0 ? 9 : 5);
      this.onPerfectHit(px);
    } else if (note.judged === "good") {
      this.earned += PTS_GOOD; this.nGood++;
      this.combo++; this.score += 50 + this.combo * 4;
      this.burst(px, py, "#ffb02e", 10);
      this.popText(px, py, "GOOD", "#ffb02e", false);
      this.addShake(3);
      this.onGoodHit(px);
    } else {
      this.earned += PTS_BAD; this.nBad++;
      this.combo++; this.score += 20 + this.combo * 1;
      this.burst(px, py, "#ff4d3a", 6);
      this.popText(px, py, "BAD", "#ff4d3a", false);
      this.addShake(1);
      this.onBadHit(px);
    }

    this.possible += PTS_PERFECT;
    this.maxCombo  = Math.max(this.maxCombo, this.combo);

    if (this.combo > 0 && this.combo % 5 === 0) {
      this.popText(px, py, `${this.combo}x CHAIN`, "#ff7a3c", true);
      this.addShake(6);
      this.burst(px, py, "#ff7a3c", 14);
    }
  }

  private registerMiss(note: LiveNote): void {
    note.judged = "miss";
    this.nMiss++;
    this.combo = 0;
    this.possible += PTS_PERFECT;
    this.popText(this.noteToX(note.timeSec), this.noteToY(note.pitch), "MISS", "#ff4d7d", false);
    this.addShake(2);
    this.onMissHit();
  }

  private addShake(v: number): void {
    this.juice.shake = Math.min(14, this.juice.shake + v);
  }

  private burst(px: number, py: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * 6.28;
      const speed = 1.5 + Math.random() * 4.5;
      this.juice.particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0, max: 0.5 + Math.random() * 0.4,
        color, r: Math.random() < 0.5 ? 3 : 4,
      });
    }
  }

  private popText(px: number, py: number, text: string, color: string, big: boolean): void {
    this.juice.floats.push({
      x: px, y: py, vy: -0.8,
      life: 0, max: 0.75,
      text, color, big,
    });
  }
}

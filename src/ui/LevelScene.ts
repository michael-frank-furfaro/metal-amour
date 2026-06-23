// LevelScene.ts — Level 1: Latest Connection
// Jetpack runner: hold SPACE to rise, release to fall. One button.
// Player stays at fixed X; objects scroll in from the right.
// Hearts = fly through to collect. Bubbles = friend texts, fly around to avoid.

import Phaser from "phaser";
import * as Tone from "tone";
import level1Data from "../data/levelmaps/level1.json";
import type { LevelMap, LevelEvent } from "../core/types";

// ---- Physics & layout ------------------------------------------------------

const GW = 1280;
const GH = 720;

const PLAYER_X      = 200;
const GRAVITY       = 620;   // px/s² — pull downward when not holding SPACE
const RISE_FORCE    = 1050;  // px/s² — lift upward while SPACE held
const MAX_FALL      = 520;   // px/s
const MAX_RISE      = 400;   // px/s

const BEAT_WINDOW_MS  = 130; // how long the on-beat glow lasts
const INVINCIBLE_MS   = 1100; // grace period after hitting a bubble

const LANE_Y: Record<string, number> = {
  top: 165,
  mid: 360,
  bot: 555,
};

// ---- Internal types --------------------------------------------------------

interface BubbleObj {
  gfx:   Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  cx:    number;
  cy:    number;
}

interface HeartObj {
  gfx: Phaser.GameObjects.Text;
}

// ---- Scene -----------------------------------------------------------------

export class LevelScene extends Phaser.Scene {

  // input
  private keySpace!: Phaser.Input.Keyboard.Key;

  // player
  private player!:     Phaser.GameObjects.Graphics;
  private playerGlow!: Phaser.GameObjects.Graphics;
  private playerY    = GH / 2;
  private velocityY  = 0;
  private isRising   = false;

  // invincibility after bubble hit
  private invincibleTimer = 0;

  // game objects
  private bubbles:   BubbleObj[] = [];
  private hearts:    HeartObj[]  = [];

  // spawn queue — audio callbacks push here, update() consumes
  private spawnQueue: LevelEvent[] = [];

  // beat state
  private lastBeatIndex = -1;
  private onBeat        = false;
  private beatTimer     = 0;

  // connection meter
  private connectionPct = 1;   // starts full — drains on bubble hits, fills on hearts
  private meterFill!:   Phaser.GameObjects.Rectangle;

  // matrix rain
  private rainDrops:    { text: Phaser.GameObjects.Text; speed: number }[] = [];
  private rainFlipTimer = 0;

  // score
  private score     = 0;
  private scoreText!: Phaser.GameObjects.Text;

  private levelMap = level1Data as LevelMap;

  constructor() {
    super({ key: "LevelScene" });
  }

  // ---- Lifecycle ------------------------------------------------------------

  create() {
    this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000);

    this.buildRain();
    this.buildPlayer();
    this.buildUI();

    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const transport = Tone.getTransport();
    transport.cancel();
    transport.bpm.value = this.levelMap.bpm;
    this.scheduleEvents();
    transport.start("+0.1");
  }

  update(_time: number, delta: number) {
    this.updateBeatGlow();
    this.updateBeatWindow(delta);

    while (this.spawnQueue.length > 0) {
      this.spawnEvent(this.spawnQueue.shift()!);
    }

    this.updatePhysics(delta);
    this.updateBubbles(delta);
    this.updateHearts(delta);
    this.updateRain(delta);

    if (this.invincibleTimer > 0) this.invincibleTimer -= delta;
  }

  shutdown() {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
  }

  // ---- Build ----------------------------------------------------------------

  private buildRain() {
    const chars = "アイウエオカキクケABCDEF0123456789@#$%><";
    for (let i = 0; i < 90; i++) {
      const t = this.add.text(
        Phaser.Math.Between(0, GW),
        Phaser.Math.Between(-GH, 0),
        chars[Phaser.Math.Between(0, chars.length - 1)],
        { fontFamily: "monospace", fontSize: "14px", color: "#00ff41" }
      ).setAlpha(Phaser.Math.FloatBetween(0.05, 0.4)).setDepth(0);
      this.rainDrops.push({ text: t, speed: Phaser.Math.Between(60, 200) });
    }
  }

  private buildPlayer() {
    this.playerGlow = this.add.graphics().setDepth(5);
    this.player     = this.add.graphics().setDepth(6);
    this.drawPlayer(false, false);
  }

  private buildUI() {
    // connection meter — vertical bar on the left edge
    const cx = 28;
    const cy = GH / 2;
    const h  = 300;
    this.add.rectangle(cx, cy, 14, h + 2, 0x003388).setDepth(9);
    this.add.rectangle(cx, cy, 12, h,     0x000a18).setDepth(10);
    this.meterFill = this.add
      .rectangle(cx, cy + h / 2, 10, h, 0x00ff88)
      .setOrigin(0.5, 1)
      .setDepth(11);

    this.add.text(cx, cy - h / 2 - 6, "♥", {
      fontFamily: "monospace", fontSize: "14px", color: "#ff69b4",
    }).setOrigin(0.5, 1).setDepth(11);

    // score — top right
    this.scoreText = this.add.text(GW - 16, 20, "0", {
      fontFamily: "'Press Start 2P'", fontSize: "12px", color: "#00ff88",
      padding: { top: 4 },
    }).setOrigin(1, 0).setDepth(11);

    // level title — fades in then out
    const title = this.add.text(GW / 2, 36, "LATEST CONNECTION", {
      fontFamily: "'Press Start 2P'", fontSize: "10px", color: "#00ff41",
      padding: { top: 4 },
    }).setOrigin(0.5, 0).setDepth(11).setAlpha(0);

    this.tweens.add({
      targets: title, alpha: 1, duration: 800,
      onComplete: () => this.tweens.add({ targets: title, alpha: 0, delay: 2000, duration: 1000 }),
    });

    // control hint — fades out quickly
    const hint = this.add.text(GW / 2, GH - 40, "HOLD SPACE TO RISE", {
      fontFamily: "'Press Start 2P'", fontSize: "8px", color: "#003366",
      padding: { top: 4 },
    }).setOrigin(0.5, 0).setDepth(11);

    this.tweens.add({ targets: hint, alpha: 0, delay: 3500, duration: 1200 });
  }

  // ---- Beat system ----------------------------------------------------------

  private updateBeatGlow() {
    if (Tone.getTransport().state !== "started") return;
    const sec     = Tone.getTransport().seconds;
    const beatDur = 60 / this.levelMap.bpm;
    const idx     = Math.floor(sec / beatDur);

    if (idx > this.lastBeatIndex) {
      this.lastBeatIndex = idx;
      this.onBeat    = true;
      this.beatTimer = BEAT_WINDOW_MS;
      this.drawPlayer(true, this.isRising);
    }
  }

  private updateBeatWindow(delta: number) {
    if (this.beatTimer > 0) {
      this.beatTimer -= delta;
      if (this.beatTimer <= 0) {
        this.onBeat = false;
        this.drawPlayer(false, this.isRising);
      }
    }
  }

  // ---- Physics --------------------------------------------------------------

  private updatePhysics(delta: number) {
    const dt       = delta / 1000;
    const wasRising = this.isRising;
    this.isRising  = this.keySpace.isDown;

    if (this.isRising) {
      this.velocityY -= RISE_FORCE * dt;
      this.velocityY  = Math.max(-MAX_RISE, this.velocityY);
    } else {
      this.velocityY += GRAVITY * dt;
      this.velocityY  = Math.min(MAX_FALL, this.velocityY);
    }

    this.playerY = Phaser.Math.Clamp(
      this.playerY + this.velocityY * dt,
      40, GH - 40,
    );

    // clamp velocity when hitting floor/ceiling
    if (this.playerY <= 40 || this.playerY >= GH - 40) this.velocityY = 0;

    if (this.isRising !== wasRising) {
      this.drawPlayer(this.onBeat, this.isRising);
    } else {
      // redraw to follow player position every frame
      this.drawPlayer(this.onBeat, this.isRising);
    }
  }

  // ---- Draw player ----------------------------------------------------------

  private drawPlayer(glowing: boolean, rising: boolean) {
    const x = PLAYER_X;
    const y = this.playerY;

    // flicker when invincible
    const visible = this.invincibleTimer <= 0 || Math.floor(this.invincibleTimer / 80) % 2 === 0;
    this.player.setAlpha(visible ? 1 : 0.2);

    this.playerGlow.clear();
    if (glowing) {
      this.playerGlow.fillStyle(0x00ffff, 0.20);
      this.playerGlow.fillCircle(x, y, 42);
      this.playerGlow.fillStyle(0x00ffff, 0.08);
      this.playerGlow.fillCircle(x, y, 60);
    }

    this.player.clear();

    if (rising) {
      // jetpack thrust — cyan flame below
      this.player.fillStyle(0x00ffff, 0.7);
      this.player.fillTriangle(x - 6, y + 14, x + 6, y + 14, x, y + 28);
      this.player.fillStyle(0xffffff, 0.4);
      this.player.fillTriangle(x - 3, y + 14, x + 3, y + 14, x, y + 20);
    }

    // body
    this.player.fillStyle(0x4466ff);
    this.player.fillRect(x - 6, y - 12, 12, 10);

    // head
    this.player.fillStyle(0xffe0a0);
    this.player.fillRect(x - 4, y - 22, 8, 8);

    // phone glow (AI on screen)
    this.player.fillStyle(0x111111);
    this.player.fillRect(x + 5, y - 16, 5, 8);
    this.player.fillStyle(0x00ff88);
    this.player.fillRect(x + 6, y - 15, 3, 6);

    // jetpack pack on back
    this.player.fillStyle(0x222244);
    this.player.fillRect(x - 10, y - 10, 5, 10);
  }

  // ---- Events ---------------------------------------------------------------

  private scheduleEvents() {
    const transport  = Tone.getTransport();
    const spb        = 60 / this.levelMap.bpm;
    const travelTime = (GW - PLAYER_X) / this.levelMap.scrollSpeed;

    for (const event of this.levelMap.events) {
      const spawnSec = Math.max(0.05, event.beat * spb - travelTime);
      transport.schedule(() => {
        this.spawnQueue.push(event);
      }, spawnSec);
    }
  }

  private spawnEvent(event: LevelEvent) {
    const x = GW + 30;
    const y = LANE_Y[event.lane];
    if (event.type === "heart") {
      this.spawnHeart(x, y);
    } else {
      this.spawnBubble(x, y);
    }
  }

  private spawnHeart(x: number, y: number) {
    const gfx = this.add.text(x, y, "♥", {
      fontFamily: "monospace", fontSize: "26px", color: "#ff69b4",
    }).setOrigin(0.5).setDepth(4);

    this.tweens.add({
      targets: gfx, y: y + 10, duration: 500,
      yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    this.hearts.push({ gfx });
  }

  private spawnBubble(x: number, y: number) {
    const msgs  = ["bro??", "u ok?", "hello?", "where r u", "answer me", "seriously??", "bro.", "???"];
    const msg   = msgs[Phaser.Math.Between(0, msgs.length - 1)];

    const label = this.add.text(x, y, msg, {
      fontFamily: "'Press Start 2P'", fontSize: "7px", color: "#000000",
      padding: { top: 4 },
    }).setOrigin(0.5).setDepth(5);

    const gfx = this.add.graphics().setDepth(4);
    this.drawBubble(gfx, x, y, label.width + 24, 28);

    this.bubbles.push({ gfx, label, cx: x, cy: y });
  }

  private drawBubble(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    gfx.clear();
    gfx.fillStyle(0xffffff, 0.92);
    gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, 5);
    // tail pointing left toward player
    gfx.fillTriangle(
      x - w / 2 + 8,  y + h / 2,
      x - w / 2 - 10, y + h / 2 + 11,
      x - w / 2 + 22, y + h / 2,
    );
  }

  // ---- Update ---------------------------------------------------------------

  private updateBubbles(delta: number) {
    const dt    = delta / 1000;
    const speed = this.levelMap.scrollSpeed;

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b   = this.bubbles[i];
      const dx  = speed * dt;
      b.cx       -= dx;
      b.gfx.x   -= dx;
      b.label.x -= dx;

      if (b.cx < -140) {
        b.gfx.destroy(); b.label.destroy();
        this.bubbles.splice(i, 1);
        continue;
      }

      // collision with player — only when not invincible
      if (this.invincibleTimer <= 0) {
        const dist = Phaser.Math.Distance.Between(PLAYER_X, this.playerY, b.cx, b.cy);
        if (dist < 44) {
          this.addConnection(-0.22);
          this.invincibleTimer = INVINCIBLE_MS;
          this.cameras.main.shake(180, 0.007);
        }
      }
    }
  }

  private updateHearts(delta: number) {
    const dt = delta / 1000;

    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.gfx.x -= this.levelMap.scrollSpeed * dt;

      if (h.gfx.x < -32) {
        h.gfx.destroy();
        this.hearts.splice(i, 1);
        continue;
      }

      if (Phaser.Math.Distance.Between(h.gfx.x, h.gfx.y, PLAYER_X, this.playerY) < 50) {
        this.addScore(200);
        this.addConnection(0.18);
        this.tweens.add({
          targets: h.gfx, alpha: 0, scaleX: 2.5, scaleY: 2.5,
          duration: 220, onComplete: () => h.gfx.destroy(),
        });
        this.hearts.splice(i, 1);
      }
    }
  }

  private updateRain(delta: number) {
    const dt    = delta / 1000;
    const chars = "アイウエオ01@#$><";
    this.rainFlipTimer += dt;
    const flip  = this.rainFlipTimer > 0.08;
    if (flip) this.rainFlipTimer = 0;

    for (const drop of this.rainDrops) {
      drop.text.y += drop.speed * dt;
      if (drop.text.y > GH + 16) {
        drop.text.y = Phaser.Math.Between(-130, -10);
        drop.text.x = Phaser.Math.Between(0, GW);
      }
      if (flip && Math.random() < 0.15) {
        drop.text.setText(chars[Math.floor(Math.random() * chars.length)]);
      }
    }
  }

  // ---- Meters ---------------------------------------------------------------

  private addConnection(delta: number) {
    this.connectionPct = Phaser.Math.Clamp(this.connectionPct + delta, 0, 1);
    const fillH = Math.max(2, Math.round(300 * this.connectionPct));
    this.meterFill.setSize(10, fillH);
    this.meterFill.setFillStyle(this.connectionPct >= 1 ? 0xff69b4 : 0x00ff88);
  }

  private addScore(pts: number) {
    this.score += pts;
    this.scoreText.setText(String(this.score));
  }
}

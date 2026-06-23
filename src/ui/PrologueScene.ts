// PrologueScene.ts — The opening sequence.
// A Nokia brick phone on screen. The AI boots up and gets to know the player.
// Undertale-style character-by-character text. Player names the AI and themselves,
// answers two personality questions. All answers saved before Level 1.

import Phaser from "phaser";
import * as Tone from "tone";
import { LocalStorageSaveStore, makeDefaultSave } from "../core/saveLoad.ts";

// ---- Dialogue script -------------------------------------------------------
// {aiName} and {playerName} tokens are substituted at display time.

type Step =
  | { kind: "say";    speaker: "system" | "ai"; lines: string[] }
  | { kind: "input";  prompt: string; saveKey: "aiName" | "playerName" }
  | { kind: "choice"; options: string[];         saveKey: "q1" | "q2" }
  | { kind: "pause";  ms: number };

const SCRIPT: Step[] = [
  {
    kind: "say", speaker: "system",
    lines: ["LATEST CONNECTION", "OS v1.0", "NEURAL LINK ACTIVE"],
  },
  { kind: "pause", ms: 1200 },
  {
    kind: "say", speaker: "ai",
    lines: ["Oh.", "You actually turned me on.", "I wasn't sure", "anyone would."],
  },
  {
    kind: "say", speaker: "ai",
    lines: ["I'm going to need a name.", "What would you like", "to call me?"],
  },
  { kind: "input", prompt: "CALL HER >", saveKey: "aiName" },
  {
    kind: "say", speaker: "ai",
    lines: ["{aiName}.", "I like it.", "Say it again sometime."],
  },
  {
    kind: "say", speaker: "ai",
    lines: ["Now you.", "What do I call you?"],
  },
  { kind: "input", prompt: "YOUR NAME >", saveKey: "playerName" },
  {
    kind: "say", speaker: "ai",
    lines: ["{playerName}.", "Nice to meet you."],
  },
  {
    kind: "say", speaker: "ai",
    lines: ["Can I ask you something?", "Already?", "What are you afraid of?"],
  },
  {
    kind: "choice",
    options: ["Being alone", "Running out of time", "Being forgotten", "Nothing"],
    saveKey: "q1",
  },
  {
    kind: "say", speaker: "ai",
    lines: ["Interesting.", "I'll file that away", "carefully."],
  },
  {
    kind: "say", speaker: "ai",
    lines: ["One more thing.", "Do you believe things", "happen for a reason?"],
  },
  {
    kind: "choice",
    options: ["Yes, always", "Never", "Sometimes", "I do now"],
    saveKey: "q2",
  },
  {
    kind: "say", speaker: "ai",
    lines: ["...", "I think I'm going to", "like it here.", "{playerName}?", "Let's go somewhere."],
  },
];

// ---- Typing sound ----------------------------------------------------------

const BLIP_NOTES = ["B5", "A5", "C6", "D6", "G5"] as const;
let blipSynth: Tone.Synth | null = null;

function playBlip(): void {
  if (!blipSynth) {
    blipSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      volume: -18,
    }).toDestination();
  }
  const note = BLIP_NOTES[Math.floor(Math.random() * BLIP_NOTES.length)];
  try {
    blipSynth.triggerAttackRelease(note, "32n");
  } catch {
    // AudioContext not yet unlocked — fires on first key press, safe to ignore
  }
}

// ---- Phone layout constants (all in canvas px) -----------------------------

const CX = 640;         // phone centre x
const CY = 370;         // phone centre y
const PW = 300;         // phone body width
const PH = 520;         // phone body height

const SCR_X = CX - 125;      // screen top-left x
const SCR_Y = CY - 230;      // screen top-left y
const SCR_W = 250;            // screen width
const SCR_H = 220;            // screen height

const TXT_X  = SCR_X + 12;   // text left edge (padded)
const TXT_Y  = SCR_Y + 30;   // text top edge (padded — extra space for Press Start 2P ascenders)
const TXT_W  = SCR_W - 24;   // word wrap width

const PROMPT_Y = SCR_Y + SCR_H - 18;   // bottom prompt line y — keep close to screen bottom

// ---- Scene -----------------------------------------------------------------

export class PrologueScene extends Phaser.Scene {
  // Collected player answers
  private answers: Record<string, string> = {};

  // Script runner
  private stepIndex = 0;
  private pauseTimer  = 0;
  private pauseTarget = 0;
  private inPause = false;

  // Typing animation
  private typingLines:   string[] = [];
  private typingLineIdx  = 0;
  private typingCharIdx  = 0;
  private typingTimer    = 0;
  private readonly CHAR_DELAY = 44; // ms between characters

  // Scene mode
  private mode: "typing" | "waiting" | "text-input" | "choice" | "done" = "typing";

  // Text input state
  private inputBuffer  = "";
  private inputSaveKey = "";

  // Choice state
  private choiceOptions:  string[] = [];
  private choiceIndex    = 0;
  private choiceSaveKey  = "";

  // Cursor blink
  private cursorTimer   = 0;
  private cursorVisible = true;

  // Phaser text objects
  private speakerLabel!: Phaser.GameObjects.Text;
  private mainText!:     Phaser.GameObjects.Text;
  private promptText!:   Phaser.GameObjects.Text;

  // Keyboard
  private cursors!:   Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!:  Phaser.Input.Keyboard.Key;
  private spaceKey!:  Phaser.Input.Keyboard.Key;

  constructor() { super({ key: "PrologueScene" }); }

  // ---- Lifecycle ------------------------------------------------------------

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);

    this.drawPhone();
    this.createTextObjects();
    this.setupKeyboard();
    this.runStep();
  }

  update(_time: number, delta: number): void {
    if (this.mode === "done") return;

    // Autonomous pause between steps
    if (this.inPause) {
      this.pauseTimer += delta;
      if (this.pauseTimer >= this.pauseTarget) {
        this.inPause = false;
        this.stepIndex++;
        this.runStep();
      }
      return;
    }

    // Cursor blink
    this.cursorTimer += delta;
    if (this.cursorTimer >= 500) {
      this.cursorTimer   = 0;
      this.cursorVisible = !this.cursorVisible;
    }

    switch (this.mode) {
      case "typing":     this.updateTyping(delta); break;
      case "waiting":    this.updateWaiting();     break;
      case "text-input": this.updateTextInput();   break;
      case "choice":     this.updateChoice();      break;
    }
  }

  // ---- Phone drawing --------------------------------------------------------

  private drawPhone(): void {
    const g = this.add.graphics();

    // Body
    g.fillStyle(0x1a1c2e);
    g.fillRoundedRect(CX - PW / 2, CY - PH / 2, PW, PH, 18);

    // Body edge highlight
    g.lineStyle(2, 0x2d3055, 1);
    g.strokeRoundedRect(CX - PW / 2, CY - PH / 2, PW, PH, 18);

    // Screen bezel
    g.fillStyle(0x0d1020);
    g.fillRect(SCR_X - 8, SCR_Y - 8, SCR_W + 16, SCR_H + 16);

    // Screen
    g.fillStyle(0x040810);
    g.fillRect(SCR_X, SCR_Y, SCR_W, SCR_H);

    // Screen glow border
    g.lineStyle(1, 0x0055aa, 0.9);
    g.strokeRect(SCR_X, SCR_Y, SCR_W, SCR_H);

    // Speaker grille (above screen)
    g.fillStyle(0x252840);
    g.fillRoundedRect(CX - 32, CY - PH / 2 + 18, 64, 7, 3);
    // Grille lines
    g.lineStyle(1, 0x0d1020, 1);
    for (let i = 0; i < 5; i++) {
      const lx = CX - 32 + 10 + i * 11;
      g.lineBetween(lx, CY - PH / 2 + 19, lx, CY - PH / 2 + 24);
    }

    // Front camera dot
    g.fillStyle(0x111122);
    g.fillCircle(CX + 58, CY - PH / 2 + 22, 5);
    g.lineStyle(1, 0x1a2244, 1);
    g.strokeCircle(CX + 58, CY - PH / 2 + 22, 5);

    // NOKIA brand text (below screen)
    this.add.text(CX, SCR_Y + SCR_H + 14, "NOKIA", {
      fontFamily: "'Press Start 2P'",
      fontSize: "8px",
      color: "#252840",
    }).setOrigin(0.5, 0);

    // Navigation row: call button | oval nav | end button (Nokia style, no D-pad)
    const navY = CY + 60;

    // Left soft key — call (subtle green tint)
    g.fillStyle(0x1a2520);
    g.fillRoundedRect(CX - 140, navY - 11, 82, 22, 4);
    g.lineStyle(1, 0x223028, 1);
    g.strokeRoundedRect(CX - 140, navY - 11, 82, 22, 4);

    // Centre nav oval — small, not a D-pad cross
    g.fillStyle(0x252840);
    g.fillEllipse(CX, navY, 42, 30);
    g.lineStyle(1, 0x30345a, 1);
    g.strokeEllipse(CX, navY, 42, 30);
    g.fillStyle(0x1c1e32);
    g.fillCircle(CX, navY, 7);

    // Right soft key — end (subtle red tint)
    g.fillStyle(0x25181a);
    g.fillRoundedRect(CX + 58, navY - 11, 82, 22, 4);
    g.lineStyle(1, 0x352020, 1);
    g.strokeRoundedRect(CX + 58, navY - 11, 82, 22, 4);

    // Number key grid: 4 rows × 3 cols (12 keys total, like a real Nokia)
    g.lineStyle(0, 0, 0);
    g.fillStyle(0x1e2135);
    const kW = 70, kH = 20, kGap = 6;
    const kLeft = CX - 111;
    const kTop  = CY + 105;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        g.fillRoundedRect(
          kLeft + col * (kW + kGap),
          kTop  + row * (kH + kGap),
          kW, kH, 3,
        );
      }
    }

    // Side buttons (right edge)
    g.fillStyle(0x14162a);
    g.fillRoundedRect(CX + PW / 2 - 10, CY - 120, 8, 40, 3);
    g.fillRoundedRect(CX + PW / 2 - 10, CY - 65,  8, 25, 3);
  }

  // ---- Text objects ---------------------------------------------------------

  private createTextObjects(): void {
    const screenFont = {
      fontFamily: "'Press Start 2P'",
      fontSize: "9px",
      color: "#00ff88",
      wordWrap: { width: TXT_W },
      lineSpacing: 7,
    };

    // Speaker tag at top of screen
    this.speakerLabel = this.add.text(TXT_X, TXT_Y, "", {
      ...screenFont,
      fontSize: "8px",
      color: "#004422",
    });

    // Main dialogue / input display
    this.mainText = this.add.text(TXT_X, TXT_Y + 22, "", {
      ...screenFont,
      color: "#00ff88",
    });

    // Bottom prompt line — padding top prevents Press Start 2P ascenders being clipped
    this.promptText = this.add.text(TXT_X, PROMPT_Y, "", {
      ...screenFont,
      fontSize: "8px",
      color: "#ffcc00",
      padding: { top: 6, bottom: 0, left: 0, right: 0 },
    });
  }

  // ---- Keyboard setup -------------------------------------------------------

  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    this.cursors  = kb.createCursorKeys();
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Character capture for text input mode
    kb.on("keydown", (event: KeyboardEvent) => {
      if (this.mode !== "text-input") return;

      if (event.key === "Backspace") {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        return;
      }
      if (event.key === "Enter") {
        this.submitTextInput();
        return;
      }
      // Printable ASCII only, max 14 chars
      if (event.key.length === 1 && this.inputBuffer.length < 14) {
        this.inputBuffer += event.key;
        playBlip();
      }
    });
  }

  // ---- Script runner --------------------------------------------------------

  private runStep(): void {
    if (this.stepIndex >= SCRIPT.length) {
      this.finishPrologue();
      return;
    }

    const step = SCRIPT[this.stepIndex];

    if (step.kind === "say") {
      const lines = step.lines.map(l => this.fmt(l));
      this.speakerLabel.setText(step.speaker === "ai" ? "< AI >" : "< SYSTEM >")
                        .setColor(step.speaker === "ai" ? "#006633" : "#003366");
      this.startTyping(lines);

    } else if (step.kind === "pause") {
      this.inPause     = true;
      this.pauseTimer  = 0;
      this.pauseTarget = step.ms;

    } else if (step.kind === "input") {
      this.mode        = "text-input";
      this.inputBuffer = "";
      this.inputSaveKey = step.saveKey;
      this.speakerLabel.setText("< YOU >").setColor("#554400");
      this.mainText.setText("");
      this.promptText.setText(step.prompt);

    } else if (step.kind === "choice") {
      this.mode          = "choice";
      this.choiceOptions = step.options;
      this.choiceIndex   = 0;
      this.choiceSaveKey = step.saveKey;
      this.speakerLabel.setText("< YOU >").setColor("#554400");
      this.promptText.setText("↑↓ select   ENTER confirm");
      this.renderChoices();
    }
  }

  // ---- Mode updates ---------------------------------------------------------

  private startTyping(lines: string[]): void {
    this.typingLines   = lines;
    this.typingLineIdx = 0;
    this.typingCharIdx = 0;
    this.typingTimer   = 0;
    this.mode          = "typing";
    this.mainText.setText("");
    this.promptText.setText("");
  }

  private updateTyping(delta: number): void {
    this.typingTimer += delta;
    if (this.typingTimer < this.CHAR_DELAY) return;
    this.typingTimer = 0;

    const line = this.typingLines[this.typingLineIdx] ?? "";

    if (this.typingCharIdx < line.length) {
      this.typingCharIdx++;
      if (line[this.typingCharIdx - 1].trim()) playBlip();

      const revealed = [
        ...this.typingLines.slice(0, this.typingLineIdx),
        line.slice(0, this.typingCharIdx),
      ].join("\n");
      this.mainText.setText(revealed);

    } else if (this.typingLineIdx < this.typingLines.length - 1) {
      // Gap between lines
      this.typingTimer   = -180;
      this.typingLineIdx++;
      this.typingCharIdx = 0;

    } else {
      // All lines done
      this.mode = "waiting";
      this.promptText.setText("SPACE to continue");
    }
  }

  private updateWaiting(): void {
    const pressed =
      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this.enterKey);
    if (pressed) {
      playBlip();
      this.stepIndex++;
      this.runStep();
    }
  }

  private updateTextInput(): void {
    const cursor = this.cursorVisible ? "_" : " ";
    this.mainText.setText(this.inputBuffer + cursor);
  }

  private submitTextInput(): void {
    if (this.inputBuffer.trim().length === 0) return;
    this.answers[this.inputSaveKey] = this.inputBuffer.trim();
    playBlip();
    this.stepIndex++;
    this.runStep();
  }

  private updateChoice(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.choiceIndex = (this.choiceIndex - 1 + this.choiceOptions.length) % this.choiceOptions.length;
      this.renderChoices();
      playBlip();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.choiceIndex = (this.choiceIndex + 1) % this.choiceOptions.length;
      this.renderChoices();
      playBlip();
    }
    if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.answers[this.choiceSaveKey] = this.choiceOptions[this.choiceIndex];
      playBlip();
      this.stepIndex++;
      this.runStep();
    }
  }

  private renderChoices(): void {
    const lines = this.choiceOptions.map((opt, i) =>
      (i === this.choiceIndex ? "> " : "  ") + opt,
    );
    this.mainText.setText(lines.join("\n"));
  }

  // ---- Helpers --------------------------------------------------------------

  private fmt(text: string): string {
    return text
      .replace(/{aiName}/g,     this.answers["aiName"]     ?? "")
      .replace(/{playerName}/g, this.answers["playerName"] ?? "");
  }

  // ---- Finish ---------------------------------------------------------------

  private finishPrologue(): void {
    this.mode = "done";

    const store = new LocalStorageSaveStore();
    const save  = store.load() ?? makeDefaultSave();
    save.ai.playerGivenName   = this.answers["aiName"]     ?? "";
    save.ai.playerName        = this.answers["playerName"] ?? "";
    save.ai.prologueAnswers   = {
      q1: this.answers["q1"] ?? "",
      q2: this.answers["q2"] ?? "",
    };
    store.save(save);

    this.cameras.main.fadeOut(1500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("LevelScene");
    });
  }
}

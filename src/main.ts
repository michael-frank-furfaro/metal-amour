// main.ts — entry point. Boots Phaser and launches the first scene.
// Scenes to build: PrologueScene → LevelScene → WorkshopScene → EndgameScene

import "./style.css";
import Phaser from "phaser";

// Orientation config — change this to "vertical" to flip all scenes.
// Should be the only place in the codebase that knows about orientation.
export const ORIENTATION: "horizontal" | "vertical" = "horizontal";

export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0c0a1c",
  parent: "app",
  pixelArt: true,
  scene: [
    // Scenes will be registered here as they are built:
    // PrologueScene,
    // LevelScene,
    // WorkshopScene,
    // EndgameScene,
  ],
};

new Phaser.Game(config);

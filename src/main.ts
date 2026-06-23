// main.ts — entry point. Boots Phaser and launches the first scene.
// Scenes to build: PrologueScene → LevelScene → WorkshopScene → EndgameScene

import "./style.css";
import Phaser from "phaser";
import { PrologueScene } from "./ui/PrologueScene.ts";
import { LevelScene }    from "./ui/LevelScene.ts";

export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#000000",
  parent: "app",
  pixelArt: true,
  scene: [
    PrologueScene,
    LevelScene,
    // WorkshopScene,
    // EndgameScene,
  ],
};

new Phaser.Game(config);

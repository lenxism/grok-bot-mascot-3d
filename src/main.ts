import "./style.css";
import markSvg from "../assets/grok-bot-mark.svg?raw";
import { createDefaultState } from "./state";
import { parseMark } from "./mark";
import { GrokBot } from "./GrokBot";
import { createStudio } from "./studio";
import { bindController } from "./controller";

const canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #scene is missing.");
}

const studio = createStudio(canvas);
const mark = parseMark(markSvg);
const bot = new GrokBot(mark);
bot.group.position.y = -bot.minY + 0.02;
studio.scene.add(bot.group);
studio.groundY(-0.002);
studio.controls.target.set(0, 0.18, 0);
studio.controls.update();

const state = createDefaultState();
bindController(state, { bot, controls: studio.controls });

const tick = () => {
  const dt = Math.min(studio.clock.getDelta(), 0.05);
  bot.update(dt, state);
  studio.controls.update();
  studio.renderer.render(studio.scene, studio.camera);
  requestAnimationFrame(tick);
};

tick();
canvas.dataset.ready = "true";

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
const lift = -bot.minY + 0.02;
bot.group.position.y = lift;
studio.scene.add(bot.group);
studio.groundY(0);

const focusY = lift + 0.22;
studio.camera.position.set(0.28, focusY + 0.12, 5.65);
studio.controls.target.set(0, focusY, 0);
studio.controls.update();
studio.controls.saveState();

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

import {
  createDefaultState,
  isExpression,
  type BotState,
  type Expression,
} from "./state";
import type { GrokBot } from "./GrokBot";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

type BindOptions = {
  bot: GrokBot;
  controls: OrbitControls;
};

export function bindController(state: BotState, { bot, controls }: BindOptions): void {
  const root = document.getElementById("controller");
  if (!root) {
    throw new Error("Controller panel is missing.");
  }

  const yaw = mustInput("yaw");
  const pitch = mustInput("pitch");
  const scale = mustInput("scale");

  const setExpression = (expression: Expression) => {
    state.expression = expression;
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-expression]")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.expression === expression ? "true" : "false",
      );
    }
  };

  const setToggle = (key: "bounce" | "spin", value: boolean) => {
    state[key] = value;
    const button = root.querySelector(`[data-toggle="${key}"]`);
    button?.setAttribute("aria-pressed", value ? "true" : "false");
  };

  const syncSliders = () => {
    yaw.value = String(Math.round((state.yaw * 180) / Math.PI));
    pitch.value = String(Math.round((state.pitch * 180) / Math.PI));
    scale.value = String(Math.round(state.scale * 100));
    setReadout("yaw", `${yaw.value}°`);
    setReadout("pitch", `${pitch.value}°`);
    setReadout("scale", Number(state.scale).toFixed(2));
  };

  const reset = () => {
    const next = createDefaultState();
    Object.assign(state, next);
    bot.resetMotion();
    controls.reset();
    setExpression("idle");
    setToggle("bounce", false);
    setToggle("spin", false);
    syncSliders();
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const expression = target.dataset.expression;
    if (expression && isExpression(expression)) {
      setExpression(expression);
      return;
    }
    const toggle = target.dataset.toggle;
    if (toggle === "bounce" || toggle === "spin") {
      setToggle(toggle, !state[toggle]);
      return;
    }
    const action = target.dataset.action;
    if (action === "nod") {
      state.nodToken += 1;
      return;
    }
    if (action === "wave") {
      state.waveToken += 1;
      return;
    }
    if (action === "reset") {
      reset();
    }
  });

  yaw.addEventListener("input", () => {
    state.yaw = (Number(yaw.value) * Math.PI) / 180;
    setReadout("yaw", `${yaw.value}°`);
  });
  pitch.addEventListener("input", () => {
    state.pitch = (Number(pitch.value) * Math.PI) / 180;
    setReadout("pitch", `${pitch.value}°`);
  });
  scale.addEventListener("input", () => {
    state.scale = Number(scale.value) / 100;
    setReadout("scale", state.scale.toFixed(2));
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key) {
      case "1":
        setExpression("idle");
        break;
      case "2":
        setExpression("happy");
        break;
      case "3":
        setExpression("blink");
        break;
      case "4":
        setExpression("look-around");
        break;
      case "n":
      case "N":
        state.nodToken += 1;
        break;
      case "w":
      case "W":
        state.waveToken += 1;
        break;
      case "b":
      case "B":
        setToggle("bounce", !state.bounce);
        break;
      case "s":
      case "S":
        setToggle("spin", !state.spin);
        break;
      case "r":
      case "R":
        reset();
        break;
      case " ":
        event.preventDefault();
        state.blinkToken += 1;
        break;
      case "ArrowLeft":
        state.yaw = clamp(state.yaw + 0.08, -Math.PI, Math.PI);
        syncSliders();
        break;
      case "ArrowRight":
        state.yaw = clamp(state.yaw - 0.08, -Math.PI, Math.PI);
        syncSliders();
        break;
      case "ArrowUp":
        state.pitch = clamp(state.pitch - 0.05, -0.7, 0.7);
        syncSliders();
        break;
      case "ArrowDown":
        state.pitch = clamp(state.pitch + 0.05, -0.7, 0.7);
        syncSliders();
        break;
      case "[":
        state.scale = clamp(state.scale - 0.04, 0.7, 1.4);
        syncSliders();
        break;
      case "]":
        state.scale = clamp(state.scale + 0.04, 0.7, 1.4);
        syncSliders();
        break;
      default:
        break;
    }
  });

  syncSliders();
}

function mustInput(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Missing range input #${id}`);
  }
  return el;
}

function setReadout(name: string, text: string): void {
  const el = document.querySelector(`[data-readout="${name}"]`);
  if (el) {
    el.textContent = text;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

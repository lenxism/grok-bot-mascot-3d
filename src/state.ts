export type Expression = "idle" | "happy" | "blink" | "look-around";

export type BotState = {
  expression: Expression;
  yaw: number;
  pitch: number;
  scale: number;
  bounce: boolean;
  spin: boolean;
  nodToken: number;
  waveToken: number;
  blinkToken: number;
};

export const EXPRESSIONS = [
  "idle",
  "happy",
  "blink",
  "look-around",
] as const satisfies readonly Expression[];

export function createDefaultState(): BotState {
  return {
    expression: "idle",
    yaw: 0,
    pitch: 0,
    scale: 1,
    bounce: false,
    spin: false,
    nodToken: 0,
    waveToken: 0,
    blinkToken: 0,
  };
}

export function isExpression(value: string): value is Expression {
  return (EXPRESSIONS as readonly string[]).includes(value);
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

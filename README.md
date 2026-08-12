# Grok Bot 3D

A small Three.js app that turns the official Grok Bot mark into a controllable 3D mascot.

The head is a real mesh inflated from `assets/grok-bot-mark.svg`, not a PNG billboard. Two white capsule eyes sit on that surface and can blink, squint, and glance. Idle breathing is on by default.

[@lenxism](https://x.com/lenxism)

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build
npm run preview
```

## Controls

On-page panel:

- Expression: idle, happy, blink, look
- Yaw / pitch / scale
- Bounce and spin toggles
- Nod and wave one-shots
- Reset

Keyboard:

| Key | Action |
| --- | --- |
| `1` `2` `3` `4` | Idle, happy, blink, look |
| `N` / `W` | Nod / wave |
| `B` / `S` | Bounce / spin |
| `Space` | Blink |
| Arrow keys | Yaw and pitch |
| `[` `]` | Scale |
| `R` | Reset |

Drag the canvas to orbit. Scroll to zoom.

## Files

- `assets/` official mark (SVG + PNG)
- `src/mark.ts` reads the SVG paths
- `src/pebbleGeometry.ts` builds the 3D head
- `src/GrokBot.ts` eyes, expressions, motion
- `src/controller.ts` panel + keyboard
- `CASE.md` how this was made
- `docs/` screenshots

## Stack

Vite, TypeScript, Three.js.

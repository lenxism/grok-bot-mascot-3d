# Case: 3D Grok Bot mascot

Grok Bot orchestrated Cursor agents (model: Grok 4.6) to turn the official x.ai/bot mark into a controllable 3D character.

## Goal

Ship a web demo where the black pebble and two tilted white capsule eyes read as the same mascot as the 2D mark, then let a visitor pose it.

## What the agent did

1. Read `assets/grok-bot-mark.svg` as the source of truth for silhouette and eye placement.
2. Sampled the head path, built a polar radius table, and inflated that outline into a closed mesh. Front view matches the mark. Depth is a slightly flattened ellipsoid, with light noise so it is not a perfect sphere.
3. Placed two capsule meshes on the surface using the SVG eye paths (centroid, principal axis, width, length). Blink squashes the short axis. Happy is a squint. Look-around slides both eyes together so they stay a pair.
4. Added a studio scene: light gray background, key / fill / rim lights, contact blob plus a shadow-catching floor.
5. Wired an on-page controller for expressions, yaw/pitch/scale, bounce, spin, nod, wave, and reset. Keyboard shortcuts sit under the panel.

## What it is not

No extra face parts. No new colors. No billboard sprite. The 2D PNG is only used as the favicon and the small corner mark.

## How to judge it

Stand in front of the character. The glance should still be high-right, the body near-black (`#0A0A0A`), the eyes white capsules. Then orbit. It should still feel like a pebble, not a coin and not a bowling ball.

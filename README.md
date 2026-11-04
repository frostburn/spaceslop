# Spaceslop

Vibe-coded vertical shooter for the browser (PWA). The first playable slice has four scrolling waves, a camera transition, and a head-on interceptor fight.

## Play locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Drag anywhere on the playfield to steer. The ship flies toward the drag target at a limited speed. On a keyboard use WASD or the arrow keys. Guns fire automatically. Use Pulse or Space to clear incoming fire, and Pause or Escape to pause. In the boss fight, line up horizontally to lock on and move away from the warning rings before the volley arrives.

## Assets and offline play

The entire run plays with procedural shapes and works without media files. Generated media goes through chat review and is uploaded by the owner. See [AGENTS.md](AGENTS.md).

Run `npm run build` and serve `dist/` over HTTPS for a deployment. Use `npm run preview` for a local production check. Once the title screen reports **Ready offline**, reload offline and play a run. The standalone manifest picks up the owner-supplied `public/icons/spaceslop-192.png` and `public/icons/spaceslop-512.png` when present. Supply both for Chrome's install promotion.

Choose Vex, Brass, or Glint on the title or results screen. The selected pilot is remembered on the device. On desktop, the portrait and flight controls sit beside the playfield.

To install the optional pilot art, place square PNGs at `public/pilots/vex.png`, `public/pilots/brass.png`, and `public/pilots/glint.png`, then rebuild. The build precaches the portraits it finds. Missing or unreadable images fall back to callsign tiles.

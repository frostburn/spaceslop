# Spaceslop

Vibe-coded vertical shooter for the browser (PWA). The first playable slice has four scrolling waves, a camera transition, and a head-on interceptor fight.

## Play locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Tap or click the playfield to send the drone to that point. It parks and fires automatically. Drag from the same touch to steer the ship while the drone covers its lane. On a keyboard use WASD or the arrow keys. Guns fire automatically. Use Pulse or Space to clear incoming fire, and Pause or Escape to pause. In the boss fight, line up horizontally to lock on with the ship. Put the drone on the green cannon marker to hit that hardpoint, and keep the ship clear of amber warning rings. The exposed cannon changes after each volley.

Choose **Sentry** or **Towline** before launch. With Towline equipped, park the drone and drag the ship to sweep the arc through enemy formations. The arc pulses automatically while the drone is parked. Against the boss, sweep the line across the green cannon during a pulse.

Enemies can drop wing weapons. Fly through a pickup to equip a pod that flies alongside your ship. An empty slot takes priority, and with both occupied the pickup replaces the pod on the side where you collected it. For testing, expand **Test wing loadout** before launch to equip either wing immediately. The picker is available in Vite dev and on builds opened with `?testLoadout=1`.

- **Homing Cannon** fires weak guided missiles.
- **Standard Cannon** fires straight down its lane.
- **Continuous Laser** builds damage while it stays on one target.
- **Omega Cannon** charges slowly and fires a heavy bolt through multiple enemies.

During boss fights, line a wing up horizontally with the green cannon. Homing missiles steer toward it automatically.

The second wave includes a feathered raptor. Its wings fold before it dives along its lane. At the boss, the draconian ace turns toward the camera, then the active cannon glows during its windup and recoils on the volley.

The procedural encounter rigs live in `src/encounter-rigs.ts`. A future model can use the same local pose and pivot names while the simulation owns movement, attack timing, and hitboxes. The interceptor's `muzzle_L` and `muzzle_R` pivots line up with the existing cannon lanes.

## Asset workshop

Run `npm run dev` and open **Asset workshop** from the game menu or visit `/workshop.html`. Orbit and zoom the raptor, ships, or wing weapon pods. Switch camera presets, scrub or play the animated rigs, and toggle wireframe. The workshop uses the game rigs and the optional alloy texture.

## Assets and offline play

The entire run plays with procedural shapes and works without media files. Generated media goes through chat review and is uploaded by the owner. See [AGENTS.md](AGENTS.md).

Run `npm run build` and serve `dist/` over HTTPS for a deployment. Use `npm run preview` for a local production check. Once the title screen reports **Ready offline**, reload offline and play a run. The standalone manifest picks up the owner-supplied `public/icons/spaceslop-192.png` and `public/icons/spaceslop-512.png` when present. Supply both for Chrome's install promotion.

Choose Vex, Brass, or Glint on the title or results screen. The selected pilot is remembered on the device. On desktop, the portrait, perk status, and flight controls sit beside the playfield.

- **Vex · Close Call** grants one extra Pulse after four enemy-shot grazes per stage.
- **Brass · Field Repair** restores one hull the first time you replace an equipped wing weapon while damaged.
- **Glint · Hot Dock** doubles the first Sentry shot or Towline pulse after the drone completes a move of at least three playfield units. The perk cools down for three seconds after the attack.

To install the optional pilot art, place square PNGs at `public/pilots/vex.png`, `public/pilots/brass.png`, and `public/pilots/glint.png`, then rebuild. The build precaches the portraits it finds. Missing or unreadable images fall back to callsign tiles.

The encounter textures and backdrops are optional PNGs. Add the reviewed files and rebuild to precache them for offline play. The workshop also shows the model textures.

| File | Surface |
| --- | --- |
| `public/encounters/interceptor-metal.png` | Tileable brushed metal for ship and pod armor and the corridor bridge |
| `public/encounters/feather-vane.png` | Raptor wing and tail feathers and the ace's crest. Orient the root down and tip up. |
| `public/encounters/draconian-scales.png` | Tileable draconian face, snout, and jaw |
| `public/encounters/preserve-backdrop.png` | Portrait, top-down scenery. It scrolls underneath the procedural ferns. |
| `public/encounters/shipyard-backdrop.png` | Portrait backdrop for the boss approach and fight. |

The preserve catwalks and orbital shipyard also have procedural scenery that runs without background images.

# Spaceslop

Vibe-coded vertical shooter for the browser (PWA), with selectable preserve and ant hive prototype levels, scrolling waves, a camera transition, and a head-on boss fight.

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

Each gun has its own projectile silhouette and trail: cyan ship darts, mint drone pulses, finned homing missiles, cannon tracers, and gold omega lances. Enemy plasma and hive spores have bright centers and dark rims. Lasers ripple along their length and flare against the visible front edge of their target's model, including bosses. The rendering traces the projected opaque silhouette independently of the damage hitbox. Muzzle flashes, hit sparks, and collection bursts give immediate feedback; damage sparks and laser contact flares render over enemy shells and mold. Wing pickups use metal badges with matching colors and distinct weapon icons, rotating beacons, and a short arrival animation. The homing icon is a fixed crosshair with two shrinking lock-on circles. These effects use shared geometry and pooled instances, are warmed before launch, and need no new asset files.

Choose a level before launch. **Broodlock · Ant hive** is the default: a 28-second traversal of the three-screen hive strip, six waves of infected ants, then a brood guardian. Workers fire aimed spores; larger soldiers charge their amber vents before a three-spore fan. The guardian uses the existing alternating hardpoint, warning-ring, and volley mechanics. The procedural ants have textured chitin, segmented abdomens, elbowed antennae, serrated mandibles, and a jointed six-leg gait. Soldiers have broader heads and larger jaws. Their eyes are cloudy and pale, a long fruiting stalk emerges from the head, and branching parasite colonies and crust spread across their bodies. Five soft mold sprites coat the abdomen, thorax, and head. These planes always face the camera, including while orbiting in the workshop, and leave the amber attack vents readable.

Procedural mushrooms attach to fixed coordinates on the hive strip. Their mycelial roots and contact shadows meet the painted pipes and rock, while tapered stems bend sideways and return toward the camera. Caps follow the direction of each neck, with modeled rims and underside gills. The hive uses a shallow perspective view so the caps have foreground parallax while their roots stay on the same source pixels throughout scrolling and the boss approach.

Stems and caps obstruct the fighter, drone, and wing pods. Contact slides craft along the growth without damaging hull. A blocked touch target releases immediately; a blocked drone parks at the surface, and Glint's Hot Dock counts the actual completed move. Scrolling growth pushes a parked craft clear, including at screen edges. The central flight lane remains open. Collision shapes use the same curves, cap profiles, and projection as the models, and do not depend on texture files.

Ants look ahead along their path and steer into clear lanes before reaching a fruiting body. They bank gently during detours and ease back toward their original lane afterward. Collision clearance also keeps their bodies and legs out of stems and caps. Their avoidance is identical with art and placeholders.

**Overgrown preserve** keeps the original four waves and draconian interceptor fight. Its second wave includes a feathered raptor whose wings fold before a dive. Use `?level=preserve` to open that level directly.

The procedural encounter rigs live in `src/encounter-rigs.ts`. A future model can use the same local pose and pivot names while the simulation owns movement, attack timing, and hitboxes. The interceptor's `muzzle_L` and `muzzle_R` pivots line up with the existing cannon lanes.

Run `npm test` for the hive movement regression checks: keyboard and touch contact, fast movement, scrolling edge traps, drone docking, the open boss lane, and ant detours across the scrolling strip.

## Asset workshop

Run `npm run dev` and open **Asset workshop** from the game menu or visit `/workshop.html`. Orbit and zoom the raptor, ships, worker and soldier ants, guardian, mushroom cluster, wing weapon pods, ammunition, or powerups. Switch camera presets, scrub or play the animated rigs and effects, and toggle wireframe. The workshop uses the game rigs and textures. Its side view exposes the mushroom roots, projecting stems, cap rim, and gills.

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
| `public/encounters/broodlock-foreground.png` | RGBA 720 × 3840 three-screen hive strip. Preserve its alpha and orientation; it traverses bottom to top once, without mirroring or repeating. |
| `public/encounters/broodlock-mines-mask.png` | Grayscale mask with the exact foreground dimensions and alignment. White reveals mines through the central channel and bridge grating; black reveals stars through exterior holes. Loaded as linear data. |
| `public/encounters/broodlock-stars.png` | Opaque portrait starfield, fixed in screen space. sRGB; no tiling required. |
| `public/encounters/broodlock-mines.png` | Opaque portrait dark mine plate, scrolling much more slowly than the hive. sRGB; no tiling required. |
| `public/encounters/ant-chitin.png` | Optional tileable 512 × 512 RGB albedo for ant shells, limbs, and guardian appendages. sRGB, repeated 1.2 times across the model UVs. |
| `public/encounters/broodlock-fungus.png` | Optional tileable 512 × 512 RGB albedo for mushroom caps, stems, and ant infection growths. sRGB, repeated 1.1 times across the model UVs. |
| `public/encounters/ant-mold.png` | Optional 512 × 512 RGBA fuzzy mold patch for camera-facing body infection. Preserve soft alpha, use sRGB and clamp-to-edge; no tiling or opaque background. |

The preserve catwalks and orbital shipyard also have procedural scenery that runs without background images.

Broodlock composites the two distant plates under the alpha foreground, using the matching mask to distinguish the central mine channel from the holes into space. Neither plate is baked into the foreground. The scene freezes at the end of the strip for the guardian. Each file is optional: missing plates use code-drawn stars or mine ribs, and a missing foreground uses procedural side rails and brood chambers. Without a mask, a simple central-channel split is used. New hive geometry and textures join the preflight warm-up so the first ant and guardian do not trigger their initial uploads during play.

Ant and mushroom surfaces retain deterministic code-drawn color, bump, and roughness detail without the chitin and fungus albedo files. Those two optional PNGs replace color only; keep them opaque and do not import them as normal maps. The mold patch instead needs alpha, and has a procedural fuzzy fallback when absent or unreadable. Its sprites share materials, blend over the shell, and do not write depth. With no hive foreground, procedural side rails meet the same mushroom roots; positions and collision remain identical. The prototype strip always spans three screens. Shared mushroom, parasite, and mold rendering is warmed before launch, including the variants farther up the strip. Layout and collision live in `src/hive-layout.ts` and `src/hive-collision.ts`, ant avoidance in `src/ant-navigation.ts`, meshes in `src/hive-fungi.ts`, `src/ant-rigs.ts`, and `src/ant-parasite.ts`, and mold sprites in `src/ant-mold.ts`; no model download is required.

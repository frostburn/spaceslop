# Architecture and maintenance

## Entry points and ownership

| Location | Responsibility |
| --- | --- |
| `src/main.ts` | Lightweight sector menu, session entry/exit and update prompt. No renderer or game imports. |
| `src/levels.ts` | Small menu catalog, shared route durations and level IDs; layout modules derive their duration from it. Keep it independent of scene constructors. |
| `src/app/flight-session.ts` | One hangar/run: HUD, preparation, simulation clock, pause/results and context recovery. |
| `src/app/input.ts` | Scoped keyboard and pointer controls. All listeners end with the session's abort signal. |
| `src/app/offline.ts` | Save/check selected level packages without downloading other sectors. |
| `src/game.ts` | Shared deterministic flight/combat simulation; level math remains in the named layout/combat modules. |
| `src/view.ts` | Shared camera, ship, weapons, feedback and warm-up. A view belongs to one level. |
| `src/rendering/level.ts` | Typed level renderer contract: roots, frames, actor models, boss contact, warm-up and disposal. |
| `src/rendering/loaders.ts` | The six dynamic rendering entry points. |
| `src/rendering/levels/*.ts` | Level-owned scenery, actors, boss posing, texture loading, capture and effects. |
| `src/assets/catalog.ts` | One media path catalog and an explicit list of textures used by each level. |
| `src/encounter-texture.ts` | Optional texture loading, bounded deadlines and safe fallbacks. No enemy imports. |
| `scripts/level-packages.ts` | Build the menu's static dependency closure and each level's offline package. |
| `scripts/check-build.mjs` | Enforce menu budget, package isolation and production exclusions. |

Existing level geometry, rig and layout modules retain their descriptive prefixes (`preserve-*`, `vent-*`, `io-*`, `titan-*`, `ice-*`, `hive-*`, marine/ant helpers). The renderer entry point shows which pieces a stage uses. Shared effects stay separate from simulation geometry. The asset workshop intentionally loads the full model collection and its texture helper; it is a development entry point only.

## Startup and session lifecycle

The initial HTML/CSS and menu contain no WebGL context, game loop, pilot images or level media. Selecting a card changes metadata only. **Prepare flight** imports the session and shared engine, then invokes only the selected level factory. That factory constructs its scenery/actor pools and loads its media. Preflight uploads that level's resources and shared weapons before enabling launch.

A session's abort signal owns controls, focus/media listeners, resize observation, preparation and the animation loop. Returning to the menu cancels them. Each session gets a fresh canvas; disposing an older context cannot accidentally destroy a new renderer on the same canvas. The session abort signal stops pending texture application and Titan slicing. Disposal waits for those preparation promises, releases render targets, geometry, material/texture GPU resources and the context, and clears uploaded image maps on shared materials. JavaScript modules remain in the browser's module cache between visits.

If a module download fails, the menu offers **Reload menu** before retrying; native module-map failures can survive a reconnect in the same page.

Simulation is fixed-step. Presentation time freezes on pause/results. Preserve that distinction when adding animation. `FlightView` rejects a flight from a different level: switching sectors requires a new session rather than mutating a live renderer.

## Level renderer contract

A factory returns a `LevelScene`. Its root contains only that stage's objects. `update(frame)` poses scenery, boss and enemies; `models[index]` identifies the currently visible living model for the corresponding simulation enemy, so laser contact remains correct. `contact` maps boss targets to posed weakpoints. Optional `orientation`, `reveal`, `capture` and `effects` hooks cover stages with special cameras or refraction.

List all actor contact models and warm-up batches, including broken/severed phases and later-wave variants. `prepare` primes stage effects; `afterWarmup` restores temporary priming state. Own any offscreen render target through `dispose`. Do not allocate unbounded geometry, programs or particle pools as waves spawn.

## Assets, cache and deployment

Vite hashes the contents of existing optional media into query versions. Missing files do not generate image requests. A level factory loads its own catalog entries; shared ship armor and the hangar portraits are the common media.

The service worker precaches only the static menu dependency closure, its registration helper and `level-packages.json`. Dynamic imports are deliberately excluded from that traversal. The generated package manifest contains the shared session code plus the selected renderer's static dependency closure and that level's media. Preparing a level caches that package. The menu can check complete code packages without downloading their contents, and its offline-storage control can release all saved level files without clearing the shell or pilot preference. The runtime cache also serves image/script/style requests. Shell readiness and level readiness have different UI wording; the initial menu alone does not imply every stage works offline.

Rebuild after owner art uploads. Test changed media at the same filename to catch stale-cache regressions. Use Vite's base URL throughout; never hard-code `/assets/` or `/encounters/` at runtime. Validate both root and subpath deployments. HTTPS is required for service workers outside localhost. Keep deployment entry files revalidatable and hashed chunks available long enough for existing tabs.

## Adding or changing a stage

1. Add its menu metadata/ID and simulation rules. Keep the menu catalog free of rendering dependencies.
2. Add a renderer factory under `rendering/levels`, register its dynamic loader, and declare its media in the asset catalog.
3. Supply procedural fallbacks, pooled actor/contact mappings and complete warm-up/disposal hooks.
4. Extend the package/build isolation check for a new ID. Check network requests: menu selection must not fetch stage code or pictures; preparation must not fetch another stage's media.
5. Verify stage, approach, boss phases, lasers, restart, pause/resume, cancellation and switching away/back. For loading changes, complete a production offline run with art and a media-free run. Include a portrait viewport and clean console check.

`npm test` covers simulation, geometry, contacts and effects. `npm run build` also checks unused locals/parameters. `npm run test:build` checks delivery boundaries. Browser checks cover actual WebGL, lifecycle and service-worker behavior; a successful TypeScript build alone cannot establish those.

## Orbital preserve scenery

`preserve-lighting.ts` shares the cool-white fluorescent fill and grazing violet UV rim with the workshop. Ceiling-edge tube housings and UV strips live in the station batches, using the same color as the rim and its soft halos. The broad key retains reduced-strength grounding shadows; crowns, feather instances and service grating do not project fine patterned shadows. The UV rim has no additional shadow map.

`preserve-ambusher.ts` owns the five bank anchors, tracking/locked aim, leap and retreat poses, anatomical flight-plane intersections and swept physical bites. `preserve-ambusher-rig.ts` consumes that pose for the articulated dinosaur, curled tail, warning and splash. The level owns two prewarmed rigs and their shared materials, maps only living anatomy to laser contact, and reuses the reviewed scale texture when present. `preserve-ambusher-geometry.ts` builds the Spinosaurus-inspired rosette snout and closed dorsal membrane; the sail profile also supplies thin anatomical contacts at flight height. The tail uses a flattened, vertically expanded streamed cross-section. On defeat, simulation retains the struck pose and start time: a continuous sideways roll lowers it onto the terrain/water while preserving habitat scroll. Corpses have no hitboxes, weapon targets or additional drops, expire within six seconds, and reuse the same two rigs. Pulse retains those harmless falling bodies; approach/restart clears them. Rendering uses the frozen stage clock on results, and the workshop offers separate ambush and defeat timelines. Foliage and rocks leave launch pockets at the same anchors. Submerged anatomy has no floating hitbox; the exposed head/neck accept every weapon. No ambusher state belongs to the menu or survives a flight session.

`preserve-layout.ts` owns deterministic terrain sampling, route extent and the fixed flight frame. `preserve-scenery.ts` composes the world and its broad fluorescent key; `preserve-station.ts`, `preserve-terrain.ts` and `preserve-foliage.ts` own the structure, soil/outcrops and planted layers. `preserve-dock.ts` owns the external entrance, `preserve-water.ts` owns flowing irrigation and its bounded whitewater pool, and `preserve-traces.ts` places nesting signs. `preserve-botany.ts` and `preserve-rocks.ts` supply shared procedural silhouettes; `preserve-waves.ts` is the patrol schedule. The 100-second route uses smooth wet/dry/nesting weights rather than swapping backdrops. Water profiles and basin levels also carve the terrain. Soil starts inside the docking mouth, leaving the approach genuinely open to space. Per-bay culling bounds the visible scenery, and only nearby crown batches animate; all resources warm before flight. The grow-light direction stays fixed while `preserve-shadow.ts` snaps a padded shadow window in the narrowed habitat’s metric and keeps the shadow camera up axis registered through rotation. The terrain closes down to the hull at its front and side edges. `rendering/flight-camera.ts` supplies the oblique camera and the same flight-plane projection for laser tracing. Preserve patrol flight is parallel to the habitat; `preserveFrame` moves the 26-degree view tilt into the camera and eases it out as the world turns toward the boss. This keeps z=0 control and collision coordinates fixed while ships and projectiles pass physically under the dock header. Geometry helpers and scene-local materials stay in `preserve-geometry.ts` and `preserve-materials.ts`. The workshop creates the same scenery as the level. It does not load the retired preserve plate. Ground, rooted plant placement and deck structure share world coordinates; optional maps cannot change their geometry or gameplay.

`groundskeeper.ts` owns attack timing, the locked aim contract, two-link arm poses with a shared elbow hinge frame, hand axes, abdomen clearance, claw curves and physical contact and the belly target transform. Rendering consumes that same pose in `groundskeeper-rig.ts`; the muzzle/jaw/eye assembly lives in `groundskeeper-face.ts`, and `groundskeeper-skull.ts` owns the indexed skull, inset nasal passages and surface-rooted scalp feathers and forward eye sockets, with geometry, material and bounded warning/debris helpers kept separate. `preserve-arena.ts` places the circular conservatory in the habitat world. The six-second approach uses `preserveFrame` and `preserveScroll` for the whole world, including the boss. `Flight` owns the attack aim, Pulse interruption and frozen results clock; optional textures cannot affect these. The shared pose also owns restrained chest expansion and weight shift, planted feet and delayed head/hand motion; its chest attachment transform keeps limb roots and belly contacts aligned with the breathing body. Negative pose time is a quiet idle leading continuously through the approach into combat, using the simulation clock so pause/results freeze it and replay scrubbing is repeatable. Neck plumage uses persistent seeded scatter rather than time-dependent randomness. Both arm segments share their elbow plane normal; flattened claws anchor their cross-section to the hand and transport it along the curve; their renderer must not infer roll from the bone direction alone. The arena apron uses disjoint annular sectors above the structural floor; `preserveGround` lowers the habitat soil below that slab inside its footprint. The workshop reuses both the live rig and the full scenery.

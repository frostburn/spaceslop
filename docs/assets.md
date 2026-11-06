# Asset handoff and loading

Generated assets go through chat for owner review and upload; see [AGENTS.md](../AGENTS.md). A media-free checkout remains playable.

The source of truth for file paths and level ownership is [catalog.ts](../src/assets/catalog.ts). Vite discovers existing files and appends content versions to their URLs, so replacing art at the same path does not leave stale cached images. Preserve alpha, atlas layout and orientation.

Pilot portraits are optional square PNGs at `public/pilots/vex.png`, `public/pilots/brass.png` and `public/pilots/glint.png`. They load in the selected level's hangar and fall back to callsign tiles. PWA install icons are optional `public/icons/spaceslop-192.png` and `public/icons/spaceslop-512.png`.

Per-level atlas layouts are in the [level reference](level-reference.md). Shared surfaces and plates follow.

The encounter textures and backdrops are optional PNGs. Add the reviewed files and rebuild. Only the selected level downloads them, and preparing that level saves its files for offline use. The workshop also shows the model textures.

| File | Surface |
| --- | --- |
| `public/encounters/io-basalt.png` | Optional opaque seamless basalt albedo/bump detail for Io terrain, crust and cliffs. sRGB, repeat, mipmaps, 512 × 512 recommended. Broad terrain pigmentation is authored in-engine. First Io texture delivered in chat. |
| `public/encounters/io-ceramic.png` | Optional opaque seamless chipped refractory ceramic albedo/bump detail for the Caldera Engine, Skippers and industry. sRGB, repeat, mipmaps, 512 × 512 recommended. Second Io texture delivered in chat. |
| `public/encounters/titan-chitin.png` | Optional opaque grayscale neutral insect-cuticle albedo/bump detail, sRGB, repeat, mipmaps; 512 × 512 recommended. Species tint stays in-engine. First texture delivered in chat. |
| `public/encounters/titan-setae.png` | Earlier soft-fur RGBA card; retained as owner artwork, but modeled coarse stubble now replaces it in the game. |
| `public/encounters/titan-maintenance-parts.png` | Optional RGBA square 2×2 parts atlas: chassis, sensor turret, upper arm, forearm/gripper in reading order. Keep the full transparent canvas and cell positions; sRGB, clamp to edge. 1280 × 1280 original, or resize the whole image uniformly. |
| `public/encounters/titan-research-ground-10screens.png` | Optional opaque sRGB 720 × 12800 ten-screen strip, opening at the bottom and core at the top. Keep its orientation and full extent. Runtime slicing and procedural masks require no companion image. |
| `public/encounters/frostwake-galaxy.png` | Optional opaque sRGB galactic plate. A 3:8 image (e.g. 768 × 2048) spans 1.5 portrait screens; other aspect ratios are cropped automatically without stretching stars. Preserve the full image and rebuild after upload. |
| `public/encounters/frostwake-ice.png` | Optional tileable opaque ice albedo, recommended 512 × 512, sRGB. The shader combines it with rock detail using procedural frost coverage. |
| `public/encounters/marine-hide.png` | Optional seamless opaque grayscale marine-hide detail, recommended 512 × 512, sRGB. Shared albedo/bump detail; shader countershading, stripes, mottled spots and localized scales remain separate. Delivered in chat for owner upload. |
| `public/encounters/frostwake-rock.png` | Optional tileable opaque dark-rock albedo, recommended 512 × 512, sRGB. |
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

Frostwake art is delivered through chat for owner upload. The two surface textures and galactic backdrop are optional and are cached when Frostwake is prepared. Without them, modeled frost colors, procedural surface relief, a procedural galactic sky, and 3D distant rocks preserve the scene. Normal/roughness detail and metal patina are generated in-engine, requiring no additional uploaded maps. Wrecks reuse the existing optional metal texture. New scenery geometry, materials, refinery/station buffers, and textures join preflight warm-up before launch; modules farther along the route are warmed too.

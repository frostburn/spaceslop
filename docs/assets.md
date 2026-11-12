# Asset handoff and loading

Generated assets go through chat for owner review and upload; see [AGENTS.md](../AGENTS.md). A media-free checkout remains playable.

The source of truth for file paths and level ownership is [catalog.ts](../src/assets/catalog.ts). Vite discovers existing files and appends content versions to their URLs, so replacing art at the same path does not leave stale cached images. Preserve alpha, atlas layout and orientation.

Pilot portraits are optional square PNGs at `public/pilots/vex.png`, `public/pilots/brass.png` and `public/pilots/glint.png`. They load in the selected level's hangar and fall back to callsign tiles. PWA install icons are optional `public/icons/spaceslop-192.png` and `public/icons/spaceslop-512.png`.

Briefing officer portraits go at `public/officers/<officer-id>.png`, as opaque 512 × 512 PNGs. Officer IDs are in `src/campaign/missions.ts`. Only the selected officer's image is requested, with initials as the fallback.

The optional `public/officers/rank-insignia.png` is a transparent 512 × 384 RGBA PNG. Keep the full 4 × 3 grid, 128 × 128 cells, and empty last cell. A proportional resize with square cells also works. The hangar reads these cells in the following order. Specialist 3 is drawn in code. The other badges are also drawn when the sheet is absent or invalid.

| Row | Column 1 | Column 2 | Column 3 | Column 4 |
| --- | --- | --- | --- | --- |
| Top | Specialist 4 | Sergeant | Second Lieutenant | First Lieutenant |
| Middle | Captain | Major | Colonel | Brigadier General |
| Bottom | Solar Marshal | Sector Marshal | Galactic Marshal | Empty |

Per-level atlas layouts are in the [level reference](level-reference.md). Shared surfaces and plates follow.

The encounter textures and backdrops are optional PNGs. Add the reviewed files and rebuild. Only the selected level downloads them, and preparing that level saves its files for offline use. The workshop also shows the model textures.

| File | Surface |
| --- | --- |
| `public/encounters/io-basalt.png` | Optional opaque seamless basalt albedo/bump detail for Io terrain, crust and cliffs. sRGB, repeat, mipmaps, 512 × 512 recommended. Broad terrain pigmentation is authored in-engine. First Io texture delivered in chat. |
| `public/encounters/io-ceramic.png` | Optional opaque seamless chipped refractory ceramic albedo/bump detail for the Caldera Engine, Skippers and industry. sRGB, repeat, mipmaps, 512 × 512 recommended. Second Io texture delivered in chat. |
| `public/encounters/titan-chitin.png` | Optional opaque grayscale neutral insect-cuticle albedo/bump detail, sRGB, repeat, mipmaps; 512 × 512 recommended. Species tint stays in-engine. First texture delivered in chat. |
| `public/encounters/titan-maintenance-parts.png` | Optional RGBA square 2×2 parts atlas: chassis, sensor turret, upper arm, forearm/gripper in reading order. Keep the full transparent canvas and cell positions; sRGB, clamp to edge. 1280 × 1280 original, or resize the whole image uniformly. |
| `public/encounters/titan-research-ground-10screens.png` | Optional opaque sRGB 720 × 12800 ten-screen strip, opening at the bottom and core at the top. Keep its orientation and full extent. Runtime slicing and procedural masks require no companion image. |
| `public/encounters/frostwake-galaxy.png` | Optional opaque sRGB galactic plate. A 3:8 image (e.g. 768 × 2048) spans 1.5 portrait screens; other aspect ratios are cropped automatically without stretching stars. Preserve the full image and rebuild after upload. |
| `public/encounters/frostwake-ice.png` | Optional tileable opaque ice albedo, recommended 512 × 512, sRGB. The shader combines it with rock detail using procedural frost coverage. |
| `public/encounters/marine-hide.png` | Optional seamless opaque grayscale marine-hide detail, recommended 512 × 512, sRGB. Shared albedo/bump detail; shader countershading, stripes, mottled spots and localized scales remain separate. Delivered in chat for owner upload. |
| `public/encounters/frostwake-rock.png` | Optional tileable opaque dark-rock albedo, recommended 512 × 512, sRGB. |
| `public/encounters/interceptor-metal.png` | Tileable brushed metal for ship and pod armor and the corridor bridge |
| `public/encounters/feather-vane.png` | Raptor wing and tail feathers and the ace's crest. Orient the root down and tip up. |
| `public/encounters/draconian-scales.png` | Tileable draconian face, snout, and jaw |
| `public/encounters/broodlock-foreground.png` | RGBA 720 × 3840 three-screen hive strip. Preserve its alpha and orientation; it traverses bottom to top once, without mirroring or repeating. |
| `public/encounters/broodlock-mines-mask.png` | Grayscale mask with the exact foreground dimensions and alignment. White reveals mines through the central channel and bridge grating; black reveals stars through exterior holes. Loaded as linear data. |
| `public/encounters/broodlock-stars.png` | Opaque portrait starfield, fixed in screen space. sRGB; no tiling required. |
| `public/encounters/broodlock-mines.png` | Opaque portrait dark mine plate, scrolling much more slowly than the hive. sRGB; no tiling required. |
| `public/encounters/ant-chitin.png` | Optional tileable 512 × 512 RGB albedo for ant shells, limbs, and guardian appendages. sRGB, repeated 1.2 times across the model UVs. |
| `public/encounters/broodlock-fungus.png` | Optional tileable 512 × 512 RGB albedo for mushroom caps, stems, and ant infection growths. sRGB, repeated 1.1 times across the model UVs. |
| `public/encounters/ant-mold.png` | Optional 512 × 512 RGBA fuzzy mold patch for camera-facing body infection. Preserve soft alpha, use sRGB and clamp-to-edge; no tiling or opaque background. |

The orbital preserve uses code-built terrain, trunks, soil-following roots, fern crowns, retaining walls, service walks and greenhouse ribs. Its small soil, bark and leaf surface maps are generated in-engine. Metal can reuse the reviewed armor texture. The observation rotunda, Groundskeeper and pool ambushers are also modeled in code. The boss can reuse the reviewed feather map for fine vane grain and scale map for skin relief, with runtime mip-filtered fallbacks. Ambushers reuse that scale map as neutral grain over their own muted hide colors, with procedural pigment and bump relief when absent. No additional raster assets are required.

Broodlock composites the two distant plates under the alpha foreground, using the matching mask to distinguish the central mine channel from the holes into space. Neither plate is baked into the foreground. The scene freezes at the end of the strip for the guardian. Each file is optional: missing plates use code-drawn stars or mine ribs, and a missing foreground uses procedural side rails and brood chambers. Without a mask, a simple central-channel split is used. New hive geometry and textures join the preflight warm-up so the first ant and guardian do not trigger their initial uploads during play.

Ant and mushroom surfaces retain deterministic code-drawn color, bump, and roughness detail without the chitin and fungus albedo files. Those two optional PNGs replace color only; keep them opaque and do not import them as normal maps. The mold patch instead needs alpha, and has a procedural fuzzy fallback when absent or unreadable. Its sprites share materials, blend over the shell, and do not write depth. With no hive foreground, procedural side rails meet the same mushroom roots; positions and collision remain identical. The prototype strip always spans three screens. Shared mushroom, parasite, and mold rendering is warmed before launch, including the variants farther up the strip. Layout and collision live in `src/hive-layout.ts` and `src/hive-collision.ts`, ant avoidance in `src/ant-navigation.ts`, meshes in `src/hive-fungi.ts`, `src/ant-rigs.ts`, and `src/ant-parasite.ts`, and mold sprites in `src/ant-mold.ts`; no model download is required.

Frostwake art is delivered through chat for owner upload. The two surface textures and galactic backdrop are optional and are cached when Frostwake is prepared. Without them, modeled frost colors, procedural surface relief, a procedural galactic sky, and 3D distant rocks preserve the scene. Normal/roughness detail and metal patina are generated in-engine, requiring no additional uploaded maps. Wrecks reuse the existing optional metal texture. New scenery geometry, materials, refinery/station buffers, and textures join preflight warm-up before launch; modules farther along the route are warmed too.


## Heliostat media

Generated revisions are delivered through chat for review and manual owner upload. Rebuild production or restart Vite after replacing a file.

| Path | Format / layout | Use |
| --- | --- | --- |
| `public/encounters/heliostat-uranus-backdrop.png` | RGB PNG, 724×2172, whole 1:3 image, sRGB/clamp | Owner's revised ring-system backdrop; flat vertical pan during the turn |
| `public/encounters/heliostat-manowar.png` | RGBA PNG, currently 627×627, equal 2×2 cells; preserve alpha | Top row: float / sail. Bottom row: harness / tendril. UV crops are resolution independent; resize the whole sheet with its layout and alpha intact. |

The guard’s optional raster modules share one alpha-tested material, pose without new geometry and warm before launch. The modeled body remains the fallback when the image is absent or fails. Alpha never changes hitboxes or firing time. Existing alloy and ceramic maps supply the station surfaces. Both the playable sector and Heliostat workshop use the same atlas. No new generated image binaries belong in the code PR.


## Summer Thaw media

The five smooth painted RGBA sheets are delivered through chat for owner review and upload. They are optional; this PR contains only source-built scenery and shape fallbacks. Preserve the entire transparent canvas and relative part positions. Resize the whole image with its aspect ratio locked; do not trim, rearrange cells, flatten alpha or pad the sheet to square. Normalized UV bounds allow smaller versions without source changes. About 768 pixels wide is a reasonable first upload size; retaining native size is also supported.

| Intended repository path | Sheet and native size | Import settings |
| --- | --- | --- |
| `public/encounters/summer-mammoth.png` | 1536×1024, freshly generated **orthographic top-down, straight-trunk** replacement, 3 columns × 2 rows. Torso, head, upper trunk; lower trunk, foreleg, hind leg. Upper/lower trunk have centered untwisted cuts and a single rounded dorsal tip. Replaces the earlier mammoth sheet at the same filename. | RGBA PNG, sRGB, clamp to edge, normal mipmaps. |
| `public/encounters/summer-ice.png` | 1246×1262, four formations: low snowbank, glacier cliff, hollow ice arch, crevassed slab. | RGBA PNG, sRGB, clamp to edge, normal mipmaps. Keep the hole transparent. |
| `public/encounters/summer-lotus-flanks.png` | 1774×887, two overhead blossoms in equal left/right cells: rose and lavender. Both are used beside the boss. | RGBA PNG, sRGB, clamp to edge, mipmaps. Preserve soft glow alpha and the full 2:1 canvas. |
| `public/encounters/summer-lotus-wall.png` | 1536×1024, one colossal forward-facing living lotus for the far wall behind the boss. | RGBA PNG, sRGB, clamp to edge, mipmaps. Preserve the full canvas and soft glow alpha. |
| `public/encounters/summer-hydra.png` | 1246×1263, four parts: body, head, curved neck, spare tail. The body already includes a tail; the spare is reserved. | RGBA PNG, sRGB, clamp to edge, normal mipmaps. Preserve the unequal painted margins. |

Ice and hydra bounds are measured from the full sheets rather than assuming perfectly centered square cells. Hydra neck strips are cut in UVs in-engine, so no additional exported images are needed. The meadow, river, botanical palace, glass dome, palette cycling and foliage are procedural and need no large backdrop. Summer also reuses the optional shared ship alloy. Rebuild Vite after adding/replacing assets so hashed URLs and the selected sector's offline package reflect them. Missing media retain the same encounters, movement, controls, collisions and final fight.

The latest mammoth sheet uses a true dorsal orthographic view for every part. Its two straight trunk modules share a centered axis and transverse skin folds; bending comes from the rig. Padded UV bounds and the narrower overlapping lower section are wired in source; the tip remains below the base. Use the fresh regeneration approved after the palace/aircraft polish, replacing the whole earlier mammoth canvas. Its head aspect ratio, recessed trunk root, matched trunk widths and tucked leg pivots are fitted to this sheet. The two lotus sheets are separate handoffs, not replacements for the ice or hydra. Resize the flanking pair as a whole 2:1 sheet (1024×512 is suitable); 768×512 is suitable for the wall lotus and mammoth atlas. Do not crop the glow or split/repack cells. The sprites use soft alpha and subtle frozen-clock glow; procedural flower shapes remain when either file is absent. No generated binaries belong in the PR.

# Lantern Grove lighting proof

Run `npm run dev` and open **Bioluminescence lighting study** from the main menu, or visit `biolume-study.html`. This is one screen, with a fixed top-down camera and no combat/progression. It is deliberately absent from the production app and offline level packages.

## Review

Pause or scrub to hold the exact same pose, then compare:

| Control | Expected result |
| --- | --- |
| Both | Warm pod and cyan leaf light reach actors; actors illuminate the raster surfaces. |
| Scenery only | Passing hulls receive the pod/leaf colors without their own light pools. |
| Actors only | Moving navigation, exhaust and gland lights reveal bark, ground and leaf detail. |
| Emission only | Veins, pod tissue, engines and glands remain visible, but neighboring surfaces are dark. |
| Blackout | All rendered RGB is black. No ambient light, environment map, directional key or hidden fill remains. |
| Relief shading | Switch between flat and raised surface normals at the same lighting/pose. |
| Leaf backlighting | Light from below the foreground leaf becomes visible through its thin tissue. |
| Root occlusion | Coarse root volumes block local illumination of the ground. |
| Raster artwork | Compare the optional imported artwork against source-drawn material samples. |

Drag/touch the canvas to position the ship; arrow keys/WASD also work with the canvas focused. **Auto flight** releases manual positioning. The enemy always follows the scrubbed scene clock. Pause and visibility changes freeze motion, pulses, exhaust and bullets. This is a lighting inspection, so manual repositioning and toggles still work while paused.

## Asset handoff

Upload the chat-delivered images at these optional paths:

- `public/encounters/biolume-study-backdrop.png`: opaque background below the actors.
- `public/encounters/biolume-study-foreground.png`: **latest foreground** with transparent gaps and leaf membranes above the actors.
- `public/encounters/biolume-glider.png`: new neutral-lit, head-down enemy sprite, native **1254×1254 RGBA**.
- `public/encounters/biolume-study-atlas.png`: the **original four-part study atlas**, native **1254×1254 RGBA**. Only its lower-left seed pod is sampled.

Both full-screen plate canvases are **948×1659**. Keep the whole frame, alpha and aspect ratio when resizing. Use sRGB, clamp-to-edge and mipmaps. Restart Vite after adding files so the content-versioned URLs are discovered. No generated binary belongs in the code PR. Retain the whole atlas canvas, including unused cells. Its normalized UV crop supports whole-canvas resizing; no separately edited pod bitmap is required.

The foreground shader keeps membranes at about **0.35 alpha** while dark petioles and locally darker vein lines approach **0.98 alpha**. It derives this structural mask from the unchanged raster with resolution-aware, alpha-weighted neighboring samples. It uses alpha blending and disables depth writes. Underlying actors and terrain remain visible through the leaves. This is separate from thin-leaf backlighting, which adds light transmitted from sources below the membrane. The opaque background always covers the screen. Each plate samples its complete UV rectangle once; the terrain and canopy are not assembled from cutouts. Three small pod cards sit over the painted pod sites; the glider is a separate actor. Each plate is projected as a flat plane at its own depth. Relief contributes lighting depth and normals but cannot expand, crop or warp the image in screen space. Sizing uses the canvas content dimensions, excluding CSS borders; resize preserves registration.

Both plates are relit without repainting their pixels. Pod modules carry their own registered emission regions; foreground vein emission is extracted from its darker vein detail. Six small glider glands emit without making the entire wing membrane glow. Two independent source-drawn full-frame fallbacks cover missing or failed plates, including partial uploads. A modeled enemy and source-drawn seed pods preserve the other silhouettes if their images are absent. The artwork switch selects all these fallbacks. Cancellation disposes successful siblings and late arrivals. Only this DEV study requests these four optional maps; the Uranus study selects its own maps. Normal flight packages do not contain these study media.

## Ownership and approximations

`src/biolume/layout.ts` owns broad plate relief and repeatable actor paths. `surface.ts` owns the two full-frame raster materials, alpha blending, normals, leaf transmission, shared illumination and coarse root blockers. `actors.ts` uses the existing player rig and keeps a modeled glider fallback. `modules.ts` owns the atlas crop, pod cards and the glider’s subdivided wing mesh. `view.ts` owns the scene, eight fixed local lights, fallback maps and optional image maps. `biolume-study.ts` owns preparation, inputs, timeline and page lifetime.

The backdrop is at z≈−3.6 with broad root relief; actors fly at zero; the foreground is at +2.2. Raster shaders and modeled actors use the same source positions, colors and ranges. Navigation, exhaust, gland and averaged bullet-stream pools approximate luminous regions. Count and materials remain fixed. The glider flaps by continuously bending one sprite mesh, narrowing its projected wingspan as the tips rise. Its center and roots stay fixed, vertex normals follow the bend, and scrubbing reconstructs the pose from rest UVs. Existing vertex buffers are reused; a frozen pose skips vertex uploads. Both raster and shape materials warm before animation. The three pod lights remain registered after resize. Pixel ratio is capped at 1.5. No shadow maps, reflection targets or runtime framebuffer readbacks are used.

This proves direct mutual lighting on two glued full-screen plates, not global illumination. Relief and pod masks are broad authored approximations, not exact recovered depth. Blockers approximate root occlusion, not every branch or actor shadow. Leaf transmission is approximate. Camera swings and actual phone frame rate remain untested. Cleanup owns the four optional image maps and all fallback maps, is idempotent and handles canceled preparation; the study stays outside normal flights.

## Validation

`npm test`, `npm run build` and `npm run test:build` enforce existing engine behavior, isolated packages and DEV-page exclusions. The wing regression checks attached roots, symmetric motion, repeatable scrubbing, updated normals, reused buffers and frozen uploads. The Uranus asset-loader regression includes all four unrelated biolume maps and verifies none is requested.

Browser review should isolate renderable actors while enabling only scenery lights, then isolate the raster surfaces while enabling only actor lights. Compare actual framebuffer pixels at fixed poses; both unlit baselines and blackout must be black. Separately compare relief, transmission and occlusion. Exercise portrait touch, paused dragging/keyboard movement, auto-flight reset, missing art, frozen pause and repeated updates without GPU-resource growth. Test-only framebuffer readbacks can produce a browser GPU-stall warning; the study itself performs no readback.

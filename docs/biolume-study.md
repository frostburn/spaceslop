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

Upload the chat-delivered neutral-material atlas to **`public/encounters/biolume-study-atlas.png`**. It is a **1254×1254 RGBA PNG**, with root / leaf / pod / soil in the four quadrants. Restart Vite after adding the file so the optional catalog URL is discovered and content-versioned. Keep the whole square canvas, alpha and relative placement. Whole-sheet resizing, including 627×627, preserves the normalized crops. Use sRGB, clamp-to-edge and ordinary mipmaps. No generated binary belongs in the code PR.

The raster pixels are not repainted. Materials multiply their neutral colors by the calculated incident light; pale leaf veins provide a registered emission mask. Broad relief is procedural. The optional image is loaded only by this DEV study. The Uranus study explicitly selects its own three maps. Missing, failed or canceled media retain the source-drawn fallback; late image arrivals are disposed by the shared bounded loader.

## Ownership and approximations

`src/biolume/layout.ts` owns crops, broad height fields and repeatable actor paths. `surface.ts` owns alpha-cutout raster materials, raised geometry/normals, thin-leaf transmission, shared six-source illumination and coarse root blockers. `actors.ts` uses the existing player rig and a small modeled glider. `view.ts` owns their common scene, six fixed point lights, materials, fallback maps and cleanup. `biolume-study.ts` owns inputs, preparation, timeline and page lifetime.

Ground is at z≈−4.5; roots rise from −3.6; actors fly at zero; the leaf sits at +2.2. The source positions/colors/ranges used by the raster shader agree with the six actual point lights illuminating modeled actors. Their count stays fixed while intensity changes, avoiding shader variants on toggles. Navigation, exhaust, gland and averaged bullet-stream pools approximate the corresponding luminous regions. Surface/glow changes use uniforms and transforms, not new geometry or per-frame image uploads. Pixel ratio is capped at 1.5. There are no reflection captures, shadow maps, render targets or runtime GPU readbacks.

This proves direct mutual lighting, not global illumination. Relief follows broad root/leaf shapes rather than an artist-authored per-pixel normal/depth map. Root blockers are a few soft analytic volumes, not exact branch silhouettes or full actor shadows. Leaf transmission is approximate. The single-screen cutouts represent the proposed below/above-flight raster layers; a full glued panorama still needs registered relief/emission/depth information and seam work. Camera swings and production-phone frame rate are not established by this study.

The scene primes both raster and procedural materials and fallback textures. Materials, geometry, the optional atlas and all five fallback maps have a scoped owner; cleanup is idempotent, including canceled preparation and context loss. Nothing from this study enters a normal flight session.

## Validation

`npm test`, `npm run build` and `npm run test:build` enforce existing engine behavior, isolated packages and DEV-page exclusions. The Uranus asset-loader regression includes an unrelated biolume atlas and verifies it is not requested.

Browser review should isolate renderable actors while enabling only scenery lights, then isolate the raster surfaces while enabling only actor lights. Compare actual framebuffer pixels at fixed poses; both unlit baselines and blackout must be black. Separately compare relief, transmission and occlusion. Exercise portrait touch, paused dragging/keyboard movement, auto-flight reset, missing art, frozen pause and repeated updates without GPU-resource growth. Test-only framebuffer readbacks can produce a browser GPU-stall warning; the study itself performs no readback.

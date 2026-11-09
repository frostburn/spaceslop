# Heliostat corridor experiment

Run `npm run dev`, then choose **Uranus corridor study** below the main menu, or open `heliostat-study.html` relative to the configured Vite base. This PR evaluates one foreground bay and its camera swing before committing to a full stage.

## Scene construction

- A flat Uranus image sits behind the 3D scene. A fixed, uniform scale preserves its aspect ratio; the camera swing only scrolls the crop vertically from the lower part of the image to the upper part. The backdrop reserves at least half a screen of vertical travel, with a fixed horizontal crop. It stays still during ordinary bay travel and when paused. Ordinary portrait artwork works directly, without spherical or perspective projection.
- Four distant plant modules occupy different depths. Fixed, oblique raster cards remain readable from flight through head-on. Solid stand-ins occupy those layers when artwork is absent.
- Rectified front, side and top panel tiles wrap shallow, closed foreground solids. Frames, rails, flanged pipes, radiator edges, beacons and the electric bus project from these surfaces. Crossmembers sit below the clear flight lane. The camera supplies actual perspective and depth occlusion.
- The artificial star and its collector ring, ship and sample shots are 3D. The star is a scale/lighting reference; this study has no boss, combat simulation or wave schedule.

## Owner-uploaded artwork

All three images are delivered in chat, separately from the code PR. The experiment works without any of them. Restart Vite after adding or replacing files so it can discover and version the optional media.

| Repo path | Format / grid | Import behavior |
| --- | --- | --- |
| `public/encounters/heliostat-panorama.png` | Opaque RGB, portrait 2:3 or taller | sRGB; clamp; flat image, uniform scale and vertical crop; ordinary raster artwork |
| `public/encounters/heliostat-distant.png` | RGBA, landscape 3:2; three equal columns | sRGB; clamp; alpha-tested cutouts, untrimmed grid |
| `public/encounters/heliostat-panels.png` | Opaque RGB, landscape 3:2; three columns × two rows | sRGB; clamp; inset UVs; untrimmed grid |

The panel atlas order, left to right then top to bottom, is tower front, tower side, tower top, radiator front, recessed machinery and conduits. The distant columns are collection tower, radiator and containment-ring fragment. Downsampling each entire image is safe; cropping/repacking individual cells changes the UV contract. No new binary media belongs in the code PR.

## Inspection

Use **Flight**, **Midpoint** and **Head-on**, then scrub both ways to inspect the same fixed geometry. **Play study** moves the bay past the ship and eases into the camera swing; **Pause** freezes the ship, shots, star, electricity and travel together. Preset/scrub controls stop playback. Toggle individual layers and **Reviewed artwork** to compare the rasters with their solid stand-ins. **Inspect wireframe** exposes the geometry supporting each face.

This deliberately uses no broad baked scene shadows. Painted panels supply small recess shading; modeled framing supplies their silhouette and common illumination. The remaining limit is distant cards: large lateral or rear views need another view or additional geometry. The current camera stays within their planned viewing cone.

The initial menu still loads no renderer or media. This study is a development tool, absent from production navigation and offline level packages. Its optional loader has a 2.5-second deadline and disposes late images on abort; leaving the page cancels its animation, resize observer and listeners and releases the scene/context. No scenery state survives a revisit.

# Heliostat station route study

Run `npm run dev`, then choose **Uranus corridor study** from the main menu. The timeline covers a ten-screen, 100-second station route followed by an eight-second camera swing. Section jumps expose the docking spine, generator galleries, heat-exchange yards, containment approach and final stellar collector. **Flight**, **Midpoint** and **Head-on** inspect camera poses; **Backdrop** displays the full tall image. **Orbit view** inspects nearby 3D machinery.

## Route and machinery

The standalone study and playable route share four geometry templates and eleven bays: ten route bays and a collector apron. Docking bays contain service cabinets and articulated two-link arms. Generator galleries expose windings, pumps and return pipes. Heat-exchange bays replace the windings with capped pressure tanks, cooling stacks and rotating fans. Containment bays carry overhead curved conductor ribs. Deck couplers and flexible pipe sections bridge the gaps between bays. The distant towers and complete cross-braced stellar collector share the approach's coordinate frame. Containment omits opaque overhead headers to preserve the star view. The playable view lowers side machinery three units and narrows its deck by 18%, keeping its casings below the ships while showing more of the equipment.

The route travels straight at a constant speed before smoothly decelerating into the camera swing. The ship and sample shots share a physical heading toward the collector. Scenery still uses ordinary lit meshes and surface UVs, with broad casing shadows rather than fine winding/grid shadows.

Fifteen deeper service islands repeat annular platforms, generator piers, transfer bridges and radiator banks below the lane; they are controlled by the distant-plant switch. Bay copies share template geometry and materials. At most four are active; absolute clock poses keep fans, service arms and electric buses repeatable after culling or timeline scrubbing. Preflight temporarily exposes one bay of each type and the distant/collector meshes with culling disabled, uploads their buffers, then restores the visible route before enabling playback. Later sections allocate no new geometry.

## Backdrop handoff

The generated image is delivered in chat for owner review and separate upload. The uploaded version is active. The latest **wide ring-system** version is delivered in chat for review. It reframes the planet to leave room for the ring arcs; replace the same file after approval:

| Repo path | Format | Import |
| --- | --- | --- |
| `public/encounters/heliostat-uranus-backdrop.png` | Opaque RGB PNG, **724×2172**, 1:3 portrait | sRGB; clamp; preserve the whole image and its aspect ratio |

The image stays fixed during the scrolling route, then its crop moves from the lower part to the upper part during the camera swing. Sampling is affine in screen space: uniform scale, fixed horizontal crop and vertical offset only. The backdrop is drawn behind the 3D station with depth writes disabled. The full-image inspection uses an aspect-preserving fit with side margins. It is never wrapped onto a sphere or skewed by the perspective camera.

Restart Vite after adding or replacing media so its optional asset manifest can discover and version the file. Whole-image downsampling is safe. Keep generated images out of the code PR; the owner uploads reviewed media. A code-drawn planet/starfield remains available when the backdrop is missing or fails.

The station also reuses `public/encounters/interceptor-metal.png` and `public/encounters/io-ceramic.png` as repeating sRGB surface maps. **Reviewed artwork** compares uploaded artwork with procedural fallbacks. Both map sets preserve the same 3D station geometry and lane clearance.

## Ownership and checks

The palette owns active and inactive metal/ceramic maps; the backdrop owns its image independently. Repeated control changes do not reupload the backdrop or dispose it twice. Geometry batches by material, and template clones share buffers. Pausing freezes every clock-driven pose, light bus, star rotation, world movement and backdrop crop.

Leaving the study cancels UI/orbit listeners, observation, texture loading and frame scheduling. Disposal waits for preparation and releases both scenes, owned maps, environment/shadow resources and renderer/context. The study UI stays outside production navigation and all eight offline flight packages. Shared scenery and backdrop code are used by the playable Heliostat sector; only its four required media files are requested and cached. `src/heliostat/` owns shared code, while `src/studies/heliostat-view.ts` and `heliostat-assets.ts` remain development-only.

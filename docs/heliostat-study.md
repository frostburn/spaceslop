# Heliostat 3D power-plant study

Run `npm run dev` and choose **Uranus corridor study** from the main menu. The same scene appears in flight, midway through the camera swing and head-on. **Uranus** frames the complete globe and ring system. **Orbit view** allows drag/zoom inspection of either the bay or the planet; selecting a flight preset or playing the timeline returns to the planned camera.

## Construction

The foreground uses separate beveled generator housings, exposed copper windings and cores, coolant pumps, wheel valves, curved return pipes, flanged service lines, thick radiator fins, railings, beacons and an overhead bus. Open housings expose actual machinery. Every component uses ordinary lit mesh materials and surface UVs. The clear flight lane passes under the bridge and over the low crossmembers. Broad casing shadows are shared by all angles; tiny winding/rail details do not cast patterned shadows.

The distant towers and radiator banks are geometry connected by truss spines. A complete collector encloses the artificial star: paired concentric hoops have front/back separation, radial mounts, diagonal braces and twenty winding banks. Its support struts join both sides of the collector to the plant spine. The star and planet maps are small deterministic code-built surface textures. Star rotation, planet rotation, electric bus and travel use presentation time.

Uranus is an oblate, textured sphere. Its globe and nine narrow annular rings share one tilted equatorial frame. The ring segments form complete circles, with depth testing hiding the far side behind the globe and drawing the near side in front. Ring widths are slightly enlarged for screen readability. The latitude map is constructed for sphere UVs and closes its longitude seam. The geometry follows the [NASA description of Uranus's tilt and narrow dark rings](https://science.nasa.gov/uranus/facts/).

The starfield consists of distant 3D points. A separate distant scene provides the planet's sunlight and dim ambient fill; the same perspective camera renders this scene, clears depth and then renders the local plant. The planet and its rings therefore remain behind all local machinery while keeping their own mutual occlusion. No photographed backdrop, scenery card, painted machinery atlas or screen-space crop is used.

## Surface maps

The study reuses these existing owner-uploaded textures:

| Catalog key | Repo path | Import |
| --- | --- | --- |
| `heliostatMetal` | `public/encounters/interceptor-metal.png` | sRGB, repeat; brushed grain on titanium, copper, graphite and painted metal |
| `heliostatCeramic` | `public/encounters/io-ceramic.png` | sRGB, repeat; ceramic armor |

Both are optional. A code-built grain and small bump map keep the complete geometry textured when files are absent or fail. **Uploaded surface maps** compares the owner maps with these procedural surfaces. The retired panorama, distant cutout atlas and panel atlas are no longer requested. This pass adds no binary assets.

## Ownership and checks

Static geometry batches by material, with face UVs measured in local surface units. Textures can change without changing geometry, bounds, lane clearance or progression. The surface palette owns both active and inactive map variants and releases each once. Leaving the study cancels listeners, orbit input, observation, texture loading and frame scheduling; disposal waits for preparation, then releases both scenes, shadow resources, environment texture and renderer/context.

The study stays outside production navigation and the seven offline flight packages. The lightweight menu imports no renderer or media. This PR remains a bay/camera study; the full production route and enemy/boss combat follow scene review.

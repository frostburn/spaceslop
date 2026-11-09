# Spaceslop

A portrait browser shoot ’em up and installable PWA. Fly through Hadal, Io, Titan, Frostwake, Broodlock or an overgrown orbital preserve, with selectable pilots, an autofiring drone and collectible wing weapons.

## Develop

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

The app opens in a lightweight sector menu. Choose a sector and **Prepare flight** to load its graphics, then choose your loadout and launch. Tap to place the drone, drag to steer, or use WASD/arrows. Space fires Pulse; Escape pauses. **Menu** leaves the current run.

Vite dev links the asset workshop and camera studies directly from the main menu. The hangar also includes these links and boss/transition launch shortcuts. Direct URLs are `/workshop.html`, `/vent-study.html` and `/io-study.html`. Production excludes those pages and shortcuts. `?level=vents` selects a sector in the menu without loading it; `?testLoadout=1` enables the wing test picker.

## Validate

```sh
npm test
npm run build
npm run test:build
npm run preview
```

The build includes strict TypeScript checks. Build checks enforce the menu's size limit, six isolated level packages, selective PWA precaching and absent dev pages/QA hooks. CI runs the same commands. For loading, renderer or PWA changes, also exercise selection, switching, cancellation, pause/resume and offline reload in a browser, with and without media.

## Offline and hosting

Serve `dist/` over HTTPS. The service worker initially saves only the menu and its small dependencies. Preparing a level saves that level's code and optional media; the hangar reports **Level ready offline** and the sector card shows **Saved offline**. Unprepared levels need a connection. **Offline storage → Clear saved levels** releases downloaded stages while retaining the menu and pilot choice. Missing images preserve the procedural fallback.

A versioned content URL keeps replaced artwork fresh. Updates are offered in the main menu and applied between sessions. Both root hosting and Vite `--base=/subpath/` builds are supported. Keep `index.html`, `sw.js` and `level-packages.json` revalidatable; hashed JS/CSS and versioned media can have long cache lifetimes. Retain the previous deployment's hashed files during an update if existing tabs must keep working.

## Project map

- [Architecture and maintenance](docs/architecture.md): startup, renderer contracts, adding a level and checking regressions.
- [Controls, pilots and weapons](docs/controls.md).
- [Level and atlas reference](docs/level-reference.md).
- [Asset handoff and import settings](docs/assets.md).
- [Agent instructions](AGENTS.md): generated art stays in chat; the owner uploads it after review.


The sector menu also includes **Synthwave · Boulevard**: a 100-second neon resort route with solid/wireframe architecture, live wet-road reflections, hovercar waves and a head-on Pursuit Cruiser fight. Its optional asphalt texture is reviewed/uploaded separately through chat; the stage remains playable without media. See `docs/level-reference.md` for the asset path and development workshop controls.

# Spaceslop

A portrait browser shoot ’em up and installable PWA. Fly the Return to Sender campaign from the Broodlock outpost through Europa’s Hadal Cable and on to the Galactic Centre, with selectable pilots, an autofiring drone and collectible wing weapons.

## Develop

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

The app opens in **Campaign**. **Open briefing** shows the selected mission’s officer, objective, rank and loadout controls in the menu. **Launch** prepares and starts the mission. Clearing a mission unlocks the next one and records progress on this device. **Free Flight** offers every sector for practice. Tap to place the drone, drag to steer, or use WASD/arrows. Space fires Pulse and Escape pauses. **Menu** leaves the current run.

Vite dev links the asset workshop and camera studies directly from the main menu. The briefing includes boss and transition launch shortcuts. Direct URLs are `/workshop.html`, `/vent-study.html` and `/io-study.html`. Production excludes those pages and shortcuts. `?level=vents` selects Hadal Cable in Free Flight and `?testLoadout=1` enables the wing test picker.

## Validate

```sh
npm test
npm run build
npm run test:build
npm run preview
```

The build includes strict TypeScript checks. Build checks enforce the menu's size limit, isolated level packages, selective PWA precaching and absent dev pages/QA hooks. CI runs the same commands. For loading, renderer or PWA changes, also exercise selection, switching, cancellation, pause/resume and offline reload in a browser, with and without media.

## Offline and hosting

Serve `dist/` over HTTPS. The service worker initially saves only the menu and its small dependencies. Launching a level saves its code and optional media, including its briefing officer. A paused flight reports **Level ready offline** and the mission card shows **Saved offline**. Unprepared levels need a connection. **Offline storage → Clear saved levels** releases downloaded stages. Campaign progress and pilot choice are stored separately. Missing images use procedural fallbacks.

A versioned content URL keeps replaced artwork fresh. Updates are offered in the main menu and applied between sessions. Both root hosting and Vite `--base=/subpath/` builds are supported. Keep `index.html`, `sw.js` and `level-packages.json` revalidatable; hashed JS/CSS and versioned media can have long cache lifetimes. Retain the previous deployment's hashed files during an update if existing tabs must keep working.

## Project map

- [Architecture and maintenance](docs/architecture.md): startup, renderer contracts, adding a level and checking regressions.
- [Controls, pilots and weapons](docs/controls.md).
- [Level and atlas reference](docs/level-reference.md).
- [Asset handoff and import settings](docs/assets.md).
- [Agent instructions](AGENTS.md): generated art stays in chat; the owner uploads it after review.

**Last Exit Boulevard** is a 100-second neon resort route with solid and wireframe architecture, live wet-road reflections, hovercar waves and a head-on Pursuit Cruiser fight. Its optional asphalt texture is reviewed and uploaded separately through chat. See `docs/level-reference.md` for the asset path and development workshop controls.

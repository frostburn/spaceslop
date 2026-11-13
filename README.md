# Spaceslop

A portrait browser shoot ’em up and installable PWA. Fly the Return to Sender campaign from the Broodlock outpost through Europa’s Hadal Cable and on to the Galactic Centre, with selectable pilots, an autofiring drone and collectible wing weapons.

The Return Channel closes the campaign with a 13-boss Wormhole run. Collect weapons between fights and repair hull after every third boss.

## Develop

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

The app opens in **Campaign**. **Open briefing** shows the selected mission’s officer, objective, rank and loadout controls in the menu. **Launch** prepares and starts the mission. Clearing a mission unlocks the next one and records progress on this device. **Free Flight** offers every sector for practice. Tap to place the drone, drag to steer, or use WASD/arrows. Space fires Pulse and Escape pauses. **Menu** leaves the current run.

The development menu links the asset workshop, Draconian patrol blend editor and camera studies. Open the workshop at `/workshop.html` or the patrol editor at `/patrol-study.html`. Dev briefings also offer shortcuts into boss approaches. `?level=vents` selects Hadal Cable in Free Flight and `?testLoadout=1` enables the weapon picker.

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

- [Architecture and maintenance](docs/architecture.md) covers startup, renderer contracts, adding a level and checking regressions.
- [Controls, pilots and weapons](docs/controls.md).
- [Level and atlas reference](docs/level-reference.md).
- [Asset handoff and import settings](docs/assets.md).
- [Agent instructions](AGENTS.md) cover generated asset handoff and verification.

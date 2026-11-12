# Spaceslop agent instructions

## Generated asset handoff

- Deliver every generated asset in the ChatGPT conversation for the owner to review and upload separately. Use an inline preview or a downloadable chat attachment and give the intended repo path, format, and relevant import settings for each file.
- Keep generated art, logos, sprites, textures, models, music, sound effects, video, and their archives out of Git. This applies to commits, branches, PRs and their attachments, LFS, release uploads, and base64 or data-URI copies in source. The owner handles the upload after review.
- Build code and procedural placeholders directly in source. Keep generated asset outputs and build products in scratch or ignored directories while working. Before pushing, inspect the staged diff and file list for any asset output.

## Asset-free playability

- A fresh checkout must build and play without any owner-uploaded media. Make external media optional and retain a code-drawn fallback when a file is absent or fails to load. Keep audio optional.
- Keep controls, combat geometry, collision, and progression independent of visual assets. A placeholder must preserve enough silhouette, size, and contrast to read the ship, hazards, and boss telegraphs.
- Verify that a placeholder-only run can start, play the scrolling stage, fight the head-on boss, and reach results. Test the production build offline after precaching when touching the PWA or asset loading.

## Architecture and maintenance

- Read `docs/architecture.md` before changing startup, loading, level rendering or offline behavior. `src/assets/catalog.ts` owns media paths and per-level requirements.
- Keep the menu free of renderer/game imports and the mission list free of media requests. An opened briefing can load its portrait and the shared pilot portraits. Construct, load and warm only the chosen level on launch through `src/rendering/levels/` and its typed contract.
- Preserve scoped session cleanup, procedural fallbacks, fixed-step simulation and pause/results freezing. Own offscreen targets and release them when leaving a level.
- Run `npm test`, `npm run build` and `npm run test:build` for relevant changes. Loading/PWA changes also need browser checks for level isolation, cancellation/switching, and production offline play with and without media.

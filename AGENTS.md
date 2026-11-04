# Spaceslop agent instructions

## Generated asset handoff

- Deliver every generated asset in the ChatGPT conversation for the owner to review and upload separately. Use an inline preview or a downloadable chat attachment and give the intended repo path, format, and relevant import settings for each file.
- Keep generated art, logos, sprites, textures, models, music, sound effects, video, and their archives out of Git. This applies to commits, branches, PRs and their attachments, LFS, release uploads, and base64 or data-URI copies in source. The owner handles the upload after review.
- Build code and procedural placeholders directly in source. Keep generated asset outputs and build products in scratch or ignored directories while working. Before pushing, inspect the staged diff and file list for any asset output.

## Asset-free playability

- A fresh checkout must build and play without any owner-uploaded media. Make external media optional and retain a code-drawn fallback when a file is absent or fails to load. Keep audio optional.
- Keep controls, combat geometry, collision, and progression independent of visual assets. A placeholder must preserve enough silhouette, size, and contrast to read the ship, hazards, and boss telegraphs.
- Verify that a placeholder-only run can start, play the scrolling stage, fight the head-on boss, and reach results. Test the production build offline after precaching when touching the PWA or asset loading.

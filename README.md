# ZEN — Endless Stacking

An original browser implementation inspired by TETR.IO Zen, with a complete local practice experience. No build step or dependencies are needed to run the game.

[Play on GitHub Pages](https://aflyingkelp.github.io/zen-stacker-pages/)

## Play locally

Install Node.js, run `npm start`, and open `http://127.0.0.1:4173`.

## Features

- 10 × 20 visible playfield, 20 hidden buffer rows, seeded seven-bag queue, hold, ghost, soft and hard drop.
- SRS and SRS+ kicks, including SRS+ symmetric I-piece and published 180-degree kick tables.
- T-spin / mini detection, all-spin variants, combos, back-to-back, perfect clears, score and pace progression.
- Endless top-out recovery, undo / redo, board clearing, garbage practice, backfire, unclear, cheese layer and cheese timer.
- Adjustable handling and key bindings, touch controls, synthesized audio, visual settings and automatic local session saving.
- Settings import from supported fields of TETR.IO `.TTC` exports, plus portable Zen JSON import / export.

## New practice features

Restart the run with the Restart button or F2. The gray tetromino skin applies to the board, hold, previews, and opponent. Ghost opacity and drop-shadow opacity have independent 0–100% sliders. Damage includes attack totals, APM, cancellation, bursts, and a delayed incoming-garbage meter.

Choose Play vs CPU for an animated opponent board with three speeds. CPU practice keeps your solo run separately; Back to Solo restores its board and score. The opponent uses browser-local Cold Clear 2 WASM suggestions, validated against reachable game moves, with a local heuristic fallback if the advisor cannot load or produce a legal move. It is an independent community AI, not an official TETR.IO service. Original licenses, binary checksum and provenance are in `dist/licenses/NOTICE.txt` and the adjacent license files.

## Controls

Arrow keys move and soft drop; Space hard drops; Up / X rotate clockwise; Z / Ctrl rotate counterclockwise; A rotates 180°; C / Shift hold; R clears the board; G adds garbage. Esc pauses, Enter resumes, F toggles fullscreen. Ctrl / Command + Z undoes, Ctrl / Command + Y redoes.

## Verification

Run `npm test` for all engine, spins, settings, opponent, battle, and Cold Clear checks.

## Fidelity and attribution

This is an independent recreation. TETR.IO is made by OSK; it is not affiliated with this project. No TETR.IO source code, audio, or artwork is bundled. Zen level thresholds, gravity progression, and some advanced scoring are approximations. Only implemented kick systems are offered.

References: [TETR.IO](https://tetr.io/), [official handling FAQ](https://tetrio.github.io/faq/mechanics.html), [SRS+ discussion](https://github.com/tetrio/issues/issues/506), [spin modes](https://github.com/tetrio/issues/issues/1281), [vertical movement and spins](https://github.com/tetrio/issues/issues/602).

## Multiplayer and updated rules

Select Multiplayer, Create Room, and share the invite link. The first guest joins a two-player live match with visible boards, attacks, shared seven-bag seed and synchronized rematches (Restart/F2). Leave Match restores your solo run. This is casual client-authoritative play, with invite codes as room access; no accounts, rankings or anti-cheat.

The separate Zen Multiplayer Supabase project hosts Realtime Broadcast. Only its public publishable key is in network-config.js; no secret keys are bundled. To self-host, replace the Realtime URL and publishable key with your own Supabase project.

ALL-SPINS+ is the default. Piece and garbage random generators are separate, so receiving garbage cannot change the seven-bag sequence. Ordinary attacks use aligned holes, a 650ms arrival window, cancellation and an eight-row placement cap. Cheese practice intentionally remains messy.

Look & Sound includes a separate hard-drop shake switch (off by default), solid colored/gray skins without borders, ghost opacity and drop shadow opacity. Fullscreen uses the browser Fullscreen API, with an expanded game pane when an embedded browser blocks it.

The runtime is already bundled. For development, npm ci installs the pinned dependencies; npm run build:realtime rebuilds the Supabase vendor module. npm test includes 100 complete seven-bag checks; npm run test:network tests two real Supabase connections, damage and rematches.

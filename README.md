# ZEN — Endless Stacking

An original browser implementation inspired by TETR.IO Zen, with local practice and team elimination battles. No build step or dependencies are needed to run the game.

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

Choose Play vs CPU for an animated opponent board with PPS presets and a custom 0.1–10 PPS target. CPU practice keeps your solo run separately; Back to Solo restores its board and score. The opponent uses browser-local Cold Clear 2 WASM suggestions, validated against reachable game moves, with a local heuristic fallback if the advisor cannot load or produce a legal move. It is an independent community AI, not an official TETR.IO service. Original licenses, binary checksum and provenance are in `dist/licenses/NOTICE.txt` and the adjacent license files.

## Controls

Arrow keys move and soft drop; Space hard drops; Up / X rotate clockwise; Z / Ctrl rotate counterclockwise; A rotates 180°; C / Shift hold; R clears the board; G adds garbage. Esc pauses, Enter resumes, F toggles fullscreen. Ctrl / Command + Z undoes, Ctrl / Command + Y redoes.

## Verification

Run `npm test` for all engine, spins, settings, opponent, battle, and Cold Clear checks.

## Fidelity and attribution

This is an independent recreation. TETR.IO is made by OSK; it is not affiliated with this project. No TETR.IO source code, audio, or artwork is bundled. Zen level thresholds, gravity progression, and some advanced scoring are approximations. Only implemented kick systems are offered.

References: [TETR.IO](https://tetr.io/), [official handling FAQ](https://tetrio.github.io/faq/mechanics.html), [SRS+ discussion](https://github.com/tetrio/issues/issues/506), [spin modes](https://github.com/tetrio/issues/issues/1281), [vertical movement and spins](https://github.com/tetrio/issues/issues/602).

## Multiplayer and updated rules

Select Multiplayer, Create Room, and share the invite link. Choose Team A and Team B sizes (1–4 per side), choose your team, create a room and invite friends. The host starts the match and can fill empty seats with bots. All boards are visible, attacks rotate only among living enemies, and Restart/F2 starts a shared rematch. Formats include 2v1, 3v1, 4v1, 2v2 and up to 4v4. Leave Match restores your solo run. This is casual client-authoritative play, with invite codes as room access; no accounts, rankings or anti-cheat.

The separate Zen Multiplayer Supabase project hosts Realtime Broadcast. Only its public publishable key is in network-config.js; no secret keys are bundled. To self-host, replace the Realtime URL and publishable key with your own Supabase project.

ALL-SPINS+ is the default. Piece and garbage random generators are separate, so receiving garbage cannot change the seven-bag sequence. Ordinary attacks use aligned holes, a 650ms arrival window, cancellation and an eight-row placement cap. Cheese practice intentionally remains messy.

Look & Sound includes a separate hard-drop shake switch (off by default), solid colored/gray skins without borders, ghost opacity and drop shadow opacity. Fullscreen uses the browser Fullscreen API, with an expanded game pane when an embedded browser blocks it.

The runtime is already bundled. For development, npm ci installs the pinned dependencies; npm run build:realtime rebuilds the Supabase vendor module. npm test includes 100 complete seven-bag checks; npm run test:network tests two real Supabase connections, damage and rematches.

## Elimination and CPU PPS

CPU battles and team multiplayer now use elimination: top-out freezes the final board, surviving teammates keep playing, and the last team alive wins. Restart/F2 resets all players and bots. Solo defaults to endless recovery; Settings → Game → Top-out behavior → Survival enables game over in solo too.

CPU PPS presets are 0.25, 0.55, 1.1, 2, 3, 5 and 10, with a custom target from 0.1–10. The measured PPS remains on each board. Targets can be limited by AI calculation time and device performance. Team rooms use the host’s target at creation for all bot seats; humans can choose either team before joining. A full preferred team falls back to the other side.

Tests cover all sixteen team formats, bot fill, friendly-fire prevention, dead-player targeting, win/loss, rematches, frozen elimination saves, and actual CPU placement pace. The live network suite also checks a 3v1 room with three human clients and one bot. A disconnected participant pauses the match; create a fresh room to continue.

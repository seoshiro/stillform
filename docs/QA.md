# Verification — 2026-11-02

**Final result: PASS.** Checked against the generated production files in `dist/`, using an isolated automated Chromium browser on Windows. The original application remained under the local server's Content Security Policy; axe-core was evaluated by the test harness through DevTools.

## Actual checks

| Check | Result / evidence |
| --- | --- |
| JavaScript syntax | PASS — `npm run check`, all application and tooling modules |
| Static build | PASS — `npm run build`, seven public files, 70.6 KiB total, plus `.nojekyll` |
| Runtime network | PASS — no external requests, streamed audio, remote fonts, or runtime dependencies |
| Audio consent | PASS — zero AudioContexts before the first play gesture; no autoplay after reload |
| Audio output | PASS — context reached `running`; nonzero signal peak measured at 0.06787, below clipping; pause suspended the context |
| Sound controls | PASS — three scene presets, all layer sliders, master volume, reset, and matching visible values |
| Saved mixes | PASS — whitespace validation, save, reload persistence, exact mix restoration, no autoplay, and removal |
| Focus timer | PASS — 15/25/45 minutes, countdown, pause, continue, reset, and completion using a simulated wall-clock advance |
| Keyboard | PASS — range arrow controls, dialog initial focus, Escape closing, and focus restoration |
| Reduced motion | PASS — system preference pauses sculpture and removes smooth scrolling; manual motion toggle works |
| Desktop accessibility | PASS — 26 axe checks, zero detected WCAG 2/2.1 A/AA violations |
| Save dialog accessibility | PASS — 18 axe checks, zero detected WCAG 2/2.1 A/AA violations |
| Mobile accessibility | PASS — 26 axe checks, zero detected WCAG 2/2.1 A/AA violations |
| Responsive widths | PASS — no horizontal overflow at 320, 390, 600, 768, 1024, 1440, and 1920 px |
| Mobile interaction | PASS — touch viewport 390×844: navigation, playback, scene change, mixing, saving, and removing |
| Storage failures | PASS — malformed JSON, null settings, invalid/prototype-named scenes, and blocked localStorage handled without false success |
| Local server boundaries | PASS — private project files and traversal return 404; restrictive CSP and MIME protection present |
| Browser errors | PASS — zero JavaScript and console errors across all test pages |

The final browser run was **Chrome/156.0.8078.4**, at **2026-11-02 19:12 UTC**. The browser suite recorded **17 passing checks**. Raw evidence is in `test-results/report.json` and screenshots are in `test-results/` (ignored by Git):

- `desktop.png` — full page, 1440 px wide.
- `desktop-viewport.png` — 1440×1000 first viewport.
- `mobile.png` — full page, 390 px wide.
- `mobile-viewport.png` — 390×844 first viewport.
- `mobile-small.png` — full page, 320 px wide.

Desktop and mobile screenshots were also visually inspected. During QA, small-text contrast in the orange section was corrected, the sculpture was resized to stay within its frame, and invalid scene names in stored data were rejected explicitly.

## Limits

- These were automated browser checks and visual screenshot inspection, not a physical phone or a full human accessibility audit.
- Safari, Firefox, real iOS/Android devices, screen-reader speech, and subjective headphone listening were not tested. Audio output was measured programmatically with the browser audio output muted.
- Timer completion used a simulated wall-clock advance; a real 45-minute waiting session was not run. Background handling uses absolute end time and recomputes on visibility change.
- Saved mixes belong to this browser/profile. They are not synced between devices and disappear when site storage is cleared. Sound continues after a timer completes.
- These results describe the local production build. The owner subsequently authorized public GitHub Pages publication; public-version evidence is recorded separately under `test-results/` after deployment.

## Reproduce

Use the instructions in `README.md`, with the paths of an existing Puppeteer module, axe-core script, and Chromium executable. Set `TEST_START_SERVER=1` and `TEST_PRODUCTION=1` after building to test `dist/` with a temporary loopback-only server. No test packages or browsers were installed for this project.

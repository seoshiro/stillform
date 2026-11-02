# STILLFORM

**Find your own frequency.** An original interactive listening room and portfolio project for Beibars.

[Open the listening room](https://seoshiro.github.io/stillform/) · [Source on GitHub](https://github.com/seoshiro/stillform)

A warm editorial interface, an original animated toroidal sculpture, and a genuinely functional sound studio. All visuals and sounds are generated locally. No paid resources, remote fonts, streamed media, accounts, trackers, or API keys.

## Run locally

Requires Node.js 20 or newer. No package installation is needed.

```sh
npm run dev
```

Open **http://127.0.0.1:5088**. `PORT` may be set to use another port. Opening `index.html` directly is not supported because the app uses native JavaScript modules.

## Features

- Three soundscapes: Ember, Tidal, and Orbit, with different palettes, audio tuning, and default mixes.
- Web Audio synthesis with texture, depth, drift, and master-volume controls. Audio starts only after pressing play.
- Procedural Canvas 2D sculpture, gently responsive to the pointer, with a motion toggle, reduced-motion support, and offscreen/background suspension.
- 15, 25, and 45-minute focus sessions with pause, continue, reset, and completion states. The timer uses wall-clock time to handle background throttling.
- Save, load, and remove up to 12 named mixes in localStorage. Saved values are validated and names are rendered as text.
- Mobile navigation, native accessible dialogs, keyboard controls, visible focus, live announcements, and responsive layouts.
- Local-only privacy: mixes stay in this browser. Clearing site data removes them. Audio continues when a focus session finishes.

## Build

```sh
npm run check
npm run build
node scripts/serve.mjs --dist
```

The build copies an explicit public-file list into `dist/`. It is a portable static website with relative asset paths, suitable for subdirectory hosting. There is no router, backend, or database. The local server binds only to loopback and serves only that same public-file list.

## GitHub Pages

The public site is hosted at **https://seoshiro.github.io/stillform/**. The `pages.yml` workflow checks and builds the site on pushes to `main`, then publishes only `dist/` through GitHub Pages. It can also be run manually from Actions. The build needs no package installation, external services, or repository secrets. `build-info.json` in the published artifact records its exact source commit.

## Verification

`npm run check` checks JavaScript syntax. The browser suite uses an existing Puppeteer installation and axe-core, supplied as local paths; it does not install tools:

```sh
# Set these environment variables to existing local module/browser paths:
# PUPPETEER_MODULE = path to puppeteer-core's JavaScript entry point
# AXE_MODULE = path to axe-core/axe.min.js
# BROWSER_PATH = path to the Chromium executable
npm test
```

Run the development server first. Optional `TEST_URL` defaults to `http://127.0.0.1:5088`. Alternatively set `TEST_START_SERVER=1` to start and stop an isolated test server automatically (default port 5091). Browser evidence is written to `test-results/` (ignored by Git). See [docs/QA.md](docs/QA.md) for the actual run and limitations.

## Project map

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic interface and dialogs |
| `styles.css` | Visual system, responsive layouts, reduced motion |
| `app.js` | Controls, saved mixes, timer, navigation |
| `audio.js` | Gesture-activated Web Audio synthesis |
| `sculpture.js` | Original procedural sculpture |
| `scripts/serve.mjs` | Restricted local static server |
| `scripts/build.mjs` | Zero-dependency static build |
| `tests/browser.mjs` | Desktop/mobile interaction and accessibility checks |

## Design and assets

All sculpture geometry, icons, marks, noise texture, interface copy, and sound synthesis were authored for this project. Typography uses local Arial/Helvetica, Georgia, and Courier New fallbacks, without redistributing font files. There are no third-party visual/audio assets or runtime dependencies. `assets/social.svg` is an editable social-card source; some social networks require a future PNG export and absolute URL once a public domain exists.

This is a creative portfolio concept, not a medical or productivity service. MIT licensed.

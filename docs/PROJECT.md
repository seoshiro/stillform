# Project handoff

## Outcome

STILLFORM is a self-contained, original audiovisual portfolio concept for Beibars: an editorial listening room with a procedural toroidal sculpture and a working ambient sound mixer.

## Decisions

- Warm off-white, charcoal, and vermilion with sage/lilac soundscape variants. Large grotesk headlines, italic serif editorial accents, and restrained monospace metadata.
- Native HTML/CSS/JavaScript modules, Canvas 2D, Web Audio, and localStorage. No framework or third-party runtime package was necessary.
- Three scene tunings share a generated noise bed and four softly modulated sine voices. Gesture-only playback and a restrained master gain avoid unexpected loud autoplay.
- Motion runs only while its canvas is visible and the tab is active, respects reduced-motion preferences, and can be paused independently from sound.
- Native modal dialogs support focus containment and Escape. Saved names use textContent; stored scene names and numeric mix values are validated.
- Local server exposes an explicit public-file list and binds to 127.0.0.1. Static build uses relative assets for eventual subdirectory hosting.
- GitHub Pages publishes only the generated `dist/` artifact. No paid tools, new credentials, OAuth changes, or external media generation are needed.

## Acceptance evidence

The desktop and mobile journeys, audio signal, persistence, timer, keyboard interaction, contrast, storage errors, and production build passed. See `QA.md` and `test-results/report.json` for the actual evidence and testing limits.

## Publication

The owner authorized the public `seoshiro/stillform` repository and GitHub Pages hosting on 2026-11-02. Pushes to `main` trigger syntax checks, the static build, artifact upload, and Pages deployment. The public `build-info.json` identifies the exact source commit. Local-only development evidence remains in the ignored `test-results/` directory.

## Verification

See `QA.md` for the original local production-build checks. After deployment, the public site is checked again for matching source commit, asset paths, desktop/mobile rendering, playback, saved mixes, and timer behavior. Browser evidence is stored locally under `test-results/`.

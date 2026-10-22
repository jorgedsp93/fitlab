# FitLab

A calm, mobile-first training journal for a 12-week program. A static PWA with no runtime dependencies, no account, and local progress storage.

Live app: https://jorgedsp93.github.io/fitlab/

## Features

- **Today:** a weekly date strip, your session, daily habits, and bodyweight logging.
- **Workout:** editable working sets and warm-ups, notes, effort feedback, weight increments, retained work during substitutions, compact alternating supersets, pause/resume timing, and a dedicated session review.
- **Plan:** move or skip sessions, choose training weekdays, pause the plan, shorten a session to a 20/30-minute focus, add exercises, and reorder blocks.
- **Progress:** exercise weight/rep trends, personal bests, complete vs partial weekly consistency, all-cycle history, optional bodyweight and measured body-fat entries, and per-session Garmin exports.
- **More:** light/dark/system themes, lb/kg conversion, exercise search, program settings, backup and restore.

## Data and upgrades

Progress stays in the browser's `fitlab_v1` localStorage record. Version 13 reads the existing format, freezes legacy workout dates before schedule edits, and saves a recovery copy during migration. A full backup is available in **More → Your data & backups**. Restoring replaces current data after confirmation and saves a recovery copy first. Starting a new cycle archives the current cycle; its logs, dates, notes, preferences and measurements remain available. Completed working sets remain associated with the movement actually performed, including after substitutions.

Changing devices or clearing browser storage does not automatically transfer history. Export a full backup first. Workout-only JSON and Garmin exports are not restorable FitLab backups.

## Development

```sh
npm ci
npm test
npm run check
npm start
```

Open http://localhost:8077. The app needs no build step. Development dependencies are used only by the test suite. `tests/viewports.html` previews the actual app at 320, 390 and 768 CSS-pixel widths.

## Deployment

GitHub Pages publishes the repository's main branch. Update the service-worker cache version and the CSS/JS version query strings together when changing the app shell. The CI workflow runs syntax checks and the regression suite on pushes and pull requests.

## Garmin exports

Open a current-cycle session, select **Finish & review**, and expand **Export this session** for FIT, TCX or JSON. Full backups include all archived cycles. Open Garmin Connect Web's Import Data page and upload the downloaded file. Do not import these files as courses in the mobile app. Recorded session timers provide active duration (pauses excluded); older untimed logs use estimates. Per-set export timing and calories remain estimates. FIT validation uses Garmin's official JavaScript SDK; actual acceptance by Garmin Connect can depend on the service.

## Offline and installation

Add the HTTPS app to your home screen. The service worker saves the app shell for offline use and caches exercise photos after successful viewing. Form instructions and muscle maps work without remote photos. More includes install help, offline readiness, optional sound/screen wake lock, and a button to save all exercise photos. Rest timers reconcile elapsed time on resume; this web app cannot guarantee background alarms while the phone is locked.

## Files

- `index.html`: accessible app shell
- `styles.css`: responsive light/dark design system
- `app.js`: exercise data, program logic, state, core logging, exports and events
- `companion.js`: flexible scheduling, persistent cycle history, coaching, progress/review views and device conveniences
- `sw.js`, `manifest.webmanifest`: offline/install support
- `tests/`: regression suite and responsive review fixture
- `docs/AUDIT.md`: v12 findings and verification scope

Exercise data and photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain. Exercise photos are pinned to source revision `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. Session illustrations in `assets/session-*-v13.png` were generated with the built-in image tool; prompts and intended mappings are in `assets/session-artwork.json`. They are category illustrations; exercise-level photos and quick cues provide the movement references.

This release implements audit items 2–10; the existing start experience is preserved (no new onboarding). Browser layout and automated checks do not substitute for testing installation, wake lock, sound and locked-screen behavior on a physical phone.

# FitLab

A calm, mobile-first training journal for a 12-week program. A static PWA with no runtime dependencies, no account, and local progress storage.

Live app: https://jorgedsp93.github.io/fitlab/

## Features

- **Today:** a weekly date strip, your session, daily habits, and bodyweight logging.
- **Workout:** day-specific preparation, practice sets for the actual selected lifts, editable working sets and warm-ups, notes, effort feedback, weight increments, retained work during substitutions, compact alternating supersets, pause/resume timing, and a dedicated session review.
- **Plan:** move or skip sessions, choose training weekdays, pause the plan, shorten a session to a 20/30-minute focus, add exercises, and reorder blocks.
- **Progress:** exercise weight/rep trends, personal bests, complete vs partial weekly consistency, all-cycle history, optional bodyweight and measured body-fat entries, and per-session Garmin exports.
- **More:** light/dark/system themes, lb/kg conversion, exercise search, program settings, backup and restore.

## Warm-ups

Each training day starts with an easy pulse-raising activity and movement preparation derived from its selected exercises. Push days prepare pressing, pull days include hinges and pulling, leg days prepare squatting and hinging, and lower days include single-leg and glute preparation. Substitutions, skipped movements and shorter sessions update this selection. Rest days do not receive lifting warm-ups.

Practice sets use the exercise’s own photo and are added only when requested, with editable reps and blank loads for the user to choose. Existing warm-up rows are reused; repeated taps do not duplicate them. Completed practice remains attached to the exercise actually performed after a swap. Checklist state and practice sets survive reloads and full backups. Warm-ups contribute to the estimated session time but never to working-set completion, strength records or load progression.

The general-to-specific structure follows [NSCA guidance on dynamic warm-ups](https://www.nsca.com/education/articles/kinetic-select/introduction-to-dynamic-warm-up/). The short routines and starting rep suggestions are FitLab defaults, not individualized prescriptions. Keep the movements comfortable and low-fatigue; adjust or add practice sets as needed.

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

Automatic uploads are not connected. Garmin's personal access currently provides data retrieval, and its public Training API describes publishing planned workouts rather than finished activities. Automatic completed-session uploads need Garmin to confirm and grant the appropriate integration access. See [Garmin integration status](docs/GARMIN_SYNC.md) for the verified boundary and next step.

## Rest alerts

Tap **Start rest** under the set table to use that exercise’s rest duration. Completed working sets also start rest automatically, after both movements for supersets. The floating countdown includes **+30s**, **Skip rest**, sound on/off, and **Test sound**. Finishing plays a three-tone chime and requests vibration where supported; a persistent **Rest complete** banner stays until **Continue** or another rest. Continue never logs a set. The deadline and completion banner survive reloads.

Sound defaults on for new or unset preferences; an existing explicit mute is preserved. Use **Enable & test sound** to turn it on, unlock playback, and check media volume/headphones. If audio is unavailable, the visible alert still works. The timer is based on a saved deadline, but a locked or backgrounded browser can delay its alert. Keep FitLab visible for timely alerts; this is not a native background alarm. See [browser audio gesture requirements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy) and [background timer throttling](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API#policies_in_place_to_aid_background_page_performance).

## Offline and installation

Add the HTTPS app to your home screen. The service worker saves the app shell for offline use and caches exercise photos after successful viewing. Form instructions and muscle maps work without remote photos. More includes install help, offline readiness, optional sound/screen wake lock, and a button to save all exercise photos. Rest timers reconcile elapsed time on resume; this web app cannot guarantee background alarms while the phone is locked.

The forest-green and ivory F mark is used for the header, browser tab, home-screen icon and maskable installed icon. The generated master is `assets/fitlab-icon-v4.png`; its prompt and size mappings are recorded in `assets/icon-artwork.json`.

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

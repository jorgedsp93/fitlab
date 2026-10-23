# FitLab

An offline workout journal with an eight-week return-to-training plan: four lifting sessions, one easy cardio/mobility session, and two rest days per seven-day cycle.

## Current release: 13.0

- Today leads with one workout card; exercises and daily habits expand on demand.
- Plan contains all eight weeks, gradual set progression, training guidance, and food/recovery notes. The cycle starts on the device’s current local date; its days follow that start date rather than fixed weekdays.
- Existing 12-week schedules and logs are archived before the comeback program starts. More lets users reopen either program with its own schedule and logs. Body measurements and appearance settings are shared. Full backups include both programs.
- More includes a network update check. Updates never automatically replace an active input; an available update offers Save & reload.
- Workouts save locally in the current browser. Use More → Your data & backups before switching devices or clearing browser data.

## Features

- **Today:** a weekly date strip, your session, daily habits, and bodyweight logging.
- **Workout:** set-by-set logging, exercise demonstrations, supported alternatives, superset-aware rest timers, and a session review.
- **Plan:** eight comeback weeks, or the classic 12-week program, browsable one week at a time.
- **Progress:** session history, bodyweight trends, optional body-fat estimates, and Garmin exports.
- **More:** light/dark/system themes, lb/kg conversion, exercise search, program settings, backup and restore.

## Data and upgrades

Progress stays in the browser's `fitlab_v1` localStorage record. Version 13 archives the previous schedule and saves a recovery copy before opening the comeback plan. A full backup is available in **More → Your data & backups**. Restoring replaces current data after confirmation and saves a recovery copy first. Starting a new cycle clears current workouts/check-ins but retains body measurements and a downloadable recovery copy.

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

Download a session's **FIT** from Progress, or export **TCX** for multiple sessions. Open Garmin Connect Web's Import Data page and upload the downloaded file. Do not import these files as courses in the mobile app. Workout timing and calories are estimates. FIT validation uses Garmin's official JavaScript SDK; actual acceptance by Garmin Connect can depend on the service.

## Offline and installation

Add the HTTPS app to your home screen. The service worker saves the app shell for offline use and caches exercise photos after successful viewing. Form instructions and muscle maps work without remote photos. Rest timers reconcile elapsed time on resume; this web app cannot guarantee background alarms while the phone is locked.

## Files

- `index.html`: accessible app shell
- `styles.css`: responsive light/dark design system
- `app.js`: exercise data, program logic, state, views, exports and events
- `sw.js`, `manifest.webmanifest`: offline/install support
- `tests/`: regression suite and responsive review fixture
- `docs/AUDIT.md`: audit findings and verification scope

Exercise data and photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain. Existing FitLab artwork is retained in `assets/`.

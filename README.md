# FitLab

An offline workout journal with an eight-week, four-day Push / Pull plan. Full sessions include legs, warm-up, rest and cooldown within a one-hour budget.

## Current release: 13.2

- **Day 1 / Monday: Push A** — chest, shoulders, triceps, quads and calves.
- **Day 2 / Tuesday: Pull A** — back, biceps, hamstrings and glutes.
- **Wednesday:** easy cardio and mobility.
- **Thursday / Friday:** Push B / Pull B.
- **Weekend:** rest. Dates follow the selected start date, so Day 1 can be any weekday.

Each lifting session has six exercises and 14 working sets throughout the eight weeks. Progress by improving controlled repetitions and then load, with no automatic cuts to exercises or sets. Start with loads that leave about three good reps; increase only when the full prescribed range feels controlled.

Push supersets pair chest with quads, pressing or chest isolation with calves, and side delts with triceps. Pull days keep the first two lifts separate, then pair back with leg curls and rear delts with biceps. All 32 lifting sessions are estimated at 47–53 minutes, including ten minutes of warm-up/practice, five minutes of cooldown, rests and equipment transitions. Actual equipment delays can vary.

## Start on your device

[Open Push / Pull setup](https://jorgedsp93.github.io/fitlab/?setup=pushpull&release=13.2) and tap **Start Push / Pull today**. This starts Push A on the device’s current local date. Opening the link alone never resets progress. The current program is archived, a full recovery copy is saved, and body measurements remain. Existing comeback and classic programs stay available in **More** with their own schedules and logs; an update never silently reinterprets those sessions as push/pull.

New installs open Push / Pull by default. **More → Program settings → Restart at Day 1 today** restarts the currently selected program. Progress is local to each browser/device, and full backups include all saved programs.

## One hour, including warm-up

Open a workout and tap **Start 60-minute clock & warm-up** when you begin. The clock includes breaks and survives reloads. Complete one set of each paired exercise, then take the displayed rest. The two-minute main-lift rests and 75–90-second accessory rests are included in the estimate. Every planned set stays visible. At minute 50, a prompt reminds you to finish the planned sets and cool down; minute 55 leaves five minutes to finish. Keep the app visible for timely prompts; background or locked-phone alerts are not guaranteed.

The grouping follows [NSCA’s discussion of push/pull split routines](https://www.nsca.com/education/articles/kinetic-select/determination-of-resistance-training-frequency/) and [time-efficient superset training](https://www.nsca.com/education/articles/ptq/time-efficient-training). Exercise selection and time estimates are FitLab programming choices.

## Features

- **Today:** a weekly date strip, your session, daily habits, and bodyweight logging.
- **Workout:** set-by-set logging, exercise demonstrations, supported alternatives, superset-aware rest timers, and a session review.
- **Plan:** eight push/pull or comeback weeks, or the classic 12-week program, browsable one week at a time.
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

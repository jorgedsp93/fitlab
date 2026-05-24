# FitLab — 12-Week Recomp PWA

A mobile-first web app to run a 12-week, 5-day gym program aimed at getting back to sub-10% body fat. Built as a single self-contained app (no build step, no dependencies, works offline).

## What's inside
- **Today** — the day's guided workout blocks, focus muscle groups, phase, conditioning finisher, step + protein targets.
- **Plan** — the full 12-week calendar (3 phases: Foundation → Build → Define). Tap any day to open it.
- **Library** — every exercise with 3 visuals (start photo, end photo, muscle body-map) + step-by-step cues.
- **Workout flow** — one exercise or superset at a time with automatic local saving as each set is logged.
- **Smarter lifting guidance** — per-dumbbell vs total-load labels, logged-weight recommendations, equipment alternatives, and workout reviews.
- **Stats** — bodyweight log, U.S. Navy body-fat estimator (height fixed at 6'1"), workout/streak counts.
- **Garmin export** — download Garmin Connect manual-upload `.tcx` files, mapped `.fit` strength beta files, plus full FitLab JSON details.
- **Fat-Loss Playbook** — the nutrition + lifestyle side (the part that actually gets you sub-10%).

All progress (sets, weights, reps, bodyweight, body fat) is saved locally on the device via `localStorage`.

## Garmin upload
FitLab can export logged workouts for Garmin Connect manual upload. Use TCX first because it is the most reliable manual-upload format in Garmin Connect. A mapped FIT beta export is also available for testing Garmin strength set/category mapping, but Garmin Connect may reject custom strength FIT files even when the file validates.

1. Log at least one set in a workout.
2. Open that workout or go to **Stats**.
3. Tap **Export Garmin TCX** or **Export all TCX**.
4. In Garmin Connect Web, use manual activity upload and choose the downloaded `.tcx` file.
5. Use **Mapped FIT beta** only when you want to test Garmin's strength set mapping.

The TCX export includes a notes block with the exercises, weights, reps, and sets. The FIT beta export includes completed set messages with Garmin exercise category/subtype IDs, reps, weights, start times, and workout duration. Use the JSON export when you want the full FitLab-native detail exactly as stored in the app.

## Run it
From this folder:

```bash
python3 -m http.server 8077
```

- On this Mac: open <http://localhost:8077>
- On your iPhone (same Wi-Fi): open `http://192.168.2.95:8077`
  Then Share → **Add to Home Screen** for a full-screen app icon.

## Full PWA / offline on iPhone
iOS only enables the offline service worker over **HTTPS**. For offline support, deploy the folder to any free static host (Netlify drop, GitHub Pages, Vercel) and open the HTTPS URL. Over plain LAN HTTP the app still works fully online; only offline caching is disabled.

## Data sources
Exercise photos + instructions: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), served via jsDelivr CDN. Muscle body-maps are drawn in-app as SVG.

## Files
- `index.html` — the entire app (UI + program logic + embedded exercise data)
- `sw.js` — service worker (offline app shell + image cache)
- `manifest.webmanifest` — PWA manifest
- `icon-*.png`, `apple-touch-icon.png` — app icons

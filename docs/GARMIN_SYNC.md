# Garmin completed-workout sync

Checked against Garmin's official public documentation on 2026-10-22.

## Requested outcome

After finishing a FitLab session, save the completed workout to Garmin Connect history. This is different from sending a future workout to a watch to follow. FitLab currently offers FIT/TCX downloads and a link to Garmin Connect's manual import page. Automatic upload is **not implemented or connected**.

## Confirmed access boundary

- [Garmin's current program overview](https://developer.garmin.com/gc-developer-program/overview/) lists personal access as pull-only activity, health and women's health data. It does not list completed-activity upload access.
- [The Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) describes receiving activities recorded on a Garmin device after the device uploads to Garmin Connect.
- [The Training API](https://developer.garmin.com/gc-developer-program/training-api/) publishes planned workouts and training plans for users to follow. It is not evidence of a completed-activity upload endpoint.
- The [developer portal](https://developerportal.garmin.com/developer-programs/connect-developer-api) offers business Starter and Enterprise access. Its public descriptions do not establish that a new FitLab app receives completed-activity upload permission.

These findings mean FitLab cannot honestly offer a working “Connect Garmin” button from the current access available here. They do not establish that Garmin would refuse a completed-activity integration.

## Next step

Request access through [Garmin's official application](https://www.garmin.com/en-US/forms/StarterGarminConnectDeveloperAccess/), explicitly asking whether FitLab can upload completed strength-training activity FIT files into consenting users' Garmin Connect history. Obtain confirmation of that capability, the permitted upload interface and authentication documentation before implementing against it. General Training API approval alone does not establish this capability.

Suggested capability description for an application (not submitted):

> FitLab is a strength-training journal. Users record their completed sets, repetitions, weights and session duration. We want an optional connection that uploads a completed strength-training activity to the user's Garmin Connect activity history after they finish a session in FitLab. We need confirmation of completed-activity FIT upload support; publishing planned workouts alone does not meet this use case.

No Garmin account has been connected, no developer agreement accepted and no personal workout data uploaded as part of this work.

## Implementation once access is confirmed

Use Garmin's approved authorization flow and keep any required application secrets and refresh tokens out of this static public website. Queue only finished sessions with explicit user consent; preserve a stable session identifier to avoid duplicate uploads; report success only after a provider receipt. Offline sessions must retry safely when online, and revoked access must stop retries. Reopening a session should not silently create another Garmin activity. Account disconnection and deletion need defined behavior before release.

Validate a real uploaded activity against Garmin Connect after consent. A decodable FIT export proves the file format, not remote acceptance or an update to the watch. Garmin also limits which third-party activities contribute to [training metrics](https://support.garmin.com/en-CA/?faq=7ZzrBvVky79ktNeANR0vP8), so activity-history upload must not be advertised as guaranteed training-load or recovery updates.

# Visual feedback and load adjustment

FitLab 13.5 uses exercise photos, five-face scales, a front/back muscle map and numeric discomfort buttons. No answer requires typing. A completed Day 1 can be rated from Today or its workout page; Finish & review opens the check-in. Each tap saves locally and is included in full backups. Workout ratings belong to their program; current readiness belongs to the person across programs.

## Evidence and its limits

- [Graham & Cleather, 2021, RIR autoregulation versus fixed loading](https://pubmed.ncbi.nlm.nih.gov/31009432/), DOI 10.1519/JSC.0000000000003164, supports considering perceived repetitions in reserve when adjusting resistance training. It does not validate FitLab's exact algorithm.
- [Refalo et al., 2024](https://pubmed.ncbi.nlm.nih.gov/38393985/), DOI 10.1080/02640414.2024.2321021: 18 trained participants completed eight weeks of unilateral leg press/extension. Perceived 1–2 RIR produced similar quadriceps growth to failure, while failure produced greater acute fatigue. This supports avoiding a requirement to reach failure. It is not direct evidence for every exercise, returning trainee, or a specific 2–3 RIR prescription.
- [Nosaka, Newton & Sacco, 2002](https://pubmed.ncbi.nlm.nih.gov/12453160/), DOI 10.1034/j.1600-0838.2002.10178.x: in 110 men doing eccentric elbow-flexor work, soreness correlated poorly with other damage indicators. Soreness cannot tell the app whether a muscle grew, whether training was effective, or whether a bigger load is earned.
- [ACSM's 2026 guidance](https://acsm.org/resistance-training-guidelines-update-2026/) prioritizes regular resistance training and individualization. Training to failure is not consistently necessary for the average healthy adult. This does not certify this app or guarantee outcomes.

## Transparent product rules

These are conservative software decisions informed by the principles above, **not clinically validated cutoffs or a diagnostic system**. Self-reported RIR is an estimate and cannot verify technique.

1. A user rates good reps left after the last completed working set: 0, 1, 2, 3, or 4+. Ratings require a logged completed set. Changing that exercise's recorded weights/reps or completion flags invalidates its old effort rating; unit conversion preserves a still-valid rating.
2. For Push / Pull and comeback: 0 RIR suggests one smaller configured equipment step when possible. 1 RIR repeats the load and rep target. 2–3 RIR uses normal double progression. 4+ RIR can add two reps within the prescribed range. A load increase still needs all required sets at a consistent load and the top of the range; increases are limited to one configured equipment step.
3. Missing feedback retains the existing performance-based suggestions. It is never treated as an easy rating. New movements require the user's own starting load. No weight is inferred from another exercise or archived program.
4. Muscle discomfort 4–6 holds progression in exercises that list the muscle as a primary or secondary target. A report older than 48 hours asks for a fresh check and continues holding progression. Discomfort 7–10 or any sharp/joint pain pauses affected load recommendations until explicitly rechecked. Neither low soreness nor no soreness grants an increase. Body-map regions are approximate and cannot identify an injured structure.
5. A fresh readiness rating of 1–2 holds progression for 24 hours. Overall post-workout feeling is saved for reflection but is not treated as readiness for the following week. Only today's workout discomfort updates current readiness; backfilling a historical session does not make its old pain current.
6. Normal performance/effort adjustments retain every exercise, set, prescribed rep range and superset. The plan keeps its one-hour budget. Pain may warrant pausing a movement; the app does not encourage pushing through pain to finish a checklist.
7. New workout entries use adjusted suggestions. Previously typed drafts and completed logs remain intact. Use suggestion for unfinished sets applies a new recommendation explicitly. Feedback never rewrites what the user says they lifted. Recommendations for the current workout follow the actual load already used; feedback changes the next occurrence. Pain/readiness checks also appear during the current session.
8. The classic 12-week program retains its previous progression rules, with current pain/readiness checks added. RIR adaptation applies to Push / Pull and comeback.

## Data safeguards

Feedback uses the same local save and full backup path as workouts. A failed save rolls back the feedback tap and shows the storage warning. Unknown muscle IDs, invalid scale values and malformed timestamps are discarded on restore. Switching programs archives session feedback. Restarting saves it in the recovery copy before clearing it; unresolved current discomfort remains until rechecked. There is no server or cross-device sync.

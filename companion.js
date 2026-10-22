/* FitLab companion: flexible sessions, continuous history, and personal feedback. */
const DAY_ART = {
  push: "push",
  pull: "pull",
  legs: "legs",
  upper: "upper",
  lower: "lower",
  recovery: "recovery",
  rest: "rest",
};
const HABITS = {
  ride: { name: "Ride", unit: "min", icon: "bike" },
  steps: { name: "Steps", unit: "steps", icon: "steps" },
  protein: { name: "Protein", unit: "g", icon: "protein" },
  sleep: { name: "Sleep", unit: "hours", icon: "leaf" },
};
// Preparation follows the movements actually selected, including substitutions.
const WARMUP_PATTERNS = {
  press: [
    "Barbell_Bench_Press_-_Medium_Grip",
    "Incline_Dumbbell_Press",
    "Dumbbell_Bench_Press",
    "Pushups",
    "Dips_-_Triceps_Version",
  ],
  overhead: [
    "Standing_Military_Press",
    "Dumbbell_Shoulder_Press",
    "Seated_Dumbbell_Press",
  ],
  hinge: ["Barbell_Deadlift", "Romanian_Deadlift"],
  pull: ["Pullups", "Wide-Grip_Lat_Pulldown"],
  row: ["Bent_Over_Barbell_Row", "Seated_Cable_Rows"],
  squat: ["Barbell_Squat", "Front_Barbell_Squat", "Hack_Squat", "Leg_Press"],
  lunge: ["Dumbbell_Lunges"],
  bridge: ["Barbell_Hip_Thrust"],
};
const WARMUP_DRILLS = {
  pulse: {
    name: "Easy walk, cycle, or march",
    dose: "5 min",
    cue: "Build the pace gradually. Finish warm, with plenty of energy left.",
    seconds: 300,
  },
  shoulders: {
    name: "Shoulder circles",
    dose: "8 each direction",
    cue: "Start small and gradually widen the circles within a comfortable range.",
    seconds: 30,
  },
  slides: {
    name: "Wall slides",
    dose: "6 slow reps",
    cue: "Slide your arms up a wall without arching your back. Use a comfortable range.",
    seconds: 30,
  },
  reach: {
    name: "Shoulder-blade reaches",
    dose: "8 slow reps",
    cue: "Reach both arms forward, then gently draw your shoulder blades back. Keep your neck relaxed.",
    seconds: 30,
  },
  hinge: {
    name: "Unloaded hip hinges",
    dose: "8 slow reps",
    cue: "Soften your knees, send your hips back, then stand tall. Keep your back steady.",
    seconds: 30,
  },
  ankles: {
    name: "Ankle rocks",
    dose: "6 each side",
    cue: "In a short split stance, move your front knee forward over your toes while keeping the heel down.",
    seconds: 45,
  },
  squat: {
    name: "Bodyweight squats",
    dose: "6 slow reps",
    cue: "Use a comfortable depth and keep your whole foot on the floor. Hold support if helpful.",
    seconds: 30,
  },
  lunge: {
    name: "Supported split squats",
    dose: "4 each side",
    cue: "Hold a stable support, take a split stance and bend both knees through a comfortable range.",
    seconds: 45,
  },
  bridge: {
    name: "Unloaded glute bridges",
    dose: "6 slow reps",
    cue: "Lie on your back with knees bent. Lift your hips by squeezing your glutes, without arching your back.",
    seconds: 30,
  },
};
function warmupPattern(id) {
  return Object.keys(WARMUP_PATTERNS).find((key) =>
    WARMUP_PATTERNS[key].includes(id),
  );
}
function warmupPlan(plan, dk) {
  if (plan.type !== "workout") return { drills: [], practice: [] };
  const exercises = workoutExercises(plan, dk),
    patterns = new Set(exercises.map((e) => warmupPattern(e.id))),
    ids = new Set(["pulse"]);
  if (!exercises.length) return { drills: [], practice: [] };
  if (patterns.has("press") || patterns.has("overhead")) ids.add("shoulders");
  if (patterns.has("overhead")) ids.add("slides");
  if (patterns.has("pull") || patterns.has("row")) ids.add("reach");
  if (patterns.has("squat") || patterns.has("lunge")) {
    ids.add("ankles");
    ids.add("squat");
  }
  if (patterns.has("hinge")) ids.add("hinge");
  if (patterns.has("lunge")) ids.add("lunge");
  if (patterns.has("bridge")) ids.add("bridge");
  const seen = new Set(),
    practice = exercises.filter((e) => {
      const pattern = warmupPattern(e.id);
      if (!pattern || seen.has(pattern)) return false;
      seen.add(pattern);
      return true;
    });
  // An accessory-only edited session still gets practice for its first movement.
  if (!practice.length) practice.push(exercises[0]);
  return {
    drills: [...ids].map((id) => ({ id, ...WARMUP_DRILLS[id] })),
    practice,
  };
}
function practicePrescription(id) {
  if (EXERCISES[id].equipment === "body only")
    return [
      {
        r: id === "Plank" ? "10" : "2",
        cue:
          id === "Plank"
            ? "A short, easy hold. Stop before shaking or straining."
            : "A few easy reps, well short of fatigue. Use assistance if needed and record the variation in Notes; the weight field is added load only.",
      },
    ];
  return [
    {
      r: "5",
      cue: "Very light load. Rehearse the setup and movement with control.",
    },
    {
      r: "3",
      cue: "A little closer to your working load, only if the first set felt easy. Stay below your working weight.",
    },
  ];
}
function warmupTimeEstimate(plan, dk) {
  const prep = warmupPlan(plan, dk),
    m = S.sessions[dk] || {};
  let total = prep.drills.reduce((sum, d) => sum + d.seconds, 0),
    remaining = dayProgress(plan).done
      ? 0
      : prep.drills.reduce(
          (sum, d) => sum + (m.warmupPrep?.[d.id] ? 0 : d.seconds),
          0,
        );
  for (const e of prep.practice) {
    const count = practicePrescription(e.id).length,
      logged = (S.logs[dk]?.[e.id] || []).filter(
        (s) => s.kind === "warmup" && s.done,
      ).length;
    total += count * 45;
    if (!exDoneCount(dk, e.id)) remaining += Math.max(0, count - logged) * 45;
  }
  return { total, remaining };
}
function addPracticeSets(dk, id) {
  const n = dayNum(dk),
    p = planFor(Math.floor(n / 7) + 1, n % 7),
    e = warmupPlan(p, dk).practice.find((e) => e.id === id);
  if (!e) return;
  const prescription = practicePrescription(id),
    a = setsFor(dk, id, e.sets, "", parseRange(e.reps).min || ""),
    count = a.filter((s) => s.kind === "warmup").length;
  if (!exDoneCount(dk, id))
    a.splice(
      count,
      0,
      ...prescription.slice(count).map((s) => ({
        w: "",
        r: s.r,
        kind: "warmup",
        warmupCue: s.cue,
        done: false,
      })),
    );
  sessionFor(dk).warmupExpanded = false;
  sessionFor(dk).pairFocus = id;
  setFlowIndex(
    p,
    workoutBlocks(p, dk).findIndex((b) => b.ex.some((e) => e.id === id)),
  );
  save();
  render();
  document
    .querySelector(".flowcard")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderWarmup(plan, dk) {
  const prep = warmupPlan(plan, dk);
  if (!prep.drills.length) return "";
  const m = S.sessions[dk] || {},
    done = prep.drills.filter((d) => m.warmupPrep?.[d.id]).length,
    expanded = m.warmupExpanded ?? dayProgress(plan).done === 0;
  return `<section class="warmup-card" aria-label="${esc(plan.title)} warm-up"><button class="warmup-heading" data-warmup-expand="${dk}" aria-expanded="${expanded}" aria-controls="warmupContent"><span><span class="eyebrow">BEFORE YOU LIFT</span><b>Warm up for ${esc(plan.title.toLowerCase())}</b><small>${done}/${prep.drills.length} preparation steps · about ${Math.ceil(prep.drills.reduce((sum, d) => sum + d.seconds, 0) / 60)} min, plus practice sets</small></span><span aria-hidden="true">${expanded ? "−" : "+"}</span></button>${
    expanded
      ? `<div id="warmupContent"><p class="note">Prepare for today’s movements. Keep everything easy and comfortable; this should not tire you out.</p><div class="warmup-checklist">${prep.drills.map((d) => `<button class="warmup-step ${m.warmupPrep?.[d.id] ? "on" : ""}" data-warmup-check="${dk}|${d.id}" aria-pressed="${!!m.warmupPrep?.[d.id]}"><span class="prep-check" aria-hidden="true">${icon("check")}</span><span><b>${d.name}</b><small>${d.dose}</small><span>${d.cue}</span></span></button>`).join("")}</div><h3>Practice today’s lifts</h3><p class="note">Do these just before each movement. Start light, add weight gradually, and rest as needed. Add more warm-up sets if you need them. Photos show the actual selected exercise.</p><div class="warmup-practice">${prep.practice
          .map((e) => {
            const x = EXERCISES[e.id],
              rows = (S.logs[dk]?.[e.id] || []).filter(
                (s) => s.kind === "warmup",
              ),
              started = exDoneCount(dk, e.id) > 0;
            return `<div class="practice-movement"><img src="${exerciseImage(e.id)}" alt="${esc(x.name)}" loading="lazy"><div><b>${esc(x.name)}</b><small>${started ? "Working sets started" : `${practicePrescription(e.id).length} easy practice ${practicePrescription(e.id).length === 1 ? "set" : "sets"}${rows.length ? ` · ${rows.filter((s) => s.done).length} logged` : ""}`}</small><button class="textlink" data-practice-sets="${dk}|${e.id}">${started ? "View exercise" : rows.length >= practicePrescription(e.id).length ? "Log warm-up sets" : "Add & log warm-up"}</button></div></div>`;
          })
          .join(
            "",
          )}</div><p class="note">Warm-ups stay separate from working sets and strength records. Weights are yours to choose.</p><button class="btn ghost" data-warmup-expand="${dk}">Continue to workout</button></div>`
      : ""
  }</section>`;
}
let archiveSelection = null,
  trendExercise = "",
  reviewingSession = false,
  installPrompt = null,
  wakeLock = null,
  offlineReady = false;
const copy = (value) => JSON.parse(JSON.stringify(value));
const isDayKey = (value) => /^w(?:[1-9]|1[0-2])d[0-6]$/.test(value);
function normalizeCompanionState(s, original) {
  const defaults = newState();
  s.sessions = record(s.sessions) ? s.sessions : {};
  for (const [dk, m] of Object.entries(s.sessions)) {
    if (!isDayKey(dk) || !record(m)) {
      delete s.sessions[dk];
      continue;
    }
    if (!validDate(m.performedDate)) delete m.performedDate;
    for (const field of ["startedAt", "runningSince", "endedAt"])
      if (m[field] && !Number.isFinite(Date.parse(m[field]))) delete m[field];
    m.elapsedMs =
      Number.isFinite(m.elapsedMs) && m.elapsedMs >= 0 ? m.elapsedMs : 0;
    for (const field of ["counts", "notes", "effort", "omitted"])
      m[field] = record(m[field]) ? m[field] : {};
    m.warmupPrep = record(m.warmupPrep)
      ? Object.fromEntries(
          Object.entries(m.warmupPrep).filter(
            ([id, checked]) =>
              Object.hasOwn(WARMUP_DRILLS, id) && checked === true,
          ),
        )
      : {};
    if (typeof m.warmupExpanded !== "boolean") delete m.warmupExpanded;
    for (const [id, n] of Object.entries(m.counts))
      if (!EXERCISES[id] || !Number.isInteger(n) || n < 1 || n > 30)
        delete m.counts[id];
    for (const id of Object.keys(m.notes))
      m.notes[id] = String(m.notes[id]).slice(0, 500);
    for (const [id, effort] of Object.entries(m.effort))
      if (!["easy", "right", "hard"].includes(effort)) delete m.effort[id];
    m.order = Array.isArray(m.order)
      ? [...new Set(m.order.filter((id) => EXERCISES[id]))]
      : [];
    m.added = Array.isArray(m.added)
      ? m.added
          .filter((e) => record(e) && EXERCISES[e.id])
          .map((e) => ({
            id: e.id,
            sets: Math.min(30, Math.max(1, Number(e.sets) || 3)),
            reps: String(e.reps || "8–12"),
            rest: 60,
          }))
      : [];
  }
  s.schedule = record(s.schedule) ? s.schedule : { dates: {} };
  s.schedule.dates = record(s.schedule.dates)
    ? Object.fromEntries(
        Object.entries(s.schedule.dates).filter(
          ([dk, d]) => isDayKey(dk) && validDate(d),
        ),
      )
    : {};
  s.schedule.pausedAt = validDate(s.schedule.pausedAt)
    ? s.schedule.pausedAt
    : null;
  const pref = record(s.preferences) ? s.preferences : {};
  s.preferences = { ...defaults.preferences, ...pref };
  s.preferences.sound = typeof pref.sound === "boolean" ? pref.sound : true;
  for (const field of ["restTimer", "restReady"]) {
    const timer = s[field];
    if (!record(timer) || !Number.isFinite(timer.endsAt) || timer.endsAt <= 0) {
      delete s[field];
      continue;
    }
    s[field] = {
      endsAt: timer.endsAt,
      label: String(timer.label || "Rest").slice(0, 120),
      id:
        typeof timer.id === "string"
          ? timer.id.slice(0, 100)
          : `rest-${timer.endsAt}`,
    };
  }
  if (s.restTimer) delete s.restReady;
  s.preferences.weekdays = Array.isArray(pref.weekdays)
    ? [
        ...new Set(
          pref.weekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
        ),
      ]
    : [];
  s.preferences.weeklyTarget = Math.min(
    7,
    Math.max(1, Number(pref.weeklyTarget) || 5),
  );
  s.preferences.focus = ["strength", "consistency", "bodyweight"].includes(
    pref.focus,
  )
    ? pref.focus
    : "strength";
  s.preferences.increments = record(pref.increments) ? pref.increments : {};
  for (const [id, inc] of Object.entries(s.preferences.increments))
    if (
      !EXERCISES[id] ||
      !record(inc) ||
      !["lb", "kg"].includes(inc.unit) ||
      !Number.isFinite(inc.value) ||
      inc.value <= 0 ||
      inc.value > 100
    )
      delete s.preferences.increments[id];
  s.preferences.habits = {};
  for (const key of Object.keys(HABITS)) {
    const h = pref.habits?.[key] || defaults.preferences.habits[key],
      target = Number(h.target);
    s.preferences.habits[key] = {
      enabled: h.enabled === true,
      target:
        h.target !== null && Number.isFinite(target) && target > 0
          ? target
          : null,
    };
  }
  s.archives = Array.isArray(s.archives)
    ? s.archives
        .filter(
          (c) =>
            record(c) &&
            record(c.logs) &&
            validDate(c.startDate) &&
            typeof c.id === "string",
        )
        .map((c) => ({
          ...c,
          unit: c.unit === "kg" ? "kg" : "lb",
          sessions: record(c.sessions) ? c.sessions : {},
          schedule: record(c.schedule) ? c.schedule : { dates: {} },
          swaps: record(c.swaps) ? c.swaps : {},
          reviewed: record(c.reviewed) ? c.reviewed : {},
          done: record(c.done) ? c.done : {},
        }))
    : [];
  for (const cycle of s.archives) {
    for (const [dk, log] of Object.entries(cycle.logs)) {
      if (!isDayKey(dk) || !record(log)) {
        delete cycle.logs[dk];
        continue;
      }
      for (const [id, sets] of Object.entries(log)) {
        if (!Object.hasOwn(EXERCISES, id) || !Array.isArray(sets)) {
          delete log[id];
          continue;
        }
        log[id] = sets.filter(record).map((x) => ({
          ...x,
          w: cleanNumber(x.w),
          r: cleanNumber(x.r, true),
          done: x.done === true,
        }));
      }
    }
    for (const [dk, m] of Object.entries(cycle.sessions))
      if (!record(m) || !isDayKey(dk)) delete cycle.sessions[dk];
  }
  s.backupAt =
    typeof s.backupAt === "string" && Number.isFinite(Date.parse(s.backupAt))
      ? s.backupAt
      : null;
  // Old logs used program positions as dates. Freeze them before any schedule edits.
  if (original.schemaVersion !== 13) {
    for (const [dk, log] of Object.entries(s.logs))
      if (Object.values(log).some((sets) => sets.some((x) => x.done))) {
        const n = dayNum(dk);
        s.sessions[dk] = s.sessions[dk] || {};
        s.sessions[dk].performedDate = ymd(
          baseDateForPos(Math.floor(n / 7) + 1, n % 7, s),
        );
      }
    s.bf = s.bf.map((x) => ({
      ...x,
      source: x.source || "Earlier estimate · height not confirmed",
    }));
  }
}
function sessionFor(dk) {
  return S.sessions[dk] || (S.sessions[dk] = {});
}
function workSets(sets) {
  return (sets || []).filter((x) => x.kind !== "warmup");
}
function finishedSets(sets) {
  return workSets(sets).filter((x) => x.done);
}
function sessionHasLogs(dk, state = S) {
  return Object.values(state.logs[dk] || {}).some((sets) =>
    sets.some((x) => x.done),
  );
}
function sessionHandled(plan) {
  const dk = dayKey(plan.week, plan.dayIndex);
  return (
    S.sessions[dk]?.status === "skipped" ||
    !!S.reviewed[dk] ||
    isWorkoutComplete(plan)
  );
}
function nextSession(after = -1) {
  const pending = [];
  for (let n = after + 1; n < 84; n++) {
    const p = planFor(Math.floor(n / 7) + 1, n % 7);
    if (p.type === "workout" && !sessionHandled(p)) pending.push(p);
  }
  return (
    pending.sort(
      (a, b) =>
        dateForPos(a.week, a.dayIndex) - dateForPos(b.week, b.dayIndex) ||
        (a.week - b.week) * 7 + a.dayIndex - b.dayIndex,
    )[0] || null
  );
}
function sessionElapsed(dk) {
  const m = S.sessions[dk] || {};
  return Math.max(
    0,
    Math.floor(
      ((m.elapsedMs || 0) +
        (m.runningSince
          ? Math.max(0, Date.now() - Date.parse(m.runningSince))
          : 0)) /
        1000,
    ),
  );
}
function elapsedLabel(seconds) {
  const m = Math.floor(seconds / 60);
  return m >= 60
    ? `${Math.floor(m / 60)}h ${m % 60}m`
    : `${m}:${String(seconds % 60).padStart(2, "0")}`;
}
function startSession(dk) {
  if (!isDayKey(dk)) return false;
  if (S.schedule.pausedAt) {
    toast("Resume your plan before starting a session.");
    return false;
  }
  // One running session at a time; the previous session remains resumable.
  for (const [other, m] of Object.entries(S.sessions))
    if (other !== dk && m.runningSince) pauseSession(other, false);
  const m = sessionFor(dk);
  if (!m.performedDate)
    m.performedDate = sessionHasLogs(dk)
      ? ymd(dateForPos(Math.floor(dayNum(dk) / 7) + 1, dayNum(dk) % 7))
      : todayISO();
  if (!m.startedAt) m.startedAt = new Date().toISOString();
  if (!m.runningSince) m.runningSince = new Date().toISOString();
  m.status = "active";
  delete m.endedAt;
  delete S.reviewed[dk];
  save();
  requestWakeLock();
  return true;
}
function pauseSession(dk, notifyUser = true) {
  const m = sessionFor(dk);
  if (m.runningSince) {
    m.elapsedMs =
      (m.elapsedMs || 0) + Math.max(0, Date.now() - Date.parse(m.runningSince));
    delete m.runningSince;
  }
  save();
  releaseWakeLock();
  if (notifyUser) {
    stopRest();
    render();
    toast("Session paused. Your sets are saved.");
  }
}
function finishSession(dk) {
  pauseSession(dk, false);
  stopRest();
  const m = sessionFor(dk);
  m.endedAt = new Date().toISOString();
  m.status = "finished";
  S.reviewed[dk] = true;
  save();
  go("review");
}
function freezeHistoryDates() {
  for (const dk of Object.keys(S.logs))
    if (sessionHasLogs(dk) && !S.sessions[dk]?.performedDate) {
      const n = dayNum(dk);
      sessionFor(dk).performedDate = ymd(
        dateForPos(Math.floor(n / 7) + 1, n % 7),
      );
    }
}
function moveSession(dk, date) {
  if (!validDate(date) || date < todayISO()) {
    toast("Choose today or a future date.");
    return false;
  }
  if (sessionHasLogs(dk) || S.sessions[dk]?.startedAt) {
    toast("This session has started. Its recorded date stays in your history.");
    return false;
  }
  S.schedule.dates[dk] = date;
  save();
  render();
  toast(`Session moved to ${prettyISO(date)}.`);
  return true;
}
function pausePlan() {
  S.schedule.pausedAt = todayISO();
  for (const [dk, m] of Object.entries(S.sessions))
    if (m.runningSince) pauseSession(dk, false);
  stopRest();
  save();
  render();
}
function resumePlan() {
  const days = Math.max(
    0,
    calendarDay(todayISO()) - calendarDay(S.schedule.pausedAt || todayISO()),
  );
  for (let n = 0; n < 84; n++) {
    const p = planFor(Math.floor(n / 7) + 1, n % 7),
      dk = dayKey(p.week, p.dayIndex);
    if (
      !sessionHandled(p) &&
      !sessionHasLogs(dk) &&
      !S.sessions[dk]?.startedAt
    ) {
      const date = dateForPos(p.week, p.dayIndex);
      date.setDate(date.getDate() + days);
      S.schedule.dates[dk] = ymd(date);
    }
  }
  S.schedule.pausedAt = null;
  save();
  render();
  toast("Plan resumed. Unstarted sessions moved with your break.");
}
function skipSession(dk) {
  if (sessionHasLogs(dk)) {
    toast("Finish this as a partial session to keep your completed work.");
    return;
  }
  sessionFor(dk).status = "skipped";
  save();
  render();
}
function applyTrainingDays() {
  const days = S.preferences.weekdays;
  if (!days.length) return;
  let date = new Date(todayISO() + "T00:00");
  for (let n = 0; n < 84; n++) {
    const p = planFor(Math.floor(n / 7) + 1, n % 7),
      dk = dayKey(p.week, p.dayIndex);
    if (
      p.type !== "workout" ||
      sessionHandled(p) ||
      sessionHasLogs(dk) ||
      S.sessions[dk]?.startedAt
    )
      continue;
    while (!days.includes(date.getDay())) date.setDate(date.getDate() + 1);
    S.schedule.dates[dk] = ymd(date);
    date.setDate(date.getDate() + 1);
  }
}
function shortSession(dk, minutes) {
  const n = dayNum(dk),
    p = planFor(Math.floor(n / 7) + 1, n % 7),
    m = sessionFor(dk);
  if (minutes === 0) {
    if (m.beforeShort) {
      m.omitted = m.beforeShort.omitted;
      m.counts = m.beforeShort.counts;
      delete m.beforeShort;
    }
    m.shortMinutes = 0;
    save();
    render();
    return;
  }
  if (!m.beforeShort)
    m.beforeShort = {
      omitted: copy(m.omitted || {}),
      counts: copy(m.counts || {}),
    };
  else {
    m.omitted = copy(m.beforeShort.omitted);
    m.counts = copy(m.beforeShort.counts);
  }
  const blocks = workoutBlocks(p, dk);
  let budget = minutes * 60 - warmupTimeEstimate(p, dk).total,
    kept = 0;
  m.omitted = m.omitted || {};
  m.counts = m.counts || {};
  for (const b of blocks) {
    const cost = b.ex.reduce(
      (sum, e) => sum + estimateSetSeconds(e, e.sets),
      0,
    );
    const keep =
      kept < 2 || budget >= cost || b.ex.some((e) => exDoneCount(dk, e.id));
    for (const e of b.ex) {
      if (!keep) m.omitted[e.originalId || e.id] = true;
      else if (minutes <= 20)
        m.counts[e.id] = Math.max(exDoneCount(dk, e.id), Math.min(e.sets, 2));
    }
    if (keep) {
      budget -= cost;
      kept++;
    }
  }
  m.shortMinutes = minutes;
  save();
  render();
  toast(
    `${minutes}-minute focus: the first main lifts stay. Logged sets are preserved.`,
  );
}
function addSet(dk, id, kind = "work") {
  const p = planFor(Math.floor(dayNum(dk) / 7) + 1, dayNum(dk) % 7),
    e = workoutExercises(p, dk).find((x) => x.id === id);
  if (!e) return;
  const m = sessionFor(dk),
    a = setsFor(dk, id, e.sets, "", parseRange(e.reps).min || "");
  if (a.length >= 40) {
    toast("This exercise already has 40 sets.");
    return;
  }
  const last = a.at(-1) || {};
  const row = {
    w: kind === "warmup" ? "" : last.w || "",
    r: last.r || "",
    kind,
    done: false,
  };
  if (kind === "warmup") a.unshift(row);
  else {
    a.push(row);
    (m.counts ??= {})[id] = workSets(a).length;
  }
  delete S.reviewed[dk];
  save();
  render();
}
function removeSet(dk, id, index) {
  const a = S.logs[dk]?.[id],
    s = a?.[index];
  if (!s) return;
  if (s.done) {
    toast("Undo this completed set before removing it.");
    return;
  }
  if (s.kind !== "warmup" && workSets(a).length <= 1) {
    toast("Keep one working set, or skip this exercise.");
    return;
  }
  a.splice(index, 1);
  (sessionFor(dk).counts ??= {})[id] = workSets(a).length;
  save();
  render();
}
function omitExercise(dk, id) {
  const m = sessionFor(dk);
  if (exDoneCount(dk, id)) {
    (m.counts ??= {})[id] = exDoneCount(dk, id);
    S.logs[dk][id] = S.logs[dk][id].filter((s) => s.done);
    toast("Remaining sets skipped. Completed sets stay in your history.");
  } else {
    const n = dayNum(dk),
      e = workoutExercises(planFor(Math.floor(n / 7) + 1, n % 7), dk).find(
        (e) => e.id === id,
      );
    (m.omitted ??= {})[e?.originalId || id] = true;
    toast("Exercise skipped for this session.");
  }
  save();
  render();
}
function moveBlock(dk, blockId, step) {
  const n = dayNum(dk),
    p = planFor(Math.floor(n / 7) + 1, n % 7),
    blocks = workoutBlocks(p, dk),
    i = blocks.findIndex((b) => b.id === blockId),
    j = i + step;
  if (i < 0 || j < 0 || j >= blocks.length) return;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  sessionFor(dk).order = blocks.flatMap((b) =>
    b.ex.map((e) => e.originalId || e.id),
  );
  S.flow[dk] = j;
  save();
  render();
}
function addExercise(dk, id) {
  if (!EXERCISES[id]) return;
  const n = dayNum(dk),
    p = planFor(Math.floor(n / 7) + 1, n % 7),
    m = sessionFor(dk);
  if (workoutExercises(p, dk).some((e) => e.id === id)) {
    toast("That exercise is already in this session.");
    return;
  }
  if (
    !p.ex.some((e) => e.id === id) &&
    !(m.added || []).some((e) => e.id === id)
  )
    (m.added ??= []).push({
      id,
      sets: 3,
      reps: id === "Plank" ? "30–45 sec" : "8–12",
      rest: 60,
    });
  if (m.omitted) delete m.omitted[id];
  delete S.reviewed[dk];
  save();
  render();
}
function pairedFocus(block, dk) {
  const chosen = S.sessions[dk]?.pairFocus;
  if (block.ex.some((e) => e.id === chosen)) return chosen;
  for (let round = 0; round < Math.max(...block.ex.map((e) => e.sets)); round++)
    for (const e of block.ex)
      if (round < e.sets && !workSets(S.logs[dk]?.[e.id])[round]?.done)
        return e.id;
  return block.ex[0]?.id;
}
function advancePair(block, dk) {
  delete sessionFor(dk).pairFocus;
  sessionFor(dk).pairFocus = pairedFocus(block, dk);
}
function allCycles() {
  return [...S.archives, { ...S, id: "current", label: "Current cycle" }];
}
function historyForCycle(cycle) {
  const out = [];
  for (const [dk, logs] of Object.entries(cycle.logs || {})) {
    const n = dayNum(dk);
    if (n < 0 || n > 83) continue;
    const exercises = Object.entries(logs)
      .filter(([id]) => EXERCISES[id])
      .map(([id, sets]) => ({ id, sets: sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length);
    const count = exercises.reduce(
      (sum, e) => sum + finishedSets(e.sets).length,
      0,
    );
    if (!count) continue;
    const m = cycle.sessions?.[dk] || {},
      date = ymd(dateForPos(Math.floor(n / 7) + 1, n % 7, cycle));
    const complete =
      cycle.id === "current"
        ? isWorkoutComplete(planFor(Math.floor(n / 7) + 1, n % 7))
        : m.complete === true;
    out.push({
      dk,
      n,
      w: Math.floor(n / 7) + 1,
      d: n % 7,
      title: SPLIT[n % 7].title,
      date,
      done: count,
      complete,
      finished: !!cycle.reviewed?.[dk],
      unit: cycle.unit,
      cycleId: cycle.id,
      cycleLabel: cycle.label,
      exercises,
      meta: m,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n);
}
function allHistory() {
  return allCycles()
    .flatMap(historyForCycle)
    .sort((a, b) => b.date.localeCompare(a.date) || b.n - a.n);
}
function convertedWeight(value, from, to = S.unit) {
  return (
    Number(value) *
    (from === to ? 1 : from === "lb" ? 1 / 2.2046226218 : 2.2046226218)
  );
}
function performanceFor(id) {
  return allHistory()
    .filter((h) =>
      h.exercises.some((e) => e.id === id && finishedSets(e.sets).length),
    )
    .map((h) => {
      const sets = finishedSets(h.exercises.find((e) => e.id === id).sets);
      return {
        ...h,
        sets,
        weight: Math.max(0, ...sets.map((s) => convertedWeight(s.w, h.unit))),
        reps: sets.reduce((n, s) => n + Number(s.r), 0),
        volume: sets.reduce(
          (n, s) =>
            n + convertedWeight(s.w, h.unit) * loadMeta(id).mult * Number(s.r),
          0,
        ),
      };
    })
    .reverse();
}
function pastPerformance(id, dk) {
  const currentDate = ymd(
    dateForPos(Math.floor(dayNum(dk) / 7) + 1, dayNum(dk) % 7),
  );
  return performanceFor(id)
    .filter(
      (h) =>
        !(h.cycleId === "current" && h.dk === dk) &&
        (h.date < currentDate ||
          (h.date === currentDate &&
            (h.cycleId !== "current" || h.n < dayNum(dk)))),
    )
    .at(-1);
}
function weeklySummary() {
  const end = todayISO(),
    start = new Date(end + "T00:00");
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const first = ymd(start),
    items = allHistory().filter((h) => h.date >= first && h.date <= end);
  return {
    completed: items.filter((h) => h.complete).length,
    partial: items.filter((h) => !h.complete).length,
    days: new Set(items.map((h) => h.date)).size,
    items,
    start: first,
  };
}
function archiveCycle() {
  for (const [dk, m] of Object.entries(S.sessions))
    if (m.runningSince) pauseSession(dk, false);
  freezeHistoryDates();
  const current = historyForCycle({ ...S, id: "current" });
  for (const h of current) sessionFor(h.dk).complete = h.complete;
  const snapshot = {
    id: `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: `Cycle ${S.archives.length + 1}`,
    startDate: S.startDate,
    archivedAt: new Date().toISOString(),
    unit: S.unit,
  };
  for (const key of [
    "logs",
    "done",
    "reviewed",
    "rides",
    "daily",
    "swaps",
    "sessions",
    "schedule",
  ])
    snapshot[key] = copy(S[key]);
  if (
    Object.keys(S.logs).length ||
    current.length ||
    Object.keys(S.daily).length ||
    Object.keys(S.rides).length
  )
    S.archives.push(snapshot);
}
function backupDue() {
  return (
    allHistory().length > 0 &&
    (!S.backupAt || Date.now() - Date.parse(S.backupAt) > 7 * 86400000)
  );
}
function backupReminder() {
  return backupDue()
    ? `<div class="backup-nudge">${icon("shield")}<div><b>Keep your progress with you</b><p>${S.backupAt ? "Your last backup is over a week old." : "Your training is saved on this device. Make your first backup."}</p></div><button class="textlink" data-backup="1">Back up</button></div>`
    : "";
}
function artwork(plan, cls = "") {
  return `<img class="session-art ${cls}" src="assets/session-${DAY_ART[plan.key] || "rest"}-v13.png" alt="${esc({ push: "Chest press workout", pull: "Seated row for back training", legs: "Squat for leg training", upper: "Shoulder press for upper body training", lower: "Dumbbell lunge for legs and core", recovery: "Easy bicycle ride", rest: "Quiet recovery on a mat" }[plan.key] || "Recovery")}" width="240" height="240">`;
}
function phaseDescription(phase) {
  return [
    "Foundation · Repeat the main lifts and establish consistent, controlled working sets.",
    "Build · Selected main lifts gain one working set. Keep your technique consistent as volume rises.",
    "Define · Return to base set counts, keep tracking strength, and choose optional conditioning to suit your energy.",
  ][phase];
}
function sessionTools(plan, dk) {
  const m = S.sessions[dk] || {},
    blocks = workoutBlocks(plan, dk);
  return `<details class="disclosure session-tools"><summary>Adjust this session<span class="tiny muted">Time, order & exercises</span></summary><div class="tool-section"><label class="field-label" for="sessionLength">Time available</label><div class="inlineform"><select id="sessionLength"><option value="0" ${!m.shortMinutes ? "selected" : ""}>Full session</option>${[20, 30].map((n) => `<option value="${n}" ${m.shortMinutes === n ? "selected" : ""}>${n}-minute focus</option>`).join("")}</select><button class="btn ghost sm" data-shorten="${dk}">Apply</button></div><p class="note">Short sessions keep the first main lifts and any completed work. You can restore the full session.</p></div><div class="tool-section"><h3>Exercise order</h3>${blocks.map((b, i) => `<div class="order-row"><span>${esc(b.title)}</span><button class="iconbtn" data-move-block="${dk}|${b.id}|-1" aria-label="Move ${esc(b.title)} earlier" ${!i ? "disabled" : ""}>↑</button><button class="iconbtn" data-move-block="${dk}|${b.id}|1" aria-label="Move ${esc(b.title)} later" ${i === blocks.length - 1 ? "disabled" : ""}>↓</button></div>`).join("")}</div><div class="tool-section"><label class="field-label" for="addExercise">Add an exercise</label><div class="inlineform"><select id="addExercise"><option value="">Choose a movement</option>${Object.entries(
    EXERCISES,
  )
    .filter(([id]) => !workoutExercises(plan, dk).some((e) => e.id === id))
    .map(([id, x]) => `<option value="${id}">${esc(x.name)}</option>`)
    .join(
      "",
    )}</select><button class="btn ghost sm" data-add-exercise="${dk}">Add</button></div></div></details>`;
}
function scheduleTools(plan) {
  const dk = dayKey(plan.week, plan.dayIndex),
    m = S.sessions[dk] || {};
  return `<details class="disclosure"><summary>Schedule options</summary>${sessionHasLogs(dk) || m.startedAt ? '<p class="note">This session has started. Its recorded date is kept in your history.</p>' : `<label class="field-label" for="moveDate">Move this session</label><div class="inlineform"><input id="moveDate" type="date" min="${todayISO()}" value="${ymd(dateForPos(plan.week, plan.dayIndex))}"><button class="btn ghost sm" data-move-session="${dk}">Move</button></div><button class="textlink" data-skip-session="${dk}">${m.status === "skipped" ? "Restore session" : "Skip this session"}</button>`}<p class="note">Changing one session leaves completed workouts and the rest of your schedule in place.</p></details>`;
}

function renderToday() {
  let n = selectedDayNumber();
  const w = Math.floor(n / 7) + 1,
    d = n % 7,
    plan = planFor(w, d),
    dk = dayKey(w, d),
    p = dayProgress(plan),
    complete = isWorkoutComplete(plan),
    date = dateForPos(w, d),
    time = workoutTimeEstimate(plan, dk),
    rest = plan.type === "rest",
    m = S.sessions[dk] || {},
    week = weeklySummary();
  const focus = plan.focus
    .map((x) => REGION[x] || cap(x))
    .filter((x, i, a) => a.indexOf(x) === i)
    .join(" · ");
  return `${header()}<div class="intro"><span class="eyebrow">${prettyISO(todayISO())}</span><h1>${S.schedule.pausedAt ? "Room to reset." : rest ? "Recovery is progress." : "Make today count."}</h1><p class="muted">${week.completed} complete · ${week.partial} partial this week · your goal ${S.preferences.weeklyTarget}</p></div>
  ${S.schedule.pausedAt ? `<div class="pause-banner"><b>Your plan is paused</b><p>Resume when you’re ready. Unstarted sessions move with your break.</p><button class="btn primary" data-plan-resume>Resume plan</button></div>` : ""}
  <div class="section-row"><span class="eyebrow">Week ${w}</span><div class="datepager"><button class="iconbtn" data-day-step="-7" aria-label="Previous week" ${n < 7 ? "disabled" : ""}>${icon("back")}</button><button class="iconbtn" data-day-step="7" aria-label="Next week" ${n > 76 ? "disabled" : ""}>${icon("arrow")}</button></div></div>${weekStrip(w, d)}
  <section class="training-card" aria-label="Your workout"><div class="training-top"><span class="eyebrow">${rest ? "Recharge" : m.startedAt ? "Your session" : "Up next"} · ${prettyISO(ymd(date))}</span><span class="pill">${PHASES[plan.phase].name}</span></div><div class="training-main"><div><h2>${esc(plan.title.replace(" Day", " day"))}</h2><p>${esc(focus)}</p></div>${artwork(plan)}</div>
  ${rest ? `<p class="muted">${esc(plan.cardio.d)}</p><button class="btn primary" data-restdone="${dk}" aria-pressed="${!!S.done[dk]}">${S.done[dk] ? "Recovery logged · undo" : "Mark recovery complete"}</button>` : `<div class="training-meta"><span>${icon("clock")}About ${time.total} min</span><span>${icon("train")}${workoutExercises(plan, dk).length} exercises</span><span>${icon("plan")}${p.tot} sets</span></div>${p.done ? `<div class="progress-meta"><span>${p.done} / ${p.tot} sets</span><span>${complete ? "Complete" : S.reviewed[dk] ? "Partial session saved" : "In progress"}</span></div><div class="bar"><i style="width:${p.pct}%"></i></div>` : ""}<button class="btn primary" data-open-day="${w}.${d}" ${complete || S.reviewed[dk] ? "" : 'data-start="1"'} ${S.schedule.pausedAt ? "disabled" : ""}>${complete || S.reviewed[dk] ? "View workout" : m.startedAt ? "Resume workout" : "Start workout"}${icon("arrow")}</button>`}
  <p class="phase-note">${esc(phaseDescription(plan.phase))}</p></section>
  ${!rest ? `<details class="disclosure"><summary>What’s in this session<span class="tiny muted">${workoutBlocks(plan, dk).length} blocks</span></summary>${workoutPreview(plan, dk)}</details>${scheduleTools(plan)}` : ""}
  ${dailyLogCard(new Date(todayISO() + "T00:00"), w, d, plan)}${backupReminder()}
  ${!nextSession() ? '<div class="card"><h3>Ready for another chapter?</h3><p>Your finished cycle stays in Progress.</p><button class="btn primary" data-new-cycle>Start a new cycle</button></div>' : ""}`;
}
function dailyLogCard(date, w, d, plan) {
  const key = ymd(date),
    daily = S.daily[key] || {},
    habits = Object.entries(HABITS).filter(
      ([id]) => S.preferences.habits[id].enabled,
    ),
    weight = S.bw.find((x) => x.d === key);
  return `<section aria-label="Daily check-in"><div class="section-row"><h3>Small things, daily.</h3><button class="textlink" data-go="more">Edit habits</button></div><div class="habitlist">${habits
    .map(([id, h]) => {
      const on =
          !!daily[id] ||
          (id === "ride" && ymd(dateForPos(w, d)) === key && rideOn(w, d)),
        target = S.preferences.habits[id].target;
      return `<button class="habitbtn ${on ? "on" : ""}" data-daily-toggle="${key}|${id}" aria-pressed="${on}"><span class="habit-icon">${icon(on ? "check" : h.icon)}</span><span><b>${h.name}</b><small>${on ? "Logged" : target ? `${displayNumber(target)} ${h.unit} · your target` : "Your own goal"}</small></span></button>`;
    })
    .join(
      "",
    )}</div>${!habits.length ? '<p class="note">Choose the habits you want to track in More.</p>' : ""}<details class="disclosure"><summary>${weight ? `Bodyweight · ${displayNumber(weight.v)} ${S.unit}` : "Log bodyweight"}<span class="tiny muted">Optional</span></summary><form class="inlineform" data-bw-form="${key}"><label><span class="field-label">Bodyweight (${S.unit})</span><input id="dailyBwIn" data-number="1" inputmode="decimal" aria-label="Bodyweight" value="${weight ? esc(weight.v) : ""}" required></label><button type="submit" class="btn primary sm">Save</button></form></details></section>`;
}
function renderDayView() {
  if (!viewingPos) return renderToday();
  const { week: w, dayIndex: d } = viewingPos,
    p = planFor(w, d),
    dk = dayKey(w, d),
    progress = dayProgress(p),
    m = S.sessions[dk] || {},
    time = workoutTimeEstimate(p, dk);
  if (p.type === "rest")
    return `${backHead(p.title, prettyISO(ymd(dateForPos(w, d))))}<div class="card recovery-card">${artwork(p)}<h2>A little room to recover.</h2><p>${esc(p.cardio.d)}</p><button class="btn primary" data-restdone="${dk}">${S.done[dk] ? "Recovery logged · undo" : "Mark recovery complete"}</button></div>`;
  return `${backHead(p.title, `Week ${w} · ${prettyISO(ymd(dateForPos(w, d)))}`)}<div class="session-clock"><span><b data-session-clock="${dk}">${elapsedLabel(sessionElapsed(dk))}</b> ${m.runningSince ? "training" : m.startedAt ? "paused" : "not started"}</span><button class="textlink" ${m.runningSince ? `data-pause-session="${dk}"` : `data-resume-session="${dk}"`}>${m.runningSince ? "Pause" : m.startedAt ? "Resume" : "Start timer"}</button></div>
  <div class="workout-progress"><div class="progress-meta"><span>${progress.done} of ${progress.tot} sets logged</span><span>${progress.done === progress.tot ? "Session complete" : `About ${time.remaining} min left`}</span></div><div class="bar"><i style="width:${progress.pct}%"></i></div></div>
  ${renderWarmup(p, dk)}${renderWorkoutFlow(p, dk)}${progress.done ? '<button class="btn ghost finish-session" data-finish-workout>Finish & review session</button>' : ""}
  ${sessionTools(p, dk)}${scheduleTools(p)}<details class="disclosure"><summary>Session overview</summary>${workoutPreview(p, dk)}</details>`;
}
function exBlock(e, dk) {
  const x = EXERCISES[e.id],
    m = sessionFor(dk),
    sug = suggest(e.id, e, dk),
    prior = pastPerformance(e.id, dk);
  let html = baseExBlock(e, dk);
  const priorText = prior
    ? `${prettyISO(prior.date)} · ${prior.sets.map((s) => `${displayNumber(convertedWeight(s.w, prior.unit))} × ${s.r}`).join(", ")} ${S.unit}`
    : "No previous working sets for this movement yet.";
  if (prior)
    html = html.replace(
      '<div class="sugg">',
      `<div class="previous-performance"><span class="eyebrow">Last time</span><p>${esc(priorText)}</p></div><div class="sugg">`,
    );
  html = html.replace(
    '<div class="settable">',
    `<p class="coach-reason">${esc(exDoneCount(dk, e.id) ? "Keep the same setup for the remaining sets. Adjust if your form changes." : prior ? sug.note : "Choose a weight you can move with control. Your completed sets will guide the next session.")}</p>${
      (S.logs[dk]?.[e.id] || []).some((s) => s.kind === "warmup")
        ? `<div class="practice-guidance"><b>Your warm-up sets</b><ol>${S.logs[
            dk
          ][e.id]
            .filter((s) => s.kind === "warmup")
            .map(
              (s) =>
                `<li>${esc(s.warmupCue || "Choose an easy load and reps. Save your energy for the working sets.")}</li>`,
            )
            .join(
              "",
            )}</ol><p>Rest as needed between practice sets. Edit reps and loads to suit you.</p></div>`
        : warmupPlan(
              planFor(Math.floor(dayNum(dk) / 7) + 1, dayNum(dk) % 7),
              dk,
            ).practice.some((x) => x.id === e.id) && !exDoneCount(dk, e.id)
          ? `<button class="practice-prompt textlink" data-practice-sets="${dk}|${e.id}">Add warm-up sets for this movement</button>`
          : ""
    }<div class="settable">`,
  );
  html = html.replace(
    "</section>",
    `<div class="set-actions"><button class="textlink" data-add-set="${dk}|${e.id}|work">+ Working set</button><button class="textlink" data-add-set="${dk}|${e.id}|warmup">+ Warm-up</button></div><details class="disclosure"><summary>Edit sets & exercise</summary>${(S.logs[dk]?.[e.id] || []).map((s, i) => `<div class="entry-row"><span>${s.kind === "warmup" ? "Warm-up" : "Working set"} ${i + 1}${s.done ? " · completed" : ""}</span><button class="textlink" data-remove-set="${dk}|${e.id}|${i}" ${s.done ? "disabled" : ""}>Remove</button></div>`).join("")}<button class="textlink" data-omit-exercise="${dk}|${e.id}">Skip ${exDoneCount(dk, e.id) ? "remaining sets" : "exercise"}</button></details><fieldset class="effort"><legend>How did this feel?</legend>${[
      ["easy", "Easy"],
      ["right", "About right"],
      ["hard", "Too hard"],
    ]
      .map(
        ([v, label]) =>
          `<button class="chip ${m.effort?.[e.id] === v ? "on" : ""}" data-effort="${dk}|${e.id}|${v}" aria-pressed="${m.effort?.[e.id] === v}">${label}</button>`,
      )
      .join(
        "",
      )}</fieldset><label class="field-label" for="exerciseNote">Notes for next time</label><textarea id="exerciseNote" rows="2" maxlength="500" data-exercise-note="${dk}|${e.id}" placeholder="Bench position, equipment, or how it felt…">${esc(m.notes?.[e.id] || "")}</textarea><details class="disclosure"><summary>Available weight increment</summary><label class="field-label" for="increment">Smallest increase (${S.unit}${loadMeta(e.id).mult > 1 ? " per dumbbell" : ""})</label><div class="inlineform"><input id="increment" inputmode="decimal" value="${displayNumber(incFor(e))}"><button class="btn ghost sm" data-increment="${e.id}">Save</button></div></details></section>`,
  );
  let working = 0;
  html = html.replace(/<span class="sn">\d+<\/span>/g, () => {
    const s = S.logs[dk][e.id][working++];
    return `<span class="sn">${s.kind === "warmup" ? "W" : workSets(S.logs[dk][e.id].slice(0, working)).length}</span>`;
  });
  return html;
}
function swapControl(e, dk) {
  const base = e.originalId || e.id,
    p = planFor(Math.floor(dayNum(dk) / 7) + 1, dayNum(dk) % 7),
    used = new Set(
      workoutExercises(p, dk)
        .filter((x) => x.originalId !== base)
        .map((x) => x.id),
    );
  const choices = Object.entries(EXERCISES).filter(
    ([id, x]) =>
      id !== e.id &&
      !used.has(id) &&
      x.primary.some((m) => EXERCISES[base].primary.includes(m)),
  );
  return `<p class="note">Swap the remaining sets. Completed sets keep their original exercise and photo.</p><div class="swapbuttons">${choices.map(([id, x]) => `<button class="swapbtn" data-swap-ex="${dk}|${base}|${id}">${esc(x.name)}</button>`).join("")}</div>`;
}
function renderWorkoutFlow(plan, dk) {
  const blocks = workoutBlocks(plan, dk),
    idx = flowIndexFor(plan),
    b = blocks[idx],
    p = dayProgress(plan);
  if (!b)
    return '<div class="card"><p>No exercises left in this session. Add a movement below.</p></div>';
  const focus = pairedFocus(b, dk);
  return `<section class="flowcard" aria-label="Workout logging"><div class="flowtop"><span class="eyebrow">${blockLabel(b)} ${idx + 1} of ${blocks.length}</span><span class="tiny muted">${blockDoneCount(b, dk)} / ${blockTotalSets(b)} sets</span></div>${b.ex.length > 1 ? `<div class="superset-note">Alternate movements. Rest after both sets in a round.</div><div class="pair-tabs" aria-label="Superset movements">${b.ex.map((e, i) => `<button data-pair-focus="${dk}|${e.id}" aria-pressed="${focus === e.id}" class="${focus === e.id ? "on" : ""}"><small>${String.fromCharCode(65 + i)} · ${exDoneCount(dk, e.id)}/${e.sets}</small>${esc(EXERCISES[e.id].name)}</button>`).join("")}</div>` : ""}${exBlock(b.ex.find((e) => e.id === focus) || b.ex[0], dk)}<div class="flowactions"><button class="btn ghost" data-flow-step="-1" ${idx === 0 ? "disabled" : ""}>Previous</button><button class="btn primary" ${idx === blocks.length - 1 ? `data-finish-workout ${p.done ? "" : "disabled"}` : 'data-flow-step="1"'}>${idx === blocks.length - 1 ? "Finish & review" : "Next exercise"}${icon("arrow")}</button></div><p class="flowhint">Saved on this device as you type. W = warm-up; warm-ups don’t count toward working sets.</p></section>`;
}
function renderPlan() {
  const w = selectedWeek || Math.min(12, Math.max(1, todayPos().week));
  return `${heading("A plan that moves with you.", "Five sessions per cycle week. Adjust the dates to fit your life.")}<div class="card"><div class="section-row"><h3>${S.schedule.pausedAt ? "Plan paused" : "Your training rhythm"}</h3><button class="textlink" ${S.schedule.pausedAt ? "data-plan-resume" : "data-plan-pause"}>${S.schedule.pausedAt ? "Resume" : "Pause plan"}</button></div><label class="field-label" for="planWeek">Cycle week</label><select id="planWeek">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${w === i + 1 ? "selected" : ""}>Week ${i + 1} · ${PHASES[Math.floor(i / 4)].name}</option>`).join("")}</select><p class="note">${phaseDescription(Math.floor((w - 1) / 4))}</p></div><div class="plan-list">${SPLIT.map(
    (_, d) => {
      const p = planFor(w, d),
        dk = dayKey(w, d),
        m = S.sessions[dk] || {},
        progress = dayProgress(p);
      return `<button class="plan-session" data-open-day="${w}.${d}">${artwork(p, "small-art")}<span><small>${prettyISO(ymd(dateForPos(w, d)))}</small><b>${esc(p.title)}</b><small>${m.status === "skipped" ? "Skipped" : isWorkoutComplete(p) ? "Complete" : S.reviewed[dk] ? "Partial session saved" : progress.done ? `${progress.done} sets · in progress` : p.type === "rest" ? "Recovery" : `${progress.tot} working sets`}</small></span>${icon("arrow")}</button>`;
    },
  ).join(
    "",
  )}</div><details class="disclosure"><summary>Choose training days</summary><p>Move your unstarted workouts onto the days you choose. Completed sessions keep their dates.</p><fieldset class="weekday-options"><legend>Days available</legend>${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => `<label><input type="checkbox" name="trainingDay" value="${i}" ${S.preferences.weekdays.includes(i) ? "checked" : ""}>${day}</label>`).join("")}</fieldset><button class="btn ghost" data-save-days>Apply to upcoming workouts</button></details><details class="disclosure"><summary>Cycle dates & restart</summary>${scheduleCard()}</details>`;
}
function consistencyCard() {
  const week = weeklySummary(),
    history = allHistory();
  return `<section class="card"><div class="card-h"><h3>This week</h3><span class="pill">${week.completed} / ${S.preferences.weeklyTarget} complete</span></div><div class="consistency-days">${Array.from(
    { length: 7 },
    (_, i) => {
      const date = new Date(week.start + "T00:00");
      date.setDate(date.getDate() + i);
      const items = history.filter((h) => h.date === ymd(date)),
        complete = items.some((h) => h.complete);
      return `<div class="${complete ? "complete" : items.length ? "partial" : ""}" aria-label="${prettyISO(ymd(date))}: ${complete ? "complete workout" : items.length ? "partial workout" : "no workout"}"><small>${date.toLocaleDateString(undefined, { weekday: "short" })}</small><b>${complete ? "✓" : items.length ? "◐" : "·"}</b></div>`;
    },
  ).join(
    "",
  )}</div><p class="note">${week.partial} partial session${week.partial === 1 ? "" : "s"} also logged. Both count as showing up; only complete sessions fill your goal.</p></section>`;
}
function trendCard() {
  const ids = [
    ...new Set(allHistory().flatMap((h) => h.exercises.map((e) => e.id))),
  ];
  if (!ids.length)
    return '<section class="card"><h3>Your strength story starts here.</h3><p>Log working sets to see your best loads, reps, and progress for each exercise.</p></section>';
  if (!ids.includes(trendExercise)) trendExercise = ids[0];
  const data = performanceFor(trendExercise),
    recent = data.slice(-12),
    best = Math.max(...data.map((x) => x.weight)),
    reps = Math.max(...data.flatMap((x) => x.sets.map((s) => Number(s.r)))),
    bodyweight = best === 0,
    values = recent.map((x) =>
      bodyweight ? Math.max(...x.sets.map((s) => +s.r)) : x.weight,
    ),
    min = Math.min(...values),
    max = Math.max(...values),
    points = values
      .map(
        (v, i) =>
          `${20 + (i * 280) / Math.max(1, values.length - 1)},${110 - ((v - min) / Math.max(1, max - min)) * 80}`,
      )
      .join(" ");
  return `<section class="card"><label class="field-label" for="trendExercise">Exercise progress</label><select id="trendExercise">${ids.map((id) => `<option value="${id}" ${id === trendExercise ? "selected" : ""}>${esc(EXERCISES[id].name)}</option>`).join("")}</select><div class="statgrid"><div class="stat"><b class="v">${displayNumber(best)}</b><span class="k">Best ${S.unit} · ${esc(loadMeta(trendExercise).label)}</span></div><div class="stat"><b class="v">${reps}</b><span class="k">Most reps in one set</span></div></div>${
    recent.length > 1
      ? `<svg class="strength-chart" viewBox="0 0 320 135" role="img" aria-label="${bodyweight ? "Most reps" : "Heaviest working set"} across your last ${recent.length} sessions; values are listed below"><path d="M20 110H300" stroke="currentColor" opacity=".15"/><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3"/>${points
          .split(" ")
          .map((p) => {
            const [x, y] = p.split(",");
            return `<circle cx="${x}" cy="${y}" r="4" fill="currentColor"/>`;
          })
          .join("")}</svg>`
      : '<p class="trend-awaiting note">Log this exercise again to see your trend. Your first session is saved below.</p>'
  }<p class="note">${bodyweight ? "Most reps in a working set" : "Heaviest working set"} · last ${recent.length} sessions. Compare reps and setup alongside weight.</p><details class="disclosure"><summary>Session values & reps</summary>${recent
    .slice()
    .reverse()
    .map(
      (h) =>
        `<div class="entry-row"><span>${prettyISO(h.date)}</span><span>${h.sets.map((s) => `${displayNumber(convertedWeight(s.w, h.unit))} × ${s.r}`).join(", ")} ${S.unit}</span></div>`,
    )
    .join("")}</details></section>`;
}
function measurementsCard() {
  return `<details class="disclosure" ${S.preferences.focus === "bodyweight" ? "open" : ""}><summary>Body measurements<span class="tiny muted">Optional</span></summary><div class="weight-reading">${lastBW() ? displayNumber(lastBW()) : "—"} <small>${S.unit}</small></div>${weightChart()}<form class="inlineform" data-stats-bw-form><label><span class="field-label">Today’s weight (${S.unit})</span><input id="bwIn" inputmode="decimal" data-number="1" aria-label="Today’s bodyweight" required></label><button type="submit" class="btn primary sm">Save</button></form><h3>Body-fat measurement</h3><p class="note">Enter a value from a measurement you chose, such as a scan or scale. FitLab does not assume your sex, height, or calculate a percentage from unconfirmed measurements.</p><form class="inlineform" data-manual-bf><label><span class="field-label">Body fat (%)</span><input id="manualBF" inputmode="decimal" data-number="1" required></label><label><span class="field-label">Source (optional)</span><input id="bfSource" maxlength="80" placeholder="e.g. scan"></label><button type="submit" class="btn ghost sm">Save</button></form>${
    S.bf.length
      ? `<div class="entry-list">${S.bf
          .slice(-8)
          .reverse()
          .map(
            (m) =>
              `<div class="entry-row"><span>${prettyISO(m.d)}<small>${esc(m.source || "Earlier estimate · height not confirmed")}</small></span><b>${displayNumber(m.v)}%</b></div>`,
          )
          .join("")}</div>`
      : ""
  }</details>`;
}
function historyList(items) {
  return items
    .map(
      (h) =>
        `<button class="history-session" ${h.cycleId === "current" ? `data-open-day="${h.w}.${h.d}"` : `data-archive-session="${esc(h.cycleId)}|${h.dk}"`}><span><b>${esc(h.title)}</b><small>${prettyISO(h.date)} · ${esc(h.cycleLabel || "Current cycle")}</small></span><span><b>${h.done} sets</b><small>${h.complete ? "Complete" : h.finished ? "Partial" : "In progress"}</small></span>${icon("arrow")}</button>`,
    )
    .join("");
}
function renderStats() {
  const history = allHistory(),
    cards = {
      strength: trendCard,
      consistency: consistencyCard,
      bodyweight: measurementsCard,
    },
    first = S.preferences.focus;
  return `${heading("Progress you can feel.", "Your training, across every cycle.")}<div class="statgrid"><div class="stat"><div class="v">${history.filter((h) => h.complete).length}</div><div class="k">Complete sessions</div></div><div class="stat"><div class="v">${history.filter((h) => !h.complete).length}</div><div class="k">Partial / in progress</div></div><div class="stat"><div class="v">${history.reduce((n, h) => n + h.done, 0)}</div><div class="k">Working sets</div></div></div>${cards[first]()}${Object.keys(
    cards,
  )
    .filter((k) => k !== first)
    .map((k) => cards[k]())
    .join(
      "",
    )}<div class="section-row"><h3>Training history</h3><span class="tiny muted">${S.archives.length + 1} cycle${S.archives.length ? "s" : ""}</span></div><section class="card tight">${history.length ? historyList(history.slice(0, 8)) : '<p class="empty">Log a working set to begin your history.</p>'}${history.length > 8 ? `<details class="disclosure"><summary>Earlier sessions (${history.length - 8})</summary>${historyList(history.slice(8))}</details>` : ""}</section>${backupReminder()}`;
}
function reviewBreakdown(h) {
  return h.exercises
    .map((e) => {
      const sets = finishedSets(e.sets),
        prev = performanceFor(e.id).filter(
          (x) =>
            !(x.dk === h.dk && x.cycleId === h.cycleId) &&
            (x.date < h.date ||
              (x.date === h.date && (x.cycleId !== h.cycleId || x.n < h.n))),
        ),
        best = Math.max(0, ...sets.map((s) => convertedWeight(s.w, h.unit))),
        priorBest = Math.max(0, ...prev.map((x) => x.weight)),
        last = prev.at(-1),
        volume = sets.reduce(
          (n, s) =>
            n +
            convertedWeight(s.w, h.unit) * loadMeta(e.id).mult * Number(s.r),
          0,
        ),
        pr = prev.length && best > priorBest + 0.01;
      return `<div class="review-exercise"><img src="${exerciseImage(e.id)}" alt="${esc(EXERCISES[e.id].name)}" loading="lazy"><div><h3>${esc(EXERCISES[e.id].name)}</h3>${pr ? '<span class="pill">New best working weight</span>' : !prev.length ? '<span class="tiny muted">First recorded session</span>' : ""}<p>${e.sets.map((s) => `${s.kind === "warmup" ? "Warm-up · " : ""}${displayNumber(convertedWeight(s.w, h.unit))} ${S.unit} × ${s.r}`).join("<br>")}</p>${last && last.volume > 0 ? `<p class="comparison">${volume >= last.volume ? "+" : ""}${Math.round((volume / last.volume - 1) * 100)}% external load × reps vs ${prettyISO(last.date)} (${sets.length} vs ${last.sets.length} sets)</p>` : ""}${h.meta.notes?.[e.id] ? `<p class="note">${esc(h.meta.notes[e.id])}</p>` : ""}${h.meta.effort?.[e.id] ? `<p class="note">Felt ${esc(h.meta.effort[e.id] === "right" ? "about right" : h.meta.effort[e.id] === "hard" ? "too hard" : "easy")}</p>` : ""}</div></div>`;
    })
    .join("");
}
function renderReview() {
  if (!viewingPos) return renderStats();
  const dk = dayKey(viewingPos.week, viewingPos.dayIndex),
    h = allHistory().find((h) => h.cycleId === "current" && h.dk === dk);
  if (!h)
    return `${heading("Your session is ready.", "Complete a working set before reviewing.")}<button class="btn primary" data-go="day">Back to workout</button>`;
  const next = nextSession(),
    m = sessionFor(dk);
  return `${heading(h.complete ? "Session complete." : "Your work counts.", "Take a moment to see what you did.")}<section class="card reviewcard"><div class="card-h"><h2>${esc(h.title)}</h2><span class="pill">${h.complete ? "Complete" : "Partial session"}</span></div><p class="muted">${prettyISO(h.date)}</p><div class="statgrid"><div class="stat"><b class="v">${h.done}</b><span class="k">Working sets</span></div><div class="stat"><b class="v">${m.startedAt ? elapsedLabel(sessionElapsed(dk)) : "—"}</b><span class="k">${m.startedAt ? "Time training · pauses excluded" : "Time wasn’t recorded"}</span></div><div class="stat"><b class="v">${weeklySummary().completed}</b><span class="k">Complete this week</span></div></div>${reviewBreakdown(h)}</section><section class="card"><h3>Take into your next session</h3><p>Keep the setup consistent. Your next targets use your completed sets and effort feedback.</p>${h.exercises
    .filter((e) => finishedSets(e.sets).length)
    .slice(0, 3)
    .map((e) => {
      const sets = finishedSets(e.sets),
        hard = m.effort?.[e.id] === "hard";
      return `<p class="next-target"><b>${esc(EXERCISES[e.id].name)}</b><span>${esc(nextExerciseAdvice(e.id, dk))}</span></p>`;
    })
    .join(
      "",
    )}</section>${next ? `<div class="card next-session"><span class="eyebrow">Up next · ${prettyISO(ymd(dateForPos(next.week, next.dayIndex)))}</span><div class="training-main"><h2>${esc(next.title)}</h2>${artwork(next, "small-art")}</div><button class="btn ghost" data-open-day="${next.week}.${next.dayIndex}">Preview next session</button></div>` : ""}<button class="btn primary" data-go="today">Done for now</button><button class="textlink" data-go="day">Return to this workout</button><details class="disclosure"><summary>Export this session</summary>${workoutExportCard(planFor(h.w, h.d), dk, dayProgress(planFor(h.w, h.d)))}</details>`;
}
function renderArchive() {
  const [cycleId, dk] = (archiveSelection || "").split("|"),
    h = allHistory().find((h) => h.cycleId === cycleId && h.dk === dk);
  if (!h) return renderStats();
  return `${heading(h.title, `${h.cycleLabel} · ${prettyISO(h.date)}`)}<button class="backbtn" data-go="stats">${icon("back")}Back to progress</button><section class="card"><span class="pill">${h.complete ? "Complete" : "Partial session"} · archived</span><p>${h.done} working sets · ${h.meta.startedAt ? elapsedLabel(Math.floor((h.meta.elapsedMs || 0) / 1000)) : "Time not recorded"}</p>${reviewBreakdown(h)}</section><p class="note">This cycle is preserved as recorded. Full backups include every archived cycle.</p>`;
}
function renderMore() {
  let hasBackup = false;
  try {
    hasBackup = !!localStorage.getItem(BACKUP_KEY);
  } catch {}
  return `${heading("Make it yours.", "Choose what helps you keep training.")}<section class="card"><div class="settingsrow"><b>Appearance</b><div class="seg">${["light", "dark", "auto"].map((x) => `<button data-theme="${x}" class="${S.theme === x ? "on" : ""}">${cap(x)}</button>`).join("")}</div></div><div class="settingsrow"><b>Weight unit</b><div class="seg">${["lb", "kg"].map((x) => `<button data-unit="${x}" class="${S.unit === x ? "on" : ""}">${x}</button>`).join("")}</div></div><label class="field-label" for="progressFocus">Show first in Progress</label><select id="progressFocus">${[
    ["strength", "Exercise strength"],
    ["consistency", "Weekly consistency"],
    ["bodyweight", "Body measurements"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${S.preferences.focus === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select><label class="field-label" for="weeklyTarget">Your weekly session goal</label><input id="weeklyTarget" type="number" min="1" max="7" value="${S.preferences.weeklyTarget}"></section>
  <details class="disclosure"><summary>Your daily habits<span class="tiny muted">Personal targets</span></summary><p class="note">Enable what you want to track. Targets are optional and chosen by you.</p><form data-habit-settings>${Object.entries(
    HABITS,
  )
    .map(
      ([id, h]) =>
        `<div class="habit-setting"><label><input type="checkbox" name="${id}Enabled" ${S.preferences.habits[id].enabled ? "checked" : ""}>${h.name}</label><label><span class="field-label">Target (${h.unit})</span><input name="${id}Target" inputmode="decimal" placeholder="Optional" value="${S.preferences.habits[id].target ?? ""}"></label></div>`,
    )
    .join(
      "",
    )}<button class="btn primary sm">Save habits</button></form></details>
  <section class="card tight"><button class="menurow" data-go="library">${icon("book")}<span><b>Exercise library</b><small>Movement photos and quick cues</small></span>${icon("arrow")}</button><button class="menurow" data-go="guide">${icon("leaf")}<span><b>Your training companion</b><small>How your plan, timer and history work</small></span>${icon("arrow")}</button></section>
  <details class="disclosure"><summary>At the gym & offline</summary><p class="status-line">${navigator.onLine === false ? "You’re offline" : offlineReady ? "App ready for offline use" : "Online · offline setup pending"}</p><p class="note">The workout log and session illustrations work offline once setup completes. Exercise photos are saved when opened; videos require internet.</p><button class="btn ghost sm" data-cache-photos>Save all exercise photos offline</button><p id="photoCacheStatus" role="status"></p><label class="toggle-setting"><input type="checkbox" data-pref="keepAwake" ${S.preferences.keepAwake ? "checked" : ""}>Keep the screen awake during a session</label><p class="note">${"wakeLock" in navigator ? "Supported by this browser while FitLab is visible." : "This browser does not support screen wake lock."}</p><label class="toggle-setting"><input type="checkbox" data-pref="sound" ${S.preferences.sound ? "checked" : ""}>Play a sound when rest ends</label><p class="note">Sound and vibration depend on your device. Background or locked screens may delay alerts; the remaining rest time still updates when you return.</p>${installPrompt ? '<button class="btn primary" data-install>Install FitLab</button>' : "<p>To add FitLab to your phone: in Safari use Share → Add to Home Screen; in Chrome use the menu → Install app / Add to Home screen.</p>"}</details>
  <details class="disclosure"><summary>Program settings<span class="tiny muted">12 weeks</span></summary>${scheduleCard()}</details><details class="disclosure"><summary>Your data & backups</summary><p>Saved on this device. Full backups include every cycle, your notes, preferences and measurements.</p><p><b>Last backup requested:</b> ${S.backupAt ? esc(new Date(S.backupAt).toLocaleString()) : "Not yet"}</p><p class="note">Check that the downloaded file is saved. FitLab cannot confirm that you kept it.</p><div class="exportactions"><button class="btn primary sm" data-backup>Download full backup</button><button class="btn ghost sm" data-restore>Restore a backup</button>${hasBackup ? '<button class="btn ghost sm" data-recovery-backup>Download recovery copy</button>' : ""}</div></details>${backupReminder()}<div class="local-note">${icon("shield")}<span>No account needed. Back up before changing phones or clearing browser data.</span></div><p class="footer-signature">FITLAB · VERSION 13.2.2</p>`;
}
function calcBF() {
  toast("Use Body measurements to enter a measured body-fat percentage.");
}
let audioContext = null;
const restSoundNodes = new Set();
let restSoundGeneration = 0;
function restSoundLabel() {
  if (!S.preferences.sound) return "Sound off";
  if (!(window.AudioContext || window.webkitAudioContext))
    return "Sound unavailable";
  return audioContext?.state === "running" ? "Sound on" : "Enable sound";
}
function refreshSoundControls() {
  for (const el of document.querySelectorAll('[data-pref="sound"]'))
    el.checked = S.preferences.sound;
  for (const el of document.querySelectorAll("[data-rest-sound]")) {
    el.textContent = restSoundLabel();
    el.setAttribute(
      "aria-pressed",
      String(S.preferences.sound && audioContext?.state === "running"),
    );
  }
  for (const el of document.querySelectorAll("[data-test-rest-sound]"))
    el.textContent = S.preferences.sound ? "Test sound" : "Enable & test sound";
}
async function armSound() {
  if (!S.preferences.sound) return false;
  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.onstatechange = refreshSoundControls;
    }
    if (audioContext.state !== "running") await audioContext.resume();
    refreshSoundControls();
    return audioContext.state === "running";
  } catch {
    refreshSoundControls();
    return false;
  }
}
function stopRestSound() {
  restSoundGeneration++;
  for (const osc of restSoundNodes) {
    try {
      osc.stop();
    } catch {}
  }
  restSoundNodes.clear();
}
async function playRestSound(restId = null) {
  if (!S.preferences.sound || !audioContext) return false;
  const generation = restSoundGeneration;
  try {
    if (audioContext.state !== "running") await audioContext.resume();
    if (
      generation !== restSoundGeneration ||
      !S.preferences.sound ||
      audioContext.state !== "running" ||
      (restId && S.restReady?.id !== restId)
    )
      return false;
    // Three distinct tones, with short gaps, are easier to notice than one click.
    [660, 880, 1046].forEach((frequency, i) => {
      const osc = audioContext.createOscillator(),
        gain = audioContext.createGain(),
        at = audioContext.currentTime + i * 0.35;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.27);
      restSoundNodes.add(osc);
      osc.onended = () => {
        restSoundNodes.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(at);
      osc.stop(at + 0.28);
    });
    return true;
  } catch {
    return false;
  }
}
async function testRestSound() {
  S.preferences.sound = true;
  save();
  stopRestSound();
  if ((await armSound()) && (await playRestSound()))
    toast(
      "Test chime played. If silent, check media volume or your headphones.",
    );
  else
    toast(
      "Sound is unavailable right now. The rest-complete message will still appear.",
    );
  refreshSoundControls();
}
async function toggleRestSound() {
  if (S.preferences.sound && audioContext?.state === "running") {
    S.preferences.sound = false;
    stopRestSound();
  } else {
    S.preferences.sound = true;
    if (!(await armSound()))
      toast("Sound is unavailable right now. The on-screen alert stays on.");
  }
  save();
  refreshSoundControls();
}
async function requestWakeLock() {
  if (
    !S.preferences.keepAwake ||
    !navigator.wakeLock ||
    document.visibilityState === "hidden"
  )
    return;
  try {
    if (!wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => (wakeLock = null));
  } catch {}
}
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}
async function cacheExercisePhotos() {
  const output = $("#photoCacheStatus");
  if (!("caches" in window)) {
    if (output)
      output.textContent =
        "Offline photo storage is unavailable in this browser.";
    return;
  }
  const urls = [...new Set(Object.values(EXERCISES).flatMap((x) => x.images))],
    cache = await caches.open("fitlab-img-v2");
  let saved = 0,
    failed = 0;
  for (const url of urls) {
    try {
      let response = await cache.match(url);
      if (!response) {
        response = await fetch(url);
        if (!response.ok) throw new Error();
        await cache.put(url, response.clone());
      }
      saved++;
    } catch {
      failed++;
    }
    if (output?.isConnected)
      output.textContent = `Saved ${saved} of ${urls.length} photos${failed ? ` · ${failed} unavailable; retry when online` : ""}.`;
  }
}
function bootCompanion() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    if (view === "more") render();
  });
  window.addEventListener("online", () => {
    if (view === "more") render();
  });
  window.addEventListener("offline", () => {
    if (view === "more") render();
  });
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      Object.values(S.sessions).some((m) => m.runningSince)
    )
      requestWakeLock();
  });
  setInterval(() => {
    for (const el of document.querySelectorAll("[data-session-clock]"))
      el.textContent = elapsedLabel(sessionElapsed(el.dataset.sessionClock));
  }, 1000);
  document.addEventListener("click", async (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    const c = (s) => t.closest(s);
    if (!c("[data-rest-sound], [data-test-rest-sound]")) armSound();
    let el;
    if (c("[data-rest-sound]")) {
      await toggleRestSound();
    } else if (c("[data-test-rest-sound]")) {
      await testRestSound();
    } else if ((el = c("[data-warmup-expand]"))) {
      const dk = el.dataset.warmupExpand,
        m = sessionFor(dk),
        n = dayNum(dk);
      m.warmupExpanded = !(
        m.warmupExpanded ??
        dayProgress(planFor(Math.floor(n / 7) + 1, n % 7)).done === 0
      );
      save();
      render();
    } else if ((el = c("[data-warmup-check]"))) {
      const [dk, id] = el.dataset.warmupCheck.split("|"),
        m = sessionFor(dk);
      if (!m.warmupPrep?.[id] && !m.startedAt && !startSession(dk)) return;
      (m.warmupPrep ??= {})[id] = !m.warmupPrep[id];
      save();
      render();
      document
        .querySelector(`[data-warmup-check="${dk}|${id}"]`)
        ?.focus({ preventScroll: true });
    } else if ((el = c("[data-practice-sets]")))
      addPracticeSets(...el.dataset.practiceSets.split("|"));
    else if ((el = c("[data-pause-session]")))
      pauseSession(el.dataset.pauseSession);
    else if ((el = c("[data-resume-session]"))) {
      if (startSession(el.dataset.resumeSession)) render();
    } else if (c("[data-plan-pause]")) pausePlan();
    else if (c("[data-plan-resume]")) resumePlan();
    else if ((el = c("[data-move-session]")))
      moveSession(el.dataset.moveSession, $("#moveDate").value);
    else if ((el = c("[data-skip-session]"))) {
      const m = sessionFor(el.dataset.skipSession);
      if (m.status === "skipped") {
        delete m.status;
        save();
        render();
      } else skipSession(el.dataset.skipSession);
    } else if ((el = c("[data-shorten]")))
      shortSession(el.dataset.shorten, Number($("#sessionLength").value));
    else if ((el = c("[data-move-block]"))) {
      const [dk, b, step] = el.dataset.moveBlock.split("|");
      moveBlock(dk, b, Number(step));
    } else if ((el = c("[data-add-exercise]")))
      addExercise(el.dataset.addExercise, $("#addExercise").value);
    else if ((el = c("[data-add-set]")))
      addSet(...el.dataset.addSet.split("|"));
    else if ((el = c("[data-remove-set]"))) {
      const [dk, id, index] = el.dataset.removeSet.split("|");
      removeSet(dk, id, Number(index));
    } else if ((el = c("[data-omit-exercise]")))
      omitExercise(...el.dataset.omitExercise.split("|"));
    else if ((el = c("[data-effort]"))) {
      const [dk, id, effort] = el.dataset.effort.split("|");
      (sessionFor(dk).effort ??= {})[id] = effort;
      save();
      for (const b of el.parentElement.querySelectorAll("button")) {
        const on = b === el;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on);
      }
    } else if ((el = c("[data-increment]"))) {
      const value = entryNumber($("#increment").value);
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        toast("Enter an increment greater than 0, up to 100.");
        return;
      }
      S.preferences.increments[el.dataset.increment] = { value, unit: S.unit };
      save();
      toast("Weight increment saved.");
    } else if ((el = c("[data-pair-focus]"))) {
      const [dk, id] = el.dataset.pairFocus.split("|");
      sessionFor(dk).pairFocus = id;
      save();
      render();
    } else if (c("[data-save-days]")) {
      const days = [
        ...document.querySelectorAll('[name="trainingDay"]:checked'),
      ].map((el) => +el.value);
      if (!days.length) {
        toast("Choose at least one training day.");
        return;
      }
      S.preferences.weekdays = days;
      applyTrainingDays();
      save();
      render();
      toast("Upcoming workouts moved to your chosen days.");
    } else if ((el = c("[data-archive-session]"))) {
      archiveSelection = el.dataset.archiveSession;
      go("archive");
    } else if (c("[data-cache-photos]")) {
      event.target.disabled = true;
      try {
        await cacheExercisePhotos();
      } catch {
        toast("Photos could not be saved. Check connection and storage.");
      }
      event.target.disabled = false;
    } else if (c("[data-install]") && installPrompt) {
      await installPrompt.prompt();
      installPrompt = null;
      render();
    }
  });
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el.dataset.exerciseNote) {
      const [dk, id] = el.dataset.exerciseNote.split("|");
      (sessionFor(dk).notes ??= {})[id] = el.value.slice(0, 500);
      save();
    }
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el.id === "trendExercise") {
      trendExercise = el.value;
      render();
    } else if (el.id === "progressFocus") {
      S.preferences.focus = el.value;
      save();
    } else if (el.id === "weeklyTarget") {
      const n = Number(el.value);
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        el.value = S.preferences.weeklyTarget;
        toast("Choose 1 to 7 sessions.");
        return;
      }
      S.preferences.weeklyTarget = n;
      save();
    } else if (el.dataset.pref) {
      S.preferences[el.dataset.pref] = el.checked;
      save();
      if (el.dataset.pref === "sound") {
        if (el.checked) armSound();
        else stopRestSound();
        refreshSoundControls();
      } else if (
        el.checked &&
        Object.values(S.sessions).some((m) => m.runningSince)
      )
        requestWakeLock();
      else releaseWakeLock();
    }
  });
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form.matches("[data-habit-settings]")) {
      event.preventDefault();
      const next = {};
      for (const id of Object.keys(HABITS)) {
        const raw = form.elements[id + "Target"].value,
          target = raw.trim() ? entryNumber(raw) : null;
        if (target !== null && (!Number.isFinite(target) || target <= 0)) {
          toast("Targets must be positive numbers, or left blank.");
          return;
        }
        next[id] = { enabled: form.elements[id + "Enabled"].checked, target };
      }
      S.preferences.habits = next;
      save();
      toast("Your habits are saved.");
    } else if (form.matches("[data-manual-bf]")) {
      event.preventDefault();
      const value = entryNumber($("#manualBF").value);
      if (!Number.isFinite(value) || value < 1 || value > 70) {
        toast("Enter a measured percentage between 1 and 70.");
        return;
      }
      if (upsertMeasurement("bf", todayISO(), value)) {
        S.bf.find((x) => x.d === todayISO()).source =
          $("#bfSource").value.trim().slice(0, 80) || "Manual measurement";
        save();
        render();
        toast("Body-fat measurement saved.");
      }
    }
  });
}
const QUICK_CUES = {
  Pushups: [
    "Keep a steady line from shoulders to heels.",
    "Lower your chest with control.",
    "Press up without letting your hips sag.",
  ],
  Dumbbell_Flyes: [
    "Keep your back supported and a soft bend in your elbows.",
    "Open your arms through a comfortable range.",
    "Bring the dumbbells together with control; avoid stretching too deep.",
  ],
  "Barbell_Bench_Press_-_Medium_Grip": [
    "Plant your feet and keep your upper back supported.",
    "Lower the bar toward mid-chest with control.",
    "Press back up; use a spotter or safety arms when needed.",
  ],
  Incline_Dumbbell_Press: [
    "Keep your back supported on the incline.",
    "Lower both dumbbells under control.",
    "Press upward without bouncing or letting the weights collide.",
  ],
  Dumbbell_Bench_Press: [
    "Keep your feet planted and back supported.",
    "Lower with forearms roughly upright.",
    "Press both dumbbells smoothly; log each dumbbell’s weight.",
  ],
  Standing_Military_Press: [
    "Brace your trunk and keep the bar close.",
    "Press overhead without leaning far back.",
    "Lower the bar under control.",
  ],
  Dumbbell_Shoulder_Press: [
    "Start with the dumbbells beside your shoulders.",
    "Keep your trunk steady as you press overhead.",
    "Lower both weights with control.",
  ],
  Seated_Dumbbell_Press: [
    "Use the bench to support your back.",
    "Press the dumbbells above your shoulders.",
    "Lower smoothly without arching excessively.",
  ],
  Side_Lateral_Raise: [
    "Keep a soft bend in your elbows.",
    "Raise out to the sides toward shoulder height.",
    "Lower slowly; avoid swinging your body.",
  ],
  Cable_Crossover: [
    "Stand with a steady stance and soft elbows.",
    "Bring your hands together in front of your chest.",
    "Let your arms return under control.",
  ],
  Triceps_Pushdown: [
    "Keep your elbows near your sides.",
    "Extend your elbows without swinging your torso.",
    "Return the handle slowly.",
  ],
  "Dips_-_Triceps_Version": [
    "Support yourself with your shoulders controlled.",
    "Lower through a comfortable range.",
    "Press back up without bouncing.",
  ],
  Standing_Dumbbell_Triceps_Extension: [
    "Hold one dumbbell securely overhead.",
    "Bend your elbows to lower it behind your head.",
    "Extend your elbows while keeping your trunk steady.",
  ],
  Barbell_Deadlift: [
    "Keep the bar close to your shins.",
    "Brace before lifting; push through the floor.",
    "Stand tall, then lower with control.",
  ],
  Romanian_Deadlift: [
    "Keep a soft bend in your knees.",
    "Send your hips back with the bar close to your legs.",
    "Stand by bringing your hips forward; avoid leaning back.",
  ],
  Pullups: [
    "Begin from a controlled hang.",
    "Pull your elbows down toward your sides.",
    "Lower under control; record assistance in notes.",
  ],
  "Wide-Grip_Lat_Pulldown": [
    "Sit tall with your thighs supported.",
    "Pull the bar toward your upper chest.",
    "Let the bar rise slowly without rocking your torso.",
  ],
  Bent_Over_Barbell_Row: [
    "Hinge at the hips and brace your trunk.",
    "Row the bar toward your lower ribs.",
    "Lower with control while keeping your position.",
  ],
  Seated_Cable_Rows: [
    "Keep a stable, upright torso.",
    "Draw the handle toward your lower ribs.",
    "Return slowly without rounding or swinging.",
  ],
  Face_Pull: [
    "Set the cable around upper-chest or face height.",
    "Pull the rope toward your face with elbows out.",
    "Return with control and keep your neck relaxed.",
  ],
  Barbell_Curl: [
    "Keep elbows near your sides.",
    "Curl without leaning back or swinging.",
    "Lower the bar slowly.",
  ],
  Hammer_Curls: [
    "Keep your palms facing inward.",
    "Curl while keeping your upper arms steady.",
    "Lower slowly; log the weight of one dumbbell.",
  ],
  Barbell_Squat: [
    "Set the rack safeties and brace your trunk.",
    "Bend hips and knees through a comfortable range.",
    "Stand with your whole foot planted.",
  ],
  Front_Barbell_Squat: [
    "Support the bar on the front of your shoulders.",
    "Keep elbows up as you bend hips and knees.",
    "Stand with control and maintain your brace.",
  ],
  Hack_Squat: [
    "Keep your back supported on the pad.",
    "Lower through a comfortable range.",
    "Press through your feet without bouncing.",
  ],
  Leg_Press: [
    "Keep your hips and back against the pad.",
    "Lower only as far as you can maintain that support.",
    "Press smoothly without snapping your knees straight.",
  ],
  Lying_Leg_Curls: [
    "Line up the machine with your knees.",
    "Curl your heels toward you without lifting your hips.",
    "Lower the pad slowly.",
  ],
  Leg_Extensions: [
    "Align your knees with the machine pivot.",
    "Extend your legs with control.",
    "Lower slowly without dropping the weight stack.",
  ],
  Standing_Calf_Raises: [
    "Keep your balance and knees softly extended.",
    "Rise onto the balls of your feet.",
    "Lower your heels slowly through a comfortable range.",
  ],
  Dumbbell_Lunges: [
    "Use a stable stance and hold the weights at your sides.",
    "Step into the lunge under control.",
    "Push back to standing; log reps per leg.",
  ],
  Barbell_Hip_Thrust: [
    "Support your upper back on a stable bench.",
    "Drive through your feet to lift your hips.",
    "Finish with your trunk controlled; avoid over-arching.",
  ],
  Hanging_Leg_Raise: [
    "Start from a stable hang.",
    "Raise your legs without swinging.",
    "Lower slowly and reset before the next rep.",
  ],
  Cable_Crunch: [
    "Hold the rope near your head.",
    "Bring your ribs toward your pelvis.",
    "Return slowly without pulling with your arms.",
  ],
  Plank: [
    "Keep elbows under your shoulders.",
    "Brace your trunk and keep a steady body line.",
    "Breathe normally; log hold duration in seconds.",
  ],
  Russian_Twist: [
    "Keep your trunk controlled.",
    "Rotate through a comfortable range without rushing.",
    "Use a load that lets you avoid jerking your back.",
  ],
};
function quickCues(id) {
  return (
    QUICK_CUES[id] ||
    EXERCISES[id].instructions.slice(0, 3).map((s) => s.split(". ")[0] + ".")
  );
}

function exerciseImage(id) {
  return EXERCISES[id].images[id === "Plank" ? 1 : 0];
}

function nextExerciseAdvice(id, dk) {
  for (let n = dayNum(dk) + 1; n < 84; n++) {
    const p = planFor(Math.floor(n / 7) + 1, n % 7),
      key = dayKey(p.week, p.dayIndex),
      e = workoutExercises(p, key).find((e) => e.id === id);
    if (e && !sessionHandled(p)) {
      const target = suggest(id, e, key);
      return `${blank(target.weight) ? "Choose a controlled load" : `${displayNumber(target.weight)} ${S.unit} ${loadMeta(id).label}`} · ${target.reps || e.reps} ${id === "Plank" ? "seconds" : "reps"}. ${target.note}`;
    }
  }
  return "This movement has no remaining session in this cycle. Your completed sets and effort feedback will guide it in the next cycle.";
}

function setAccessibleName(name, sets, index) {
  const warm = sets[index].kind === "warmup",
    number = sets
      .slice(0, index + 1)
      .filter((s) => (s.kind === "warmup") === warm).length;
  return `${name} ${warm ? "warm-up" : "set"} ${number}`;
}

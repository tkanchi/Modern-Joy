/* =========================================================
   Scrummer XP (v1)
   - Works with or without metrics.js
   - Reads setup from:
       1) window.Scrummer.setup.loadSetup()
       2) localStorage "scrummer_setup_v1"
   - Computes signals using:
       1) window.Scrummer.computeSignals()
       2) fallback compute (internal)
   - Awards XP once per day (anti-spam)
   - Streak increments when sprint looks "stable"
   ========================================================= */

(function () {
  const SETUP_KEY = "scrummer_setup_v1";
  const XP_KEY = "scrummer_xp_v1";

  const LEVEL_SIZE = 300; // XP per level
  const LEVEL_TITLES = [
    "Rookie",
    "Sprint Scout",
    "Sprint Runner",
    "Velocity Cheetah",
    "Scrum Legend",
    "Agile Mythic"
  ];

  const el = (id) => document.getElementById(id);

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function loadSetupUnified() {
    const api = window.Scrummer && window.Scrummer.setup;
    if (api && typeof api.loadSetup === "function") {
      try { return api.loadSetup() || {}; } catch {}
    }
    return safeJsonParse(localStorage.getItem(SETUP_KEY) || "{}", {});
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // Fallback computeSignals (simple but consistent)
  function computeFallback(setup) {
    const sprintDays = num(setup.sprintDays) ?? 0;
    const teamMembers = num(setup.teamMembers) ?? 0;
    const leaveDays = num(setup.leaveDays) ?? 0;
    const committedSP = num(setup.committedSP) ?? 0;

    const v1 = num(setup.v1) ?? 0;
    const v2 = num(setup.v2) ?? 0;
    const v3 = num(setup.v3) ?? 0;

    const velocities = [v1, v2, v3].filter(x => x > 0);
    const avgVel = velocities.length
      ? velocities.reduce((a,b)=>a+b,0) / velocities.length
      : 0;

    // volatility = std/mean
    let vol = 0;
    if (velocities.length >= 2 && avgVel > 0) {
      const variance = velocities.reduce((acc,x)=>acc + Math.pow(x - avgVel, 2), 0) / velocities.length;
      vol = Math.sqrt(variance) / avgVel;
    }

    // capacity estimate adjusted by leave ratio
    const teamDays = Math.max(1, sprintDays * Math.max(1, teamMembers));
    const leaveRatio = Math.min(0.6, Math.max(0, leaveDays / teamDays));
    const capacitySP = avgVel * (1 - leaveRatio);

    const overcommitRatio = capacitySP > 0 ? committedSP / capacitySP : 0;

    // Risk heuristic (0-100)
    let risk = 0;
    if (committedSP <= 0 || avgVel <= 0) risk += 30;
    if (overcommitRatio > 1) risk += Math.min(50, (overcommitRatio - 1) * 120);
    risk += Math.min(30, vol * 80);
    risk = Math.max(0, Math.min(100, Math.round(risk)));

    const confidence = Math.max(10, Math.min(95, Math.round(100 - risk)));

    return {
      riskScore: risk,
      confidence,
      capacitySP,
      overcommitRatio,
      vol
    };
  }

  function computeSignalsUnified(setup) {
    const compute = window.Scrummer && window.Scrummer.computeSignals;
    if (typeof compute === "function") {
      try {
        const s = compute(setup || {});
        if (s && (s.riskScore !== undefined || s.confidence !== undefined)) return s;
      } catch {}
    }
    return computeFallback(setup || {});
  }

  function loadXpState() {
    const s = safeJsonParse(localStorage.getItem(XP_KEY) || "{}", {});
    return {
      totalXp: Number.isFinite(Number(s.totalXp)) ? Number(s.totalXp) : 0,
      streak: Number.isFinite(Number(s.streak)) ? Number(s.streak) : 0,
      bestStreak: Number.isFinite(Number(s.bestStreak)) ? Number(s.bestStreak) : 0,
      lastAwardDay: typeof s.lastAwardDay === "string" ? s.lastAwardDay : "",
      lastMetrics: s.lastMetrics && typeof s.lastMetrics === "object" ? s.lastMetrics : null
    };
  }

  function saveXpState(state) {
    localStorage.setItem(XP_KEY, JSON.stringify(state));
  }

  function levelInfo(totalXp) {
    const lvl = Math.floor(totalXp / LEVEL_SIZE) + 1;
    const inLevel = totalXp % LEVEL_SIZE;
    const title = LEVEL_TITLES[Math.min(lvl - 1, LEVEL_TITLES.length - 1)];
    return { lvl, inLevel, next: LEVEL_SIZE, title };
  }

  // Stable condition for streak
  function isStable(metrics) {
    const risk = Number(metrics.riskScore);
    const conf = Number(metrics.confidence);
    const over = Number(metrics.overcommitRatio);
    if (!Number.isFinite(risk) || !Number.isFinite(conf)) return false;

    const okRisk = risk < 40;
    const okConf = conf >= 70;
    const okOver = !Number.isFinite(over) ? true : over <= 1.0;

    return okRisk && okConf && okOver;
  }

  function awardXpOncePerDay(state, metrics) {
    const day = todayKey();
    if (state.lastAwardDay === day) {
      // No XP farming today.
      return { gained: 0, reasons: [] };
    }

    const reasons = [];
    let gained = 0;

    const risk = Number(metrics.riskScore);
    const conf = Number(metrics.confidence);
    const over = Number(metrics.overcommitRatio);
    const vol = Number(metrics.vol);

    // Base daily check-in XP if setup exists
    const hasSomeData = Number.isFinite(risk) || Number.isFinite(conf);
    if (hasSomeData) {
      gained += 5;
      reasons.push("+5 Daily check-in");
    }

    // Reward “good state”
    if (Number.isFinite(conf) && conf >= 75) { gained += 15; reasons.push("+15 Confidence ≥ 75"); }
    if (Number.isFinite(over) && over > 0 && over <= 1) { gained += 25; reasons.push("+25 No overcommit"); }
    if (Number.isFinite(vol) && vol > 0 && vol < 0.30) { gained += 10; reasons.push("+10 Low volatility"); }

    // Reward improvement vs last snapshot (if we have one)
    if (state.lastMetrics && Number.isFinite(Number(state.lastMetrics.riskScore)) && Number.isFinite(risk)) {
      const prevRisk = Number(state.lastMetrics.riskScore);
      if (prevRisk - risk >= 5) { gained += 20; reasons.push("+20 Risk improved"); }
    }

    // Streak logic
    if (isStable(metrics)) {
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      gained += 10;
      reasons.push("+10 Stable streak day");
    } else {
      state.streak = 0;
      reasons.push("Streak reset (not stable)");
    }

    state.totalXp += gained;
    state.lastAwardDay = day;
    state.lastMetrics = {
      riskScore: Number.isFinite(risk) ? risk : null,
      confidence: Number.isFinite(conf) ? conf : null,
      overcommitRatio: Number.isFinite(over) ? over : null,
      vol: Number.isFinite(vol) ? vol : null
    };

    return { gained, reasons };
  }

  function renderWidget(state) {
    const info = levelInfo(state.totalXp);

    const levelEl = el("xpLevel");
    const titleEl = el("xpTitle");
    const fillEl = el("xpFill");
    const textEl = el("xpText");
    const streakEl = el("streakText");

    if (levelEl) levelEl.textContent = `Level ${info.lvl}`;
    if (titleEl) titleEl.textContent = info.title;

    const pct = Math.round((info.inLevel / info.next) * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (textEl) textEl.textContent = `${info.inLevel} / ${info.next} XP`;

    if (streakEl) {
      streakEl.textContent = state.streak > 0
        ? `🔥 ${state.streak} sprint-stable streak`
        : `🧊 streak reset`;
    }
  }

  function init() {
    // If widget not present on page, do nothing.
    if (!el("xpLevel") && !el("xpFill") && !el("xpText")) return;

    const setup = loadSetupUnified();
    const metrics = computeSignalsUnified(setup);

    const state = loadXpState();
    awardXpOncePerDay(state, metrics);
    saveXpState(state);
    renderWidget(state);
  }

  // Expose for debugging if needed
  window.ScrummerXP = { init };

  // Auto-init
  document.addEventListener("DOMContentLoaded", init);
})();
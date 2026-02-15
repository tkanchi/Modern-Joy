/**
 * SCRUMMER — Metrics Engine
 * Logic for calculating Risk, Confidence, and Capacity Health.
 */

(() => {
  const STORAGE_KEY = "scrummer-setup-v1";
  const SNAP_KEY = "scrummer-snapshots-v1";

  // --- Math Helpers ---
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const mean = (arr) => {
    const a = arr.filter(n => Number.isFinite(n) && n > 0);
    return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  };

  const stdev = (arr) => {
    const a = arr.filter(n => Number.isFinite(n) && n > 0);
    if (a.length < 2) return 0;
    const m = mean(a);
    const v = a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);
    return Math.sqrt(v);
  };

  // --- Storage API ---
  const loadSetup = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const saveSetup = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  /**
   * 🧮 Compute Signals
   * The core "SaaS Brain" that determines if a sprint is risky.
   */
  function computeSignals(setup) {
    const sprintDays = safeNum(setup.sprintDays);
    const teamMembers = safeNum(setup.teamMembers);
    const leaveDays = safeNum(setup.leaveDays);
    const committed = safeNum(setup.committedSP);

    const velocities = [safeNum(setup.v1), safeNum(setup.v2), safeNum(setup.v3)].filter(v => v > 0);
    const avgVelocity = mean(velocities);
    const vol = avgVelocity > 0 ? (stdev(velocities) / avgVelocity) : 0;

    // --- Capacity Logic ---
    // Ideal Capacity: Total person-days available in a perfect world.
    const idealPD = sprintDays * teamMembers;
    // Available Capacity: Adjusted for holidays and leave.
    const availablePD = Math.max(0, idealPD - leaveDays);
    const availabilityRatio = idealPD > 0 ? (availablePD / idealPD) : 0;

    // Effective Capacity in Story Points:
    // This scales historical performance against current availability.
    const capacitySP = avgVelocity > 0 ? (avgVelocity * availabilityRatio) : 0;

    // --- Ratios & Signals ---
    const overcommitRatio = avgVelocity > 0 ? (committed / avgVelocity) : 0;
    const capacityShortfallRatio = capacitySP > 0 ? (committed / capacitySP) : 0;
    const focusFactor = availabilityRatio; // Available time vs Total time

    // --- Risk Scoring (0-100) ---
    // 1. Overcommit (Weight 50%): Penalty for planning more than average performance.
    const overPenalty = clamp((overcommitRatio - 1) * 60, 0, 50);
    // 2. Capacity (Weight 35%): Penalty for planning more than availability allows.
    const capPenalty = clamp((capacityShortfallRatio - 1) * 50, 0, 35);
    // 3. Volatility (Weight 15%): Penalty for unstable performance history.
    const volPenalty = clamp(vol * 30, 0, 15);

    const riskScore = clamp(overPenalty + capPenalty + volPenalty, 0, 100);

    // --- Confidence Calculation ---
    const baseConf = committed > 0 ? (capacitySP / committed) * 100 : 0;
    const confidence = clamp(baseConf - (volPenalty * 2), 0, 100);

    // --- Labels ---
    let capacityHealth = "—";
    if (committed > 0 && capacitySP > 0) {
      const ratio = capacitySP / committed;
      if (ratio >= 1.0) capacityHealth = "Healthy";
      else if (ratio >= 0.85) capacityHealth = "At Risk";
      else capacityHealth = "Critical";
    }

    const riskBand = riskScore <= 30 ? "Low" : (riskScore <= 60 ? "Moderate" : "High");

    return {
      sprintDays, teamMembers, leaveDays, committed,
      velocities, avgVelocity, idealPD, availablePD, availabilityRatio,
      capacitySP, overcommitRatio, capacityShortfallRatio, focusFactor, vol,
      riskScore, riskBand, confidence, capacityHealth,
      components: { over: overPenalty, cap: capPenalty, vola: volPenalty }
    };
  }

  // --- Snapshot Management ---
  const loadSnapshots = () => {
    try {
      const raw = localStorage.getItem(SNAP_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  };

  const saveSnapshots = (arr) => localStorage.setItem(SNAP_KEY, JSON.stringify(arr));

  const addSnapshot = (snapshot) => {
    const arr = loadSnapshots();
    arr.unshift(snapshot);
    saveSnapshots(arr.slice(0, 30));
    return arr;
  };

  const makeSnapshot = (signals) => ({
    id: `${Date.now()}`,
    ts: new Date().toISOString(),
    committed: signals.committed || 0,
    avgVelocity: signals.avgVelocity || 0,
    capacitySP: signals.capacitySP || 0,
    focusFactor: signals.focusFactor || 0,
    riskScore: signals.riskScore || 0,
    riskBand: signals.riskBand || "—",
    confidence: signals.confidence || 0,
    capacityHealth: signals.capacityHealth || "—",
    vol: signals.vol || 0
  });

  // --- Expose Global API ---
  window.Scrummer = window.Scrummer || {};
  window.Scrummer.setup = { loadSetup, saveSetup, STORAGE_KEY };
  window.Scrummer.snapshots = { loadSnapshots, saveSnapshots, addSnapshot, makeSnapshot, SNAP_KEY };
  window.Scrummer.computeSignals = computeSignals;
})();

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
    return (Number.isFinite(n) && n >= 0) ? n : 0;
  };

  const mean = (arr) => {
    const a = arr.filter(n => n > 0);
    return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  };

  /**
   * Calculates Volatility using Coefficient of Variation (CV)
   * A higher CV means the team's velocity is unpredictable.
   */
  const calculateVolatility = (arr) => {
    const a = arr.filter(n => n > 0);
    if (a.length < 2) return 0;
    const m = mean(a);
    const variance = a.reduce((s, x) => s + Math.pow(x - m, 2), 0) / (a.length - 1);
    const sd = Math.sqrt(variance);
    return m > 0 ? sd / m : 0; // Standard Deviation / Mean
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
    const sprintDays = safeNum(setup.sprintDays) || 10;
    const teamMembers = safeNum(setup.teamMembers) || 1;
    const leaveDays = safeNum(setup.leaveDays || 0);
    const committed = safeNum(setup.committedSP);

    // BUG 1 FIX: Ensure all 3 velocity fields are captured
    const velocities = [
        safeNum(setup.v1), 
        safeNum(setup.v2), 
        safeNum(setup.v3)
    ].filter(v => v > 0);
    
    const avgVelocity = mean(velocities);
    const vol = calculateVolatility(velocities);

    // --- Capacity Logic ---
    const idealPD = sprintDays * teamMembers;
    const availablePD = Math.max(0, idealPD - leaveDays);
    const availabilityRatio = idealPD > 0 ? (availablePD / idealPD) : 0;

    // Effective Capacity: Scaled by current team availability
    const capacitySP = avgVelocity > 0 ? (avgVelocity * availabilityRatio) : 0;

    // --- Ratios & Signals ---
    const overcommitRatio = avgVelocity > 0 ? (committed / avgVelocity) : 1;
    const capacityShortfallRatio = capacitySP > 0 ? (committed / capacitySP) : 1;
    const focusFactor = availabilityRatio; 

    // --- Risk Scoring (0-100) ---
    // 1. Overcommit (50% weight): Planning > Historical Avg
    const overPenalty = clamp((overcommitRatio - 1) * 60, 0, 50);
    
    // 2. Capacity (35% weight): Planning > Current Availability
    const capPenalty = clamp((capacityShortfallRatio - 1) * 50, 0, 35);
    
    // 3. Volatility (15% weight): Stability of the 3 historical sprints
    // A volatility (CV) of 0.3 (30%) is considered high in Agile.
    const volPenalty = clamp(vol * 50, 0, 15);

    const riskScore = Math.round(clamp(overPenalty + capPenalty + volPenalty, 0, 100));

    // --- Confidence Calculation ---
    // Perfect confidence = Capacity matches or exceeds commitment, minus volatility stability.
    const baseConf = committed > 0 ? (capacitySP / committed) * 100 : 0;
    const confidence = Math.round(clamp(baseConf - (vol * 100), 0, 100));

    // --- Labels ---
    let capacityHealth = "Stable";
    if (committed > 0) {
      if (capacityShortfallRatio > 1.15) capacityHealth = "Critical";
      else if (capacityShortfallRatio > 1.0) capacityHealth = "At Risk";
      else capacityHealth = "Healthy";
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
      return raw ? JSON.parse(raw) : [];
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

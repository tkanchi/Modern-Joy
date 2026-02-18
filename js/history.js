/**
 * Scrummer — history.js
 * ----------------------------------------------------------
 * Purpose:
 * - Persist sprint snapshots locally (localStorage)
 * - Provide a small API used by Insights + Health:
 *    - saveSnapshot(data, opts)
 *    - getHistory(), getLast(), getTrend(metric)
 *    - resetCurrentSprint(), clearHistory()
 *
 * Data Model (snapshot):
 * {
 *   sprintId, timestamp,
 *   riskScore, confidence, overcommitRatio,
 *   avgVelocity, committedSP, capacitySP,
 *   mode
 * }
 */
(() => {
  // Storage keys (versioned so you can upgrade later)
  const KEY = "scrummer_sprint_history_v1";
  const SPRINT_ID_KEY = "scrummer_current_sprint_id_v1";

  /** Safe JSON parse (never throws) */
  function safeParse(str, fallback){
    try { return JSON.parse(str); } catch { return fallback; }
  }

  /**
   * Load full snapshot array from localStorage.
   * Always returns an array.
   */
  function loadHistory(){
    const arr = safeParse(localStorage.getItem(KEY) || "[]", []);
    return Array.isArray(arr) ? arr : [];
  }

  /** Persist snapshot array to localStorage */
  function saveHistory(arr){
    localStorage.setItem(KEY, JSON.stringify(arr || []));
  }

  /** Left-pad helper for sprint id formatting */
  function pad(n){ return String(n).padStart(2,"0"); }

  /**
   * Generate a readable sprint id.
   * Example: SPRINT_2026_02_18_0830
   * Note: Unique-enough for local usage (minute precision).
   */
  function generateSprintId(){
    const d = new Date();
    return `SPRINT_${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  /**
   * Get current sprint id; if missing, create it once.
   * This lets multiple snapshots belong to the same sprint.
   */
  function getCurrentSprintId(){
    let id = localStorage.getItem(SPRINT_ID_KEY);
    if (!id) {
      id = generateSprintId();
      localStorage.setItem(SPRINT_ID_KEY, id);
    }
    return id;
  }

  /**
   * Start a new sprint (resets sprint id).
   * Health page uses this for the "New Sprint" button.
   */
  function resetCurrentSprint(){
    const id = generateSprintId();
    localStorage.setItem(SPRINT_ID_KEY, id);
    return id;
  }

  /** Clear all snapshots only (does not reset sprint id) */
  function clearHistory(){
    localStorage.removeItem(KEY);
  }

  /**
   * Convert risk score to a simple mode label used in UI:
   * - rescue: high risk
   * - watch: medium risk
   * - stable: low risk
   */
  function detectMode(risk){
    risk = Number(risk || 0);
    if (risk >= 70) return "rescue";
    if (risk >= 40) return "watch";
    return "stable";
  }

  /**
   * Save a snapshot.
   *
   * @param {Object} data - computed signals
   * @param {Object} opts - options
   *    opts.force: true -> bypass 60s dedupe window
   *
   * @returns {Object} result:
   *   { ok: true,  reason:"saved",     snapshot }
   *   { ok: false, reason:"dedup_60s", snapshot:lastSaved }
   *   { ok: false, reason:"invalid_data", snapshot:null }
   */
  function saveSnapshot(data, opts){
    const options = opts && typeof opts === "object" ? opts : {};
    const force = !!options.force;

    // Guard: data must be an object
    if (!data || typeof data !== "object") {
      return { ok:false, reason:"invalid_data", snapshot:null };
    }

    // Load existing history
    const history = loadHistory();

    // Build normalized snapshot object (numbers only)
    const snapshot = {
      sprintId: getCurrentSprintId(),
      timestamp: Date.now(),

      riskScore: Number(data.riskScore || 0),
      confidence: Number(data.confidence || 0),
      overcommitRatio: Number(data.overcommitRatio || 0),

      avgVelocity: Number(data.avgVelocity || 0),
      committedSP: Number(data.committedSP || 0),
      capacitySP: Number(data.capacitySP || 0),

      mode: detectMode(Number(data.riskScore || 0))
    };

    /**
     * De-dupe rule:
     * - Don’t create another snapshot within 60 seconds of the last one
     * - Unless user explicitly forces (manual refresh + wants to see it saved)
     */
    const last = history[history.length - 1];
    if (!force && last && Math.abs((last.timestamp || 0) - snapshot.timestamp) < 60000) {
      return { ok:false, reason:"dedup_60s", snapshot:last };
    }

    // Append snapshot
    history.push(snapshot);

    // Keep storage bounded: last 30 snapshots max
    if (history.length > 30) history.splice(0, history.length - 30);

    // Persist
    saveHistory(history);

    return { ok:true, reason:"saved", snapshot };
  }

  /** Get all snapshots */
  function getHistory(){ return loadHistory(); }

  /** Get latest snapshot (or null) */
  function getLast(){
    const h = loadHistory();
    return h.length ? h[h.length - 1] : null;
  }

  /**
   * Basic trend helper used by UI:
   * metric example: "riskScore" or "capacitySP"
   * returns: "up" | "down" | "flat"
   */
  function getTrend(metric){
    const h = loadHistory();
    if (h.length < 2) return "flat";
    const last = Number(h[h.length - 1]?.[metric]);
    const prev = Number(h[h.length - 2]?.[metric]);
    if (!Number.isFinite(last) || !Number.isFinite(prev)) return "flat";
    if (last > prev) return "up";
    if (last < prev) return "down";
    return "flat";
  }

  /**
   * Public API exposed on window.Scrummer.history
   * so any page can call it.
   */
  window.Scrummer = window.Scrummer || {};
  window.Scrummer.history = {
    saveSnapshot,
    getHistory,
    getLast,
    getTrend,
    resetCurrentSprint,
    clearHistory
  };
})();
(() => {
  const KEY = "scrummer_sprint_history_v1";
  const SPRINT_ID_KEY = "scrummer_current_sprint_id_v1";

  function safeParse(str, fallback){
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function loadHistory(){
    const arr = safeParse(localStorage.getItem(KEY) || "[]", []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(arr){
    localStorage.setItem(KEY, JSON.stringify(arr || []));
  }

  function pad(n){ return String(n).padStart(2,"0"); }

  function generateSprintId(){
    const d = new Date();
    // stable, readable, and unique enough
    return `SPRINT_${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function getCurrentSprintId(){
    let id = localStorage.getItem(SPRINT_ID_KEY);
    if (!id) {
      id = generateSprintId();
      localStorage.setItem(SPRINT_ID_KEY, id);
    }
    return id;
  }

  function resetCurrentSprint(){
    const id = generateSprintId();
    localStorage.setItem(SPRINT_ID_KEY, id);
    return id;
  }

  function clearHistory(){
    localStorage.removeItem(KEY);
    localStorage.removeItem(SPRINT_ID_KEY);
  }

  function detectMode(risk){
    risk = Number(risk || 0);
    if (risk >= 70) return "rescue";
    if (risk >= 40) return "watch";
    return "stable";
  }

  /**
   * saveSnapshot(data, opts)
   * opts.force: boolean -> bypass duplicate 60s protection
   *
   * returns:
   *  { ok:true, reason:"saved", snapshot }
   *  { ok:false, reason:"invalid_data" }
   *  { ok:false, reason:"duplicate_60s", snapshot }
   */
  function saveSnapshot(data, opts = {}){
    if (!data || typeof data !== "object") {
      return { ok:false, reason:"invalid_data" };
    }

    const history = loadHistory();

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

    // Prevent duplicates within 60 seconds unless forced
    const last = history[history.length - 1];
    const within60s = last && Math.abs((last.timestamp || 0) - snapshot.timestamp) < 60000;

    if (within60s && !opts.force) {
      return { ok:false, reason:"duplicate_60s", snapshot };
    }

    history.push(snapshot);

    // Keep last 30 only
    if (history.length > 30) history.splice(0, history.length - 30);

    saveHistory(history);
    return { ok:true, reason:"saved", snapshot };
  }

  function getHistory(){ return loadHistory(); }
  function getLast(){ const h = loadHistory(); return h.length ? h[h.length - 1] : null; }

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
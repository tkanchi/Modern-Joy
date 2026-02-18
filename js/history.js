// js/history.js
(() => {

  const KEY = "scrummer_sprint_history_v1";
  const CURRENT_ID_KEY = "scrummer_current_sprint_id_v1";

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

  // ✅ Stable sprint id (persists until you reset it later)
  function generateSprintId(){
    const existing = localStorage.getItem(CURRENT_ID_KEY);
    if (existing) return existing;

    const d = new Date();
    const pad = (n) => String(n).padStart(2,"0");
    const id = `SPRINT_${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;

    localStorage.setItem(CURRENT_ID_KEY, id);
    return id;
  }

  function detectMode(risk){
    if (risk >= 70) return "rescue";
    if (risk >= 40) return "watch";
    return "stable";
  }

  function saveSnapshot(data){
    if (!data || typeof data !== "object") return;

    // ✅ Don't save junk empty snapshots
    const hasSignal =
      Number(data.riskScore) > 0 ||
      Number(data.confidence) > 0 ||
      Number(data.capacitySP) > 0 ||
      Number(data.committedSP) > 0 ||
      Number(data.avgVelocity) > 0;

    if (!hasSignal) return;

    const history = loadHistory();

    const snapshot = {
      sprintId: generateSprintId(),
      timestamp: Date.now(),

      riskScore: Number(data.riskScore || 0),
      confidence: Number(data.confidence || 0),
      overcommitRatio: Number(data.overcommitRatio || 0),

      avgVelocity: Number(data.avgVelocity || 0),
      committedSP: Number(data.committedSP || 0),
      capacitySP: Number(data.capacitySP || 0),

      mode: detectMode(Number(data.riskScore || 0))
    };

    // ✅ Prevent duplicate same-minute saves
    const last = history[history.length - 1];
    if (last && Math.abs(last.timestamp - snapshot.timestamp) < 60000){
      return;
    }

    history.push(snapshot);

    // ✅ Keep last 30 snapshots only
    if (history.length > 30){
      history.shift();
    }

    saveHistory(history);
  }

  function getHistory(){
    return loadHistory();
  }

  function getLast(){
    const h = loadHistory();
    return h.length ? h[h.length - 1] : null;
  }

  function getTrend(metric){
    const h = loadHistory();
    if (h.length < 2) return "flat";

    const last = Number(h[h.length - 1][metric] ?? 0);
    const prev = Number(h[h.length - 2][metric] ?? 0);

    if (last > prev) return "up";
    if (last < prev) return "down";
    return "flat";
  }

  // ✅ Optional helpers (useful for Health dashboard)
  function resetCurrentSprint(){
    localStorage.removeItem(CURRENT_ID_KEY);
  }

  function clearHistory(){
    localStorage.removeItem(KEY);
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
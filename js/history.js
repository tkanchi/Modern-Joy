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
  }

  function detectMode(risk){
    risk = Number(risk || 0);
    if (risk >= 70) return "rescue";
    if (risk >= 40) return "watch";
    return "stable";
  }

  // ✅ call this from Insights when you compute signals
  function saveSnapshot(data){
    if (!data || typeof data !== "object") return;

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

    // Prevent duplicates within same minute
    const last = history[history.length - 1];
    if (last && Math.abs((last.timestamp || 0) - snapshot.timestamp) < 60000) return;

    history.push(snapshot);

    // Keep last 30 only
    if (history.length > 30) history.splice(0, history.length - 30);

    saveHistory(history);
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
    resetCurrentSprint, // ✅ REQUIRED by health.js
    clearHistory         // ✅ REQUIRED by health.js
  };
})();
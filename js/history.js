(() => {
  const KEY = "scrummer_sprint_history_v1";
  const CUR_SPRINT_KEY = "scrummer_current_sprint_id_v1";

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

  function generateSprintId(){
    const d = new Date();
    const pad = (n) => String(n).padStart(2,"0");
    return `SPRINT_${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function getCurrentSprintId(){
    const existing = localStorage.getItem(CUR_SPRINT_KEY);
    if (existing) return existing;
    const id = generateSprintId();
    localStorage.setItem(CUR_SPRINT_KEY, id);
    return id;
  }

  function resetCurrentSprint(){
    const id = generateSprintId();
    localStorage.setItem(CUR_SPRINT_KEY, id);
    return id;
  }

  function clearHistory(){
    saveHistory([]);
  }

  function detectMode(risk){
    if (risk >= 70) return "rescue";
    if (risk >= 40) return "watch";
    return "stable";
  }

  function saveSnapshot(data){
    if (!data || typeof data !== "object") return false;

    const history = loadHistory();
    const now = Date.now();

    const snapshot = {
      sprintId: getCurrentSprintId(),
      timestamp: now,

      riskScore: Number(data.riskScore || 0),
      confidence: Number(data.confidence || 0),
      overcommitRatio: Number(data.overcommitRatio || 0),

      avgVelocity: Number(data.avgVelocity || 0),
      committedSP: Number(data.committedSP || 0),
      capacitySP: Number(data.capacitySP || 0),

      mode: detectMode(Number(data.riskScore || 0))
    };

    // Prevent duplicate same-minute saves
    const last = history[history.length - 1];
    if (last && Math.abs(last.timestamp - snapshot.timestamp) < 60000){
      return false;
    }

    history.push(snapshot);

    // Keep last 30
    if (history.length > 30){
      history.splice(0, history.length - 30);
    }

    saveHistory(history);
    return true;
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

    const last = h[h.length - 1][metric];
    const prev = h[h.length - 2][metric];

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
    clearHistory,
    resetCurrentSprint,
    getCurrentSprintId
  };
})();
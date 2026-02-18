(() => {

  const KEY = "scrummer_sprint_history_v1";

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
    return `SPRINT_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}_${d.getHours()}${d.getMinutes()}`;
  }

  function detectMode(risk){
    if (risk >= 70) return "rescue";
    if (risk >= 40) return "watch";
    return "stable";
  }

  function saveSnapshot(data){
    if (!data || typeof data !== "object") return;

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

    // Prevent duplicate same-minute saves
    const last = history[history.length - 1];
    if (last && Math.abs(last.timestamp - snapshot.timestamp) < 60000){
      return;
    }

    history.push(snapshot);

    // Keep last 30 sprints only
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
    getTrend
  };

})();
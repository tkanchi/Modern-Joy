(() => {
  const $ = (id) => document.getElementById(id);

  // -------- Toast (no more alert popups) --------
  function toast(msg){
    const el = $("toast");
    if (!el) return;
    el.style.display = "block";
    el.innerHTML = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.style.display = "none"; }, 3500);
  }

  function fmtWhen(ts){
    try {
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2,"0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "—";
    }
  }

  function emojiMode(mode){
    const m = String(mode || "").toLowerCase();
    if (m === "rescue") return "🔴 Rescue";
    if (m === "watch")  return "🟡 Watch";
    return "🟢 Stable";
  }

  function clamp01(x){
    x = Number(x);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function stddev(arr){
    const xs = (arr || []).map(Number).filter(n => Number.isFinite(n));
    if (xs.length < 2) return 0;
    const mean = xs.reduce((a,b)=>a+b,0)/xs.length;
    const v = xs.reduce((acc,x)=>acc + (x-mean)*(x-mean), 0)/xs.length;
    return Math.sqrt(v);
  }

  function trendDir(a, b){
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "flat";
    if (a > b) return "up";
    if (a < b) return "down";
    return "flat";
  }

  function arrow(dir, positiveUp=true){
    if (dir === "flat") return "—";
    if (positiveUp) return dir === "up" ? "▲" : "▼";
    return dir === "up" ? "▼" : "▲";
  }

  function computeOvercommitStreak(history){
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const over = Number(history[i].overcommitRatio ?? 0);
      if (over > 1.01) streak++;
      else break;
    }
    return streak;
  }

  function computePredictability(history){
    const last5 = history.slice(-5);
    const vels = last5.map(x => Number(x.avgVelocity ?? 0)).filter(n => n > 0);
    if (vels.length < 2) return { score: "—", hint: "Need 2+ velocity snapshots." };

    const mean = vels.reduce((a,b)=>a+b,0)/vels.length;
    const sd = stddev(vels);
    const cv = mean > 0 ? sd/mean : 0;

    if (cv <= 0.10) return { score: "🟢 High", hint: "Velocity is consistent (low volatility)." };
    if (cv <= 0.25) return { score: "🟡 Medium", hint: "Some volatility. Slicing + WIP control helps." };
    return { score: "🔴 Low", hint: "High volatility. Predictability will suffer." };
  }

  function computeStabilityIndex(history){
    const last = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : null;

    const riskLast = Number(last?.riskScore ?? 0);
    const confLast = Number(last?.confidence ?? 0);

    let trendScore = 0.5;
    if (prev) {
      const dir = trendDir(Number(prev.riskScore ?? 0), riskLast);
      trendScore = dir === "up" ? 0.2 : dir === "down" ? 0.8 : 0.5;
    }

    const over = Number(last?.overcommitRatio ?? 0);
    const overScore = over <= 1 ? 1 : over <= 1.15 ? 0.6 : 0.2;

    const confScore = clamp01(confLast / 100);

    const idx = (0.45 * clamp01(1 - (riskLast/100))) + (0.25 * trendScore) + (0.20 * overScore) + (0.10 * confScore);
    const pctIdx = Math.round(idx * 100);

    let label = "🟢 Stable";
    if (pctIdx < 45) label = "🔴 Fragile";
    else if (pctIdx < 70) label = "🟡 Watch";

    return { pctIdx, label };
  }

  // --------- NEW: Create first snapshot from Setup (no need to open Insights) ----------
  const SETUP_KEY = "scrummer_setup_v1";

  function safeParse(str, fallback){
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function loadSetup(){
    const api = window.Scrummer && window.Scrummer.setup;
    if (api && typeof api.loadSetup === "function") {
      try { return api.loadSetup() || {}; } catch {}
    }
    return safeParse(localStorage.getItem(SETUP_KEY) || "{}", {});
  }

  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }

  function computeFallbackFromSetup(setup){
    const sprintDays  = num(setup.sprintDays);
    const teamMembers = num(setup.teamMembers);
    const leaveDays   = num(setup.leaveDays);
    const committedSP = num(setup.committedSP);

    const v1 = num(setup.v1), v2 = num(setup.v2), v3 = num(setup.v3);
    const velocities = [v1, v2, v3].filter(x => x > 0);
    const avgVel = velocities.length ? velocities.reduce((a,b)=>a+b,0) / velocities.length : 0;

    let vol = 0;
    if (velocities.length >= 2 && avgVel > 0) {
      const variance = velocities.reduce((acc,x)=>acc + (x-avgVel)*(x-avgVel), 0) / velocities.length;
      vol = Math.sqrt(variance) / avgVel;
    }

    const teamDays = Math.max(1, sprintDays * Math.max(1, teamMembers));
    const leaveRatio = Math.min(0.6, Math.max(0, leaveDays / teamDays));
    const capacitySP = avgVel * (1 - leaveRatio);

    const overcommitRatio = capacitySP > 0 ? committedSP / capacitySP : 0;

    let risk = 0;
    if (committedSP <= 0 || avgVel <= 0) risk += 30;
    if (overcommitRatio > 1) risk += Math.min(50, (overcommitRatio - 1) * 120);
    risk += Math.min(30, vol * 80);
    risk = Math.max(0, Math.min(100, Math.round(risk)));

    const confidence = Math.max(10, Math.min(95, Math.round(100 - risk)));

    return {
      riskScore: risk,
      confidence,
      overcommitRatio,
      avgVelocity: avgVel,
      committedSP,
      capacitySP
    };
  }

  function ensureFirstSnapshot(){
    const historyApi = window.Scrummer?.history;
    if (!historyApi?.getHistory || !historyApi?.saveSnapshot) return false;

    const h = historyApi.getHistory() || [];
    if (h.length) return false;

    const setup = loadSetup();

    // If computeSignals exists, use it; else fallback
    const compute = window.Scrummer && window.Scrummer.computeSignals;
    let s = null;

    if (typeof compute === "function") {
      try { s = compute(setup || {}); } catch { s = null; }
    }

    const data = s
      ? {
          riskScore: Number(s.riskScore ?? 0),
          confidence: Number(s.confidence ?? 0),
          overcommitRatio: Number(s.overcommitRatio ?? 0),
          avgVelocity: Number(s.avgVel ?? s.avgVelocity ?? 0),
          committedSP: Number(setup.committedSP ?? s.committedSP ?? 0),
          capacitySP: Number(s.capacitySP ?? 0)
        }
      : computeFallbackFromSetup(setup);

    // If there is truly no setup at all, don’t create junk snapshots
    const hasAnySignal = (data.avgVelocity > 0) || (data.committedSP > 0) || (num(setup.sprintDays) > 0) || (num(setup.teamMembers) > 0);
    if (!hasAnySignal) {
      toast("Add your sprint details in <b>Setup</b> first, then come back and click <b>Refresh</b>.");
      return false;
    }

    const ok = historyApi.saveSnapshot(data);
    if (ok) toast("✅ Created your first snapshot from Setup. (No need to open Insights)");
    return ok;
  }

  function buildNarrative(history){
    if (!history.length) {
      return "No snapshots yet. Click <b>Refresh</b> to generate the first snapshot from your <b>Setup</b> inputs.";
    }

    const last = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : null;

    const risk = Number(last.riskScore ?? 0);
    const conf = Number(last.confidence ?? 0);
    const over = Number(last.overcommitRatio ?? 0);
    const cap = Number(last.capacitySP ?? 0);
    const com = Number(last.committedSP ?? 0);

    const riskPrev = Number(prev?.riskScore ?? NaN);
    const capPrev  = Number(prev?.capacitySP ?? NaN);
    const comPrev  = Number(prev?.committedSP ?? NaN);

    const riskDir = prev ? trendDir(riskPrev, risk) : "flat";
    const capDir  = prev ? trendDir(capPrev, cap) : "flat";
    const comDir  = prev ? trendDir(comPrev, com) : "flat";

    const lines = [];

    lines.push(`<b>Current sprint posture:</b> ${emojiMode(last.mode)} with risk <b>${risk}/100</b> and confidence <b>${conf}%</b>.`);

    if (over > 1.01) {
      const pctOver = Math.round((over - 1) * 100);
      lines.push(`Commitment is above capacity by approximately <b>${pctOver}%</b>. This is a scope/capacity signal — not an individual performance issue.`);
    } else if (cap > 0 && com > 0) {
      lines.push(`Commitment is broadly aligned with capacity. This supports predictability and lowers spillover risk.`);
    } else {
      lines.push(`Add committed SP and velocities in Setup to strengthen the explanation engine.`);
    }

    if (prev) {
      const rArrow = arrow(riskDir, false);
      const cArrow = arrow(capDir, true);
      const mArrow = arrow(comDir, true);
      lines.push(`<b>Trend vs previous snapshot:</b> Risk ${rArrow}, Capacity ${cArrow}, Commitment ${mArrow}.`);

      if (Number.isFinite(capPrev) && Number.isFinite(comPrev)) {
        const dCap = Math.round((cap - capPrev) * 10) / 10;
        const dCom = Math.round((com - comPrev) * 10) / 10;
        if (Math.abs(dCap) >= 5 || Math.abs(dCom) >= 5) {
          lines.push(`Key movement: capacity changed by <b>${dCap}</b> SP and commitment changed by <b>${dCom}</b> SP.`);
        }
      }
    }

    if (risk >= 70) lines.push(`Recommended stance: protect the sprint goal, de-scope early, and run daily unblock checkpoints.`);
    else if (risk >= 40) lines.push(`Recommended stance: run a Day-3 checkpoint and keep WIP low to protect predictability.`);
    else lines.push(`Recommended stance: maintain flow discipline and keep scope changes visible and explicit.`);

    return lines.join("<br/>");
  }

  function renderTable(history){
    const tbody = $("historyRows");
    if (!tbody) return;

    const last5 = history.slice(-5).reverse();

    if (!last5.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:10px; color:var(--text-muted);">No snapshots yet. Click Refresh.</td></tr>`;
      return;
    }

    tbody.innerHTML = last5.map(s => {
      const overPct = Number(s.overcommitRatio ?? 0) > 0
        ? Math.round((Number(s.overcommitRatio) - 1) * 100)
        : 0;

      const overText = (Number(s.overcommitRatio ?? 0) <= 0)
        ? "—"
        : (Number(s.overcommitRatio) <= 1 ? "OK" : `+${Math.max(0, overPct)}%`);

      return `
        <tr>
          <td style="padding:10px 6px; border-top:1px solid rgba(0,0,0,.06);">${fmtWhen(s.timestamp)}</td>
          <td style="padding:10px 6px; border-top:1px solid rgba(0,0,0,.06);">${emojiMode(s.mode)}</td>
          <td style="padding:10px 6px; border-top:1px solid rgba(0,0,0,.06);" align="right">${Number(s.riskScore ?? 0)}</td>
          <td style="padding:10px 6px; border-top:1px solid rgba(0,0,0,.06);" align="right">${Number(s.confidence ?? 0)}</td>
          <td style="padding:10px 6px; border-top:1px solid rgba(0,0,0,.06);" align="right">${Math.round(Number(s.committedSP ?? 0))}</td>
          <td style="padding:10px 6px; border-top:1px solid rgba(0,0,0,.06);" align="right">${Math.round(Number(s.capacitySP ?? 0))}</td>
          <td style="padding:10px 6px; border-top:1px solid rgba(0,0,0,.06);" align="right">${overText}</td>
        </tr>
      `;
    }).join("");
  }

  function render(){
    const historyApi = window.Scrummer?.history;
    const history = historyApi?.getHistory?.() || [];

    // If none, try create first snapshot from Setup
    if (!history.length) {
      ensureFirstSnapshot();
    }

    const h2 = historyApi?.getHistory?.() || [];

    const st = h2.length ? computeStabilityIndex(h2) : null;
    $("stabilityIndex").textContent = h2.length ? `${st.pctIdx}` : "—";
    $("stabilityLabel").textContent = h2.length ? st.label : "No data yet";

    const last = h2.length ? h2[h2.length - 1] : null;
    $("latestMode").textContent = last ? emojiMode(last.mode) : "—";
    $("latestModeHint").textContent = last ? `Latest snapshot: ${fmtWhen(last.timestamp)}` : "Click Refresh to create a snapshot.";

    const streak = computeOvercommitStreak(h2);
    $("overcommitStreak").textContent = h2.length ? `${streak}` : "—";
    $("overcommitHint").textContent =
      !h2.length ? "No data yet"
      : (streak >= 2 ? "Pattern: commitment > capacity repeatedly." : streak === 1 ? "Overcommit detected in latest sprint." : "No overcommit streak.");

    const pred = computePredictability(h2);
    $("predictability").textContent = pred.score;
    $("predictabilityHint").textContent = pred.hint;

    $("narrative").innerHTML = buildNarrative(h2);
    renderTable(h2);
  }

  // Buttons
  $("refreshHealthBtn")?.addEventListener("click", () => {
    render();
    toast("🔄 Health refreshed.");
  });

  $("newSprintBtn")?.addEventListener("click", () => {
    const id = window.Scrummer?.history?.resetCurrentSprint?.();
    render();
    toast(`✅ New sprint started (<b>${id || "new id"}</b>). Click <b>Refresh</b> to log a snapshot.`);
  });

  $("clearHistoryBtn")?.addEventListener("click", () => {
    const ok = confirm("Clear all local sprint history? This cannot be undone.");
    if (!ok) return;
    window.Scrummer?.history?.clearHistory?.();
    render();
    toast("🧹 History cleared.");
  });

  render();
})();
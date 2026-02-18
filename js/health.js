(() => {
  const $ = (id) => document.getElementById(id);

  function toast(msg){
    const el = $("toast");
    if (!el) return;
    el.style.display = "block";
    el.innerHTML = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.style.display = "none"; }, 2800);
  }

  function fmtWhen(ts){
    try {
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2,"0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return "—"; }
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

    const idx =
      (0.45 * clamp01(1 - (riskLast/100))) +
      (0.25 * trendScore) +
      (0.20 * overScore) +
      (0.10 * confScore);

    const pctIdx = Math.round(idx * 100);

    let label = "🟢 Stable";
    if (pctIdx < 45) label = "🔴 Fragile";
    else if (pctIdx < 70) label = "🟡 Watch";

    return { pctIdx, label };
  }

  function buildNarrative(history){
    if (!history.length) {
      return `No sprint history yet. Open <b>Insights</b> and click
              <b>Refresh + Save Snapshot</b> once to create your first snapshot.`;
    }

    const last = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : null;

    const risk = Number(last.riskScore ?? 0);
    const conf = Number(last.confidence ?? 0);
    const over = Number(last.overcommitRatio ?? 0);
    const cap = Number(last.capacitySP ?? 0);
    const com = Number(last.committedSP ?? 0);

    const lines = [];
    lines.push(`<b>Current sprint posture:</b> ${emojiMode(last.mode)} with risk <b>${risk}/100</b> and confidence <b>${conf}%</b>.`);

    if (over > 1.01) {
      const pctOver = Math.round((over - 1) * 100);
      lines.push(`Commitment is above capacity by approximately <b>${pctOver}%</b>. This is a system signal (scope vs capacity), not an individual performance issue.`);
    } else if (cap > 0 && com > 0) {
      lines.push(`Commitment is broadly aligned with capacity. This supports predictability and lowers spillover risk.`);
    } else {
      lines.push(`Add committed SP and velocities in Setup to strengthen the explanation engine.`);
    }

    if (prev) {
      const riskPrev = Number(prev?.riskScore ?? NaN);
      const capPrev  = Number(prev?.capacitySP ?? NaN);
      const comPrev  = Number(prev?.committedSP ?? NaN);

      const riskDir = trendDir(riskPrev, risk);
      const capDir  = trendDir(capPrev, cap);
      const comDir  = trendDir(comPrev, com);

      lines.push(`<b>Trend vs previous snapshot:</b> Risk ${arrow(riskDir, false)}, Capacity ${arrow(capDir, true)}, Commitment ${arrow(comDir, true)}.`);
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
      tbody.innerHTML = `<tr><td colspan="7" style="padding:10px; color:var(--text-muted);">
        No history yet. Go to Insights → <b>Refresh + Save Snapshot</b>.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = last5.map(s => {
      const over = Number(s.overcommitRatio ?? 0);
      const overPct = over > 0 ? Math.round((over - 1) * 100) : 0;
      const overText = (over <= 0) ? "—" : (over <= 1 ? "OK" : `+${Math.max(0, overPct)}%`);

      return `
        <tr>
          <td style="padding:10px 6px; border-top:1px solid var(--border);">${fmtWhen(s.timestamp)}</td>
          <td style="padding:10px 6px; border-top:1px solid var(--border);">${emojiMode(s.mode)}</td>
          <td style="padding:10px 6px; border-top:1px solid var(--border);" align="right">${Number(s.riskScore ?? 0)}</td>
          <td style="padding:10px 6px; border-top:1px solid var(--border);" align="right">${Number(s.confidence ?? 0)}</td>
          <td style="padding:10px 6px; border-top:1px solid var(--border);" align="right">${Math.round(Number(s.committedSP ?? 0))}</td>
          <td style="padding:10px 6px; border-top:1px solid var(--border);" align="right">${Math.round(Number(s.capacitySP ?? 0))}</td>
          <td style="padding:10px 6px; border-top:1px solid var(--border);" align="right">${overText}</td>
        </tr>
      `;
    }).join("");
  }

  function render(){
    const history = window.Scrummer?.history?.getHistory?.() || [];

    if (!history.length) {
      $("stabilityIndex") && ($("stabilityIndex").textContent = "—");
      $("stabilityLabel") && ($("stabilityLabel").textContent = "No data yet");
      $("latestMode") && ($("latestMode").textContent = "—");
      $("latestModeHint") && ($("latestModeHint").textContent = "Open Insights to create a snapshot.");
      $("overcommitStreak") && ($("overcommitStreak").textContent = "—");
      $("overcommitHint") && ($("overcommitHint").textContent = "No data yet");
      $("predictability") && ($("predictability").textContent = "—");
      $("predictabilityHint") && ($("predictabilityHint").textContent = "Need snapshots.");
      $("narrative") && ($("narrative").innerHTML = buildNarrative(history));
      renderTable(history);
      return;
    }

    const st = computeStabilityIndex(history);
    $("stabilityIndex") && ($("stabilityIndex").textContent = `${st.pctIdx}`);
    $("stabilityLabel") && ($("stabilityLabel").textContent = st.label);

    const last = history[history.length - 1];
    $("latestMode") && ($("latestMode").textContent = emojiMode(last.mode));
    $("latestModeHint") && ($("latestModeHint").textContent = `Latest snapshot: ${fmtWhen(last.timestamp)}`);

    const streak = computeOvercommitStreak(history);
    $("overcommitStreak") && ($("overcommitStreak").textContent = `${streak}`);
    $("overcommitHint") && ($("overcommitHint").textContent =
      (streak >= 2 ? "Pattern: commitment > capacity repeatedly."
        : streak === 1 ? "Overcommit detected in latest sprint."
        : "No overcommit streak.")
    );

    const pred = computePredictability(history);
    $("predictability") && ($("predictability").textContent = pred.score);
    $("predictabilityHint") && ($("predictabilityHint").textContent = pred.hint);

    $("narrative") && ($("narrative").innerHTML = buildNarrative(history));
    renderTable(history);
  }

  // ---- Premium safe "double click to confirm" for destructive action ----
  function confirmBySecondClick(btnEl, label1, label2, windowMs=2500){
    if(!btnEl) return false;
    const now = Date.now();
    const last = Number(btnEl.dataset.confirmTs || 0);
    if (now - last < windowMs) {
      btnEl.dataset.confirmTs = "0";
      btnEl.textContent = label1;
      return true;
    }
    btnEl.dataset.confirmTs = String(now);
    btnEl.textContent = label2;
    toast("⚠️ Click again to confirm.");
    setTimeout(() => {
      if (Number(btnEl.dataset.confirmTs || 0) === now) {
        btnEl.dataset.confirmTs = "0";
        btnEl.textContent = label1;
      }
    }, windowMs);
    return false;
  }

  // Buttons: support both ids (header + footer)
  const refreshBtnA = $("refreshHealthBtn");
  const refreshBtnB = $("refreshHealthBtn2");

  function onRefresh(){
    render();
    toast("✅ Refreshed health view");
  }

  refreshBtnA?.addEventListener("click", onRefresh);
  refreshBtnB?.addEventListener("click", onRefresh);

  $("newSprintBtn")?.addEventListener("click", () => {
    const id = window.Scrummer?.history?.resetCurrentSprint?.();
    render();
    toast(`🆕 New sprint started: <b>${id || "OK"}</b>. Now open Insights → <b>Refresh + Save Snapshot</b>.`);
  });

  $("clearHistoryBtn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (!confirmBySecondClick(btn, "🧹 Clear History", "⚠️ Confirm Clear")) return;

    window.Scrummer?.history?.clearHistory?.();
    render();
    toast("🧹 Cleared local sprint history");
  });

  render();
})();
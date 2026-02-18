(() => {
  const $ = (id) => document.getElementById(id);

  function fmtWhen(ts){
    try {
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2,"0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "—";
    }
  }

  function pct(n){
    if (!Number.isFinite(n)) return "—";
    return `${Math.round(n)}%`;
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

    // Map CV to a simple grade
    if (cv <= 0.10) return { score: "🟢 High", hint: "Velocity is consistent (low volatility)." };
    if (cv <= 0.25) return { score: "🟡 Medium", hint: "Some volatility. Slicing + WIP control helps." };
    return { score: "🔴 Low", hint: "High volatility. Predictability will suffer." };
  }

  function computeStabilityIndex(history){
    const last = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : null;

    const riskLast = Number(last?.riskScore ?? 0);
    const confLast = Number(last?.confidence ?? 0);

    // Trend component (risk should go DOWN)
    let trendScore = 0.5;
    if (prev) {
      const dir = trendDir(Number(prev.riskScore ?? 0), riskLast);
      // If risk went up -> bad
      trendScore = dir === "up" ? 0.2 : dir === "down" ? 0.8 : 0.5;
    }

    // Overcommit component
    const over = Number(last?.overcommitRatio ?? 0);
    const overScore = over <= 1 ? 1 : over <= 1.15 ? 0.6 : 0.2;

    // Confidence component
    const confScore = clamp01(confLast / 100);

    // Weighted blend -> 0..1
    const idx = (0.45 * clamp01(1 - (riskLast/100))) + (0.25 * trendScore) + (0.20 * overScore) + (0.10 * confScore);

    const pctIdx = Math.round(idx * 100);

    let label = "🟢 Stable";
    if (pctIdx < 45) label = "🔴 Fragile";
    else if (pctIdx < 70) label = "🟡 Watch";

    return { pctIdx, label };
  }

  function buildNarrative(history){
    if (!history.length) {
      return "No sprint history yet. Open <b>Insights</b> and click <b>Refresh Insights</b> once to create your first snapshot.";
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

    // Opening line (executive safe)
    lines.push(`<b>Current sprint posture:</b> ${emojiMode(last.mode)} with risk <b>${risk}/100</b> and confidence <b>${conf}%</b>.`);

    // Overcommit explanation
    if (over > 1.01) {
      const pctOver = Math.round((over - 1) * 100);
      lines.push(`Commitment is above capacity by approximately <b>${pctOver}%</b>. This is a system signal (scope vs capacity), not an individual performance issue.`);
    } else if (cap > 0 && com > 0) {
      lines.push(`Commitment is broadly aligned with capacity. This supports predictability and lowers spillover risk.`);
    } else {
      lines.push(`Add committed SP and velocities in Setup to strengthen the explanation engine.`);
    }

    // Trend line
    if (prev) {
      const rArrow = arrow(riskDir, false);
      const cArrow = arrow(capDir, true);
      const mArrow = arrow(comDir, true);

      lines.push(`<b>Trend vs previous snapshot:</b> Risk ${rArrow}, Capacity ${cArrow}, Commitment ${mArrow}.`);

      // Specific “why” (simple but strong)
      if (Number.isFinite(capPrev) && Number.isFinite(comPrev)) {
        const dCap = Math.round((cap - capPrev) * 10) / 10;
        const dCom = Math.round((com - comPrev) * 10) / 10;

        if (Math.abs(dCap) >= 5 || Math.abs(dCom) >= 5) {
          lines.push(`Key movement: capacity changed by <b>${dCap}</b> SP and commitment changed by <b>${dCom}</b> SP.`);
        }
      }
    }

    // Close with guidance
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
      tbody.innerHTML = `<tr><td colspan="7" style="padding:10px; color:var(--text-muted);">No history yet. Open Insights and click Refresh once.</td></tr>`;
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
    const history = window.Scrummer?.history?.getHistory?.() || [];

    // KPIs
    const st = computeStabilityIndex(history);
    $("stabilityIndex").textContent = history.length ? `${st.pctIdx}` : "—";
    $("stabilityLabel").textContent = history.length ? st.label : "No data yet";

    const last = history.length ? history[history.length - 1] : null;
    $("latestMode").textContent = last ? emojiMode(last.mode) : "—";
    $("latestModeHint").textContent = last ? `Latest snapshot: ${fmtWhen(last.timestamp)}` : "Open Insights to create a snapshot.";

    const streak = computeOvercommitStreak(history);
    $("overcommitStreak").textContent = history.length ? `${streak}` : "—";
    $("overcommitHint").textContent =
      !history.length ? "No data yet"
      : (streak >= 2 ? "Pattern: commitment > capacity repeatedly." : streak === 1 ? "Overcommit detected in latest sprint." : "No overcommit streak.");

    const pred = computePredictability(history);
    $("predictability").textContent = pred.score;
    $("predictabilityHint").textContent = pred.hint;

    // Narrative
    $("narrative").innerHTML = buildNarrative(history);

    // Table
    renderTable(history);
  }

  // Buttons
  $("refreshHealthBtn")?.addEventListener("click", render);

  $("newSprintBtn")?.addEventListener("click", () => {
    window.Scrummer?.history?.resetCurrentSprint?.();
    render();
    alert("New sprint started (sprintId reset). Now open Insights and Refresh once to log the first snapshot.");
  });

  $("clearHistoryBtn")?.addEventListener("click", () => {
    const ok = confirm("Clear all local sprint history? This cannot be undone.");
    if (!ok) return;
    window.Scrummer?.history?.clearHistory?.();
    render();
  });

  render();
})();
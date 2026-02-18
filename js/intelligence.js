(() => {
  const $ = (id) => document.getElementById(id);

  const setupApi = window.Scrummer?.setup;
  const compute  = window.Scrummer?.computeSignals;

  // ✅ history engine (js/history.js)
  const historyApi = window.Scrummer?.history;

  function fmt(n, digits = 0) {
    if (!Number.isFinite(n)) return "—";
    return Number(n).toFixed(digits);
  }

  function setBar(id, percent) {
    const el = $(id);
    if (!el) return;

    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    el.style.width = p + "%";

    // Dynamic glow colors for risk bar
    if (id === "barRisk") {
      el.className = `fun-bar-fill ${p > 60 ? "fill-danger" : p > 30 ? "fill-warn" : ""}`;
    }
  }

  function renderDrivers(signals) {
    const list = $("driversList");
    const empty = $("driversEmpty");
    if (!list || !empty) return;

    list.innerHTML = "";
    const c = signals?.components || { over: 0, cap: 0, vola: 0 };

    // Your existing rule
    if ((signals?.committed ?? 0) <= 0) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    const drivers = [
      { title: "Scope Pressure", score: Number(c.over || 0), max: 50, desc: "Commitment vs historical velocity." },
      { title: "Capacity Shortfall", score: Number(c.cap || 0), max: 35, desc: "Effective availability vs load." },
      { title: "Predictability", score: Number(c.vola || 0), max: 15, desc: "Historical velocity volatility." }
    ];

    drivers
      .sort((a, b) => b.score - a.score)
      .forEach((d) => {
        const pct = d.max > 0 ? Math.max(0, Math.min(100, (d.score / d.max) * 100)) : 0;
        const barClass = pct > 70 ? "fill-danger" : pct > 40 ? "fill-warn" : "";

        const item = document.createElement("div");
        item.className = "driver-item";
        item.innerHTML = `
          <div class="driver-info">
            <h4>${d.title}</h4>
            <p>${d.desc}</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px; font-weight:800; color:var(--text-muted); margin-bottom:6px;">
              ${Math.round(pct)}% IMPACT
            </div>
            <div class="fun-bar-bg">
              <div class="fun-bar-fill ${barClass}" style="width:${pct}%"></div>
            </div>
          </div>
        `;
        list.appendChild(item);
      });
  }

  function showToast(msg) {
    const t = $("toast");
    if (!t) return;
    t.style.display = "block";
    t.innerHTML = msg;
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(() => {
      t.style.display = "none";
    }, 2400);
  }

  // ✅ Normalize signals so history.js always gets the same keys
  function toSnapshotPayload(signals) {
    const s = signals || {};
    return {
      riskScore: Number(s.riskScore ?? 0),
      confidence: Number(s.confidence ?? 0),
      overcommitRatio: Number(s.overcommitRatio ?? 0),
      avgVelocity: Number(s.avgVelocity ?? s.avgVel ?? 0),
      committedSP: Number(s.committedSP ?? s.committed ?? 0),
      capacitySP: Number(s.capacitySP ?? 0)
    };
  }

  function updateUI() {
    if (!setupApi || typeof setupApi.loadSetup !== "function" || typeof compute !== "function") return;

    const setup = setupApi.loadSetup();
    const s = compute(setup || {});

    // Top KPIs (your IDs)
    if ($("kpiRisk")) $("kpiRisk").textContent = Math.round(Number(s.riskScore || 0));
    if ($("kpiConfidence")) $("kpiConfidence").textContent = Math.round(Number(s.confidence || 0)) + "%";
    if ($("kpiFocus")) $("kpiFocus").textContent = Math.round(Number(s.focusFactor || 0) * 100) + "%";
    if ($("kpiCapacity")) $("kpiCapacity").textContent = s.capacityHealth || "—";

    // Bars (your IDs)
    setBar("barRisk", s.riskScore);
    setBar("barConfidence", s.confidence);

    // Drivers
    renderDrivers(s);

    return s;
  }

  // ✅ Save snapshot ONLY when user explicitly clicks Refresh
  function saveSnapshot(signals) {
    if (!historyApi || typeof historyApi.saveSnapshot !== "function") {
      showToast("⚠️ history.js not loaded — snapshot not saved.");
      return;
    }

    // Force save on manual refresh so user sees new rows even if within 60s
    const res = historyApi.saveSnapshot(toSnapshotPayload(signals), { force: true });

    if (res && res.ok) {
      const ts = res.snapshot?.timestamp ? new Date(res.snapshot.timestamp).toLocaleString() : "";
      showToast(`✅ Snapshot saved ${ts ? "(" + ts + ")" : ""}`);
    } else {
      showToast("⚠️ Snapshot not saved.");
    }
  }

  // Hook refresh button if it exists (common id patterns)
  function bindRefresh() {
    const btn =
      $("refreshBtn") || $("refreshInsightsBtn") || $("btnRefresh") || document.querySelector('[data-action="refresh-insights"]');

    if (!btn) return;

    btn.addEventListener("click", () => {
      const s = updateUI();
      saveSnapshot(s);
    });
  }

  // Boot
  const s = updateUI();
  bindRefresh();

  // Optional: auto-save first snapshot on load (OFF by default)
  // if (s) saveSnapshot(s);

})();
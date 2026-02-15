(() => {
  const $ = (id) => document.getElementById(id);
  const setupApi = window.Scrummer?.setup;
  const compute = window.Scrummer?.computeSignals;
  const snapApi = window.Scrummer?.snapshots;

  function fmt(n, digits = 0) {
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(digits);
  }

  function setBar(id, percent, type = 'accent') {
    const el = $(id);
    if (!el) return;
    const p = Math.max(0, Math.min(100, percent));
    el.style.width = p + "%";
    
    // Modern Joy: Dynamic Glow Colors
    if (id === 'barRisk') {
      el.className = `fun-bar-fill ${p > 60 ? 'fill-danger' : p > 30 ? 'fill-warn' : ''}`;
    }
  }

  function renderDrivers(signals) {
    const list = $("driversList");
    const empty = $("driversEmpty");
    if (!list || !empty) return;

    list.innerHTML = "";
    const c = signals.components || { over: 0, cap: 0, vola: 0 };

    if (signals.committed <= 0) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    const drivers = [
      { title: "Scope Pressure", score: c.over, max: 50, desc: "Commitment vs historical velocity." },
      { title: "Capacity Shortfall", score: c.cap, max: 35, desc: "Effective availability vs load." },
      { title: "Predictability", score: c.vola, max: 15, desc: "Historical velocity volatility." }
    ];

    drivers.sort((a, b) => b.score - a.score).forEach(d => {
      const pct = (d.score / d.max) * 100;
      const barClass = pct > 70 ? 'fill-danger' : pct > 40 ? 'fill-warn' : '';
      
      const item = document.createElement("div");
      item.className = "driver-item";
      item.innerHTML = `
        <div class="driver-info">
          <h4>${d.title}</h4>
          <p>${d.desc}</p>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px; font-weight:800; color:var(--text-muted); margin-bottom:6px;">${Math.round(pct)}% IMPACT</div>
          <div class="fun-bar-bg"><div class="fun-bar-fill ${barClass}" style="width:${pct}%"></div></div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  function update() {
    if (!setupApi || !compute) return;
    const s = compute(setupApi.loadSetup());

    // Update Top KPIs
    if ($("kpiRisk")) $("kpiRisk").textContent = Math.round(s.riskScore || 0);
    if ($("kpiConfidence")) $("kpiConfidence").textContent = Math.round(s.confidence || 0) + "%";
    if ($("kpiFocus")) $("kpiFocus").textContent = Math.round((s.focusFactor || 0) * 100) + "%";
    if ($("kpiCapacity")) $("kpiCapacity").textContent = s.capacityHealth || "—";

    setBar("barRisk", s.riskScore);
    setBar("barConfidence", s.confidence);

    renderDrivers(s);
  }

  update();
})();

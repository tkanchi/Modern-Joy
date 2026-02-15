(() => {
  const $ = (id) => document.getElementById(id);
  const setupApi = window.Scrummer?.setup;
  const compute = window.Scrummer?.computeSignals;
  const snapApi = window.Scrummer?.snapshots;

  function fmt(n, digits = 0) {
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(digits);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function setBar(id, percent) {
    const el = $(id);
    if (!el) return;
    const p = clamp(percent, 0, 100);
    el.style.width = p + "%";
    
    // Modern Joy: Dynamic Color Shifting for main bars
    if (id === "barRisk") {
        el.className = "fun-bar-fill " + (p > 60 ? "fill-danger" : p > 30 ? "fill-warn" : "");
    }
    if (id === "barConfidence") {
        el.className = "fun-bar-fill " + (p < 50 ? "fill-danger" : p < 80 ? "fill-warn" : "");
    }
  }

  function deltaClass(d) {
    if (!Number.isFinite(d) || d === 0) return "deltaFlat";
    return d > 0 ? "tag-good" : "tag-bad";
  }

  function deltaText(d, suffix = "") {
    if (!Number.isFinite(d) || d === 0) return "0" + suffix;
    const sign = d > 0 ? "+" : "";
    return sign + d + suffix;
  }

  /* -----------------------------
     Modern Joy: History Rendering
  ------------------------------ */
  function row(snapshot, prev) {
    const wrap = document.createElement("div");
    wrap.className = "kpi-card"; // Using the floating card style
    wrap.style.padding = "16px";
    wrap.style.marginBottom = "12px";

    const dt = new Date(snapshot.ts);
    const when = isNaN(dt.getTime()) ? snapshot.ts : dt.toLocaleDateString();

    const risk = Math.round(snapshot.riskScore || 0);
    const conf = Math.round(snapshot.confidence || 0);

    const prevRisk = prev ? Math.round(prev.riskScore || 0) : null;
    const prevConf = prev ? Math.round(prev.confidence || 0) : null;

    const dRisk = prevRisk === null ? 0 : risk - prevRisk;
    const dConf = prevConf === null ? 0 : conf - prevConf;

    const riskCls = deltaClass(-dRisk); // risk down is good
    const confCls = deltaClass(dConf);

    wrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:800; font-size:13px;">Snapshot • ${when}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
            Commit: <b>${Math.round(snapshot.committed || 0)}</b> • Avg Vel: <b>${fmt(snapshot.avgVelocity || 0, 1)}</b>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; max-width:200px;">
          <span class="kpi-tag" style="background:var(--bg-app)">Risk: ${risk} <span class="${riskCls}" style="margin-left:4px">${deltaText(-dRisk)}</span></span>
          <span class="kpi-tag" style="background:var(--bg-app)">Conf: ${conf}% <span class="${confCls}" style="margin-left:4px">${deltaText(dConf, "%")}</span></span>
        </div>
      </div>
    `;
    return wrap;
  }

  function renderHistory() {
    if (!snapApi) return;
    const list = $("historyList");
    const empty = $("historyEmpty");
    if (!list || !empty) return;

    const snaps = snapApi.loadSnapshots();
    list.innerHTML = "";

    if (!snaps.length) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    const show = snaps.slice(0, 5); // Show latest 5
    show.forEach((s, i) => {
      const prev = snaps[i + 1] || null;
      list.appendChild(row(s, prev));
    });
  }

  /* -----------------------------
     Modern Joy: Driver Card
  ------------------------------ */
  function driverCard({ title, score, maxScore, desc, action }) {
    const wrap = document.createElement("div");
    wrap.className = "driver-item";

    const pct = maxScore > 0 ? clamp((score / maxScore) * 100, 0, 100) : 0;
    const barColor = pct > 70 ? "fill-danger" : pct > 40 ? "fill-warn" : "";

    wrap.innerHTML = `
      <div class="driver-info">
        <h4>${title}</h4>
        <p>${desc}</p>
        <div style="margin-top:8px; font-size:12px; color:var(--text-main);"><b>Next action:</b> ${action}</div>
      </div>
      <div style="text-align:right; min-width:120px;">
        <div style="font-size:11px; font-weight:800; color:var(--text-muted); margin-bottom:6px;">${Math.round(pct)}% IMPACT</div>
        <div class="fun-bar-bg">
            <div class="fun-bar-fill ${barColor}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
    return wrap;
  }

  function renderDrivers(signals) {
    const list = $("driversList");
    const empty = $("driversEmpty");
    if (!list || !empty) return;

    list.innerHTML = "";

    if (!(signals.committed > 0) || !(signals.avgVelocity > 0)) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    const c = signals.components || { over: 0, cap: 0, vola: 0 };

    const drivers = [
      {
        key: "over",
        title: "Scope Pressure",
        score: c.over || 0,
        maxScore: 50,
        desc: `Commitment is <b>${fmt(signals.overcommitRatio, 2)}x</b> average velocity.`,
        action: signals.overcommitRatio > 1.1 ? "De-scope 15% of lowest value work." : "Keep WIP low and avoid new stories."
      },
      {
        key: "cap",
        title: "Capacity Shortfall",
        score: c.cap || 0,
        maxScore: 35,
        desc: `Leaves/holidays have reduced effective capacity.`,
        action: signals.capacityShortfallRatio > 1.2 ? "Align with PO to drop 2 stories." : "Identify 'nice-to-have' fallback items."
      },
      {
        key: "vola",
        title: "Predictability",
        score: c.vola || 0,
        maxScore: 15,
        desc: `Velocity variability: <b>${Math.round((signals.vol || 0) * 100)}%</b>.`,
        action: (signals.vol || 0) > 0.35 ? "Split large work for smoother flow." : "Maintain current refinement quality."
      }
    ];

    drivers.sort((a, b) => (b.score || 0) - (a.score || 0));
    drivers.forEach((d) => list.appendChild(driverCard(d)));
  }

  function update() {
    if (!setupApi || !compute) return;

    const setup = setupApi.loadSetup();
    const s = compute(setup);

    // ===== Summary Banner (Premium Modern Joy Style) =====
    const banner = $("summaryBanner");
    const st = $("summaryTitle");
    const sx = $("summaryText");
    const sb = $("summaryBadge");

    if (banner && st && sx && sb) {
      if (!(s.committed > 0) || !(s.avgVelocity > 0)) {
        banner.style.display = "block";
        banner.style.borderLeftColor = "var(--warning)";
        st.textContent = "Step 1 required: complete Sprint Setup";
        sx.textContent = "Go to Launchpad and enter commitment + last 3 velocities.";
        sb.textContent = "Setup needed";
      } else {
        banner.style.display = "block";
        const risk = Math.round(s.riskScore || 0);
        
        if (risk <= 30) {
          banner.style.borderLeftColor = "var(--success)";
          st.textContent = "Healthy sprint — execution looks steady";
          sb.textContent = "On track";
          sb.className = "kpi-tag tag-good";
        } else if (risk <= 60) {
          banner.style.borderLeftColor = "var(--warning)";
          st.textContent = "Moderate risk — watch capacity closely";
          sb.textContent = "Warning";
          sb.className = "kpi-tag";
        } else {
          banner.style.borderLeftColor = "var(--danger)";
          st.textContent = "High risk — immediate action required";
          sb.textContent = "Critical";
          sb.className = "kpi-tag tag-bad";
        }
        sx.textContent = `Risk score is ${risk} (${s.riskBand}). Confidence is ${Math.round(s.confidence)}%.`;
      }
    }

    // ===== KPIs & Bars =====
    if ($("kpiRisk")) $("kpiRisk").textContent = Number.isFinite(s.riskScore) ? `${Math.round(s.riskScore)}` : "—";
    if ($("kpiConfidence")) $("kpiConfidence").textContent = Number.isFinite(s.confidence) ? `${Math.round(s.confidence)}%` : "—";
    if ($("kpiFocus")) $("kpiFocus").textContent = s.avgVelocity > 0 ? `${Math.round((s.focusFactor || 0) * 100)}%` : "—";
    if ($("kpiCapacity")) $("kpiCapacity").textContent = s.capacityHealth || "—";

    setBar("barRisk", s.riskScore || 0);
    setBar("barConfidence", s.confidence || 0);

    // ===== Formula Row / Details =====
    if ($("detailOvercommit")) $("detailOvercommit").textContent = s.avgVelocity > 0 ? `${(s.overcommitRatio || 0).toFixed(2)}x` : "—";
    if ($("detailCapRatio")) $("detailCapRatio").textContent = s.capacitySP > 0 ? `${(s.capacityShortfallRatio || 0).toFixed(2)}x` : "—";
    if ($("detailFocusPct")) $("detailFocusPct").textContent = s.avgVelocity > 0 ? `${Math.round((s.focusFactor || 0) * 100)}%` : "—";
    if ($("detailRiskScore")) $("detailRiskScore").textContent = Math.round(s.riskScore || 0);
    
    if ($("detailAvgVelocity")) $("detailAvgVelocity").textContent = fmt(s.avgVelocity, 1);
    if ($("detailCapacitySP")) $("detailCapacitySP").textContent = fmt(s.capacitySP, 1);
    if ($("detailCommitted")) $("detailCommitted").textContent = fmt(s.committed, 0);
    if ($("detailVol")) $("detailVol").textContent = `${Math.round((s.vol || 0) * 100)}%`;

    // ===== Chips (Signals) =====
    const setSignal = (id, val, highLimit, midLimit) => {
        const el = $(id);
        if (!el) return;
        const cls = val > highLimit ? "tag-bad" : val > midLimit ? "" : "tag-good";
        el.className = "kpi-tag " + cls;
        el.style.justifyContent = "flex-start";
    };

    setSignal("sigScope", s.overcommitRatio, 1.1, 1.0);
    setSignal("sigCapacity", s.capacityShortfallRatio, 1.2, 1.0);
    setSignal("sigFlow", s.vol, 0.35, 0.2);

    renderDrivers(s);
    renderHistory();
  }

  function wire() {
    const saveBtn = $("saveSnapshot");
    const clearBtn = $("clearHistory");

    if (saveBtn && snapApi) {
      saveBtn.addEventListener("click", () => {
        const s = compute(setupApi.loadSetup());
        if (!(s.committed > 0)) return;
        snapApi.addSnapshot(snapApi.makeSnapshot(s));
        renderHistory();
      });
    }

    if (clearBtn && snapApi) {
      clearBtn.addEventListener("click", () => {
        snapApi.saveSnapshots([]);
        renderHistory();
      });
    }
  }

  update();
  wire();

  window.addEventListener("storage", (e) => {
    update();
  });
})();

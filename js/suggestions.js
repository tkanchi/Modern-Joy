(() => {
  const list = document.getElementById("suggestionsList");
  const setupApi = window.Scrummer?.setup;
  const compute = window.Scrummer?.computeSignals;

  /**
   * Modern Joy: Card Generator
   * Maps 'tone' to specific visual styles (Urgent, Success, Neutral)
   */
  function card(title, descHtml, tone = "neutral") {
    const wrap = document.createElement("div");
    
    // Map old tones to Modern Joy classes
    const isUrgent = tone === "danger";
    wrap.className = `action-card ${isUrgent ? "urgent" : ""}`;
    
    // Select a fun emoji based on tone
    let emoji = "💡";
    let badgeColor = "var(--bg-app)";
    let badgeText = "Suggestion";

    if (tone === "danger") { emoji = "🔥"; badgeColor = "var(--danger-bg)"; badgeText = "Critical"; }
    else if (tone === "warn") { emoji = "⚠️"; badgeColor = "var(--warning-bg)"; badgeText = "Warning"; }
    else if (tone === "ok") { emoji = "✅"; badgeColor = "var(--success-bg)"; badgeText = "Healthy"; }

    wrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
        <div style="font-weight:800; font-size:15px; display:flex; align-items:center; gap:8px;">
          <span>${emoji}</span> ${title}
        </div>
        <span class="kpi-tag" style="background:${badgeColor}; font-size:10px;">${badgeText}</span>
      </div>
      <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.6;">${descHtml}</p>
      ${isUrgent ? `<button class="btn-fun" style="background:var(--danger); width:100%; font-size:11px; margin-top:16px;">Take Action</button>` : ''}
    `;
    return wrap;
  }

  function toneFromRisk(riskScore) {
    if (!Number.isFinite(riskScore)) return "neutral";
    if (riskScore <= 30) return "ok";
    if (riskScore <= 60) return "warn";
    return "danger";
  }

  function render() {
    if (!list || !setupApi || !compute) return;
    list.innerHTML = "";

    const s = compute(setupApi.loadSetup());

    // Validation: Check if setup exists
    if (!(s.committed > 0) || !(s.avgVelocity > 0)) {
      list.appendChild(
        card(
          "Setup Required",
          "We can't generate actions without your sprint metrics. Head back to the <b>Launchpad</b> to get started.",
          "warn"
        )
      );
      return;
    }

    // 1. Sprint Summary
    const sprintTone = toneFromRisk(s.riskScore);
    list.appendChild(
      card(
        "Sprint Health Check",
        `Your risk score is <b>${Math.round(s.riskScore)} (${s.riskBand})</b>. Delivery confidence is sitting at <b>${Math.round(s.confidence)}%</b>.`,
        sprintTone
      )
    );

    // 2. Overcommit Logic
    if (s.overcommitRatio > 1.1) {
      list.appendChild(
        card(
          "Excessive Scope Pressure",
          "Commitment is dangerously high compared to your historical average. <b>Renegotiate scope now:</b> de-scope 15% of the lowest priority work.",
          "danger"
        )
      );
    } else if (s.overcommitRatio > 1.0) {
      list.appendChild(
        card(
          "Tight Delivery Window",
          "Your plan is slightly optimistic. Ensure no new 'ad-hoc' requests are added mid-sprint to protect the goal.",
          "warn"
        )
      );
    }

    // 3. Capacity Logic
    if (s.capacityShortfallRatio > 1.2) {
      list.appendChild(
        card(
          "Capacity Crisis",
          "Leave and holidays have created a massive gap. You simply don't have enough hours to cover the points. Move 2-3 stories back to the backlog.",
          "danger"
        )
      );
    }

    // 4. Volatility / Predictability
    if (s.vol > 0.35) {
      list.appendChild(
        card(
          "Unstable Velocity",
          "Your velocity is swinging too much. Focus on <b>breaking down large stories</b> into smaller units (1-3 points) to stabilize flow.",
          "danger"
        )
      );
    } else if (s.vol <= 0.20) {
      list.appendChild(
        card(
          "High Predictability",
          "Your flow is excellent. Use this stability to perform a small process experiment or tackle technical debt.",
          "ok"
        )
      );
    }

    // 5. General AI Advice
    list.appendChild(
      card(
        "AI Strategy",
        "The best way to win this sprint is to <b>limit WIP</b> (Work In Progress). Don't let team members start new things until open tickets are moved to QA.",
        "neutral"
      )
    );
  }

  // Initial Render
  render();

  // Listen for changes
  window.addEventListener("storage", () => {
    render();
  });
})();

/**
 * SCRUMMER — Actions Engine
 * Translates signals into tactical recommendations.
 */
(() => {
  const list = document.getElementById("suggestionsList");
  const setupApi = window.Scrummer?.setup;
  const compute = window.Scrummer?.computeSignals;

  function createActionCard(title, desc, isUrgent = false) {
    const card = document.createElement("div");
    // Using your 'action-card' class from style.css
    card.className = `action-card ${isUrgent ? 'urgent' : ''}`;
    
    // Applying urgent styles dynamically if not fully defined in CSS
    if (isUrgent) {
      card.style.borderLeft = "6px solid #e53e3e";
      card.style.background = "rgba(254, 242, 242, 1)";
    }

    card.innerHTML = `
      <div style="font-weight:800; margin-bottom:6px; font-size:16px; ${isUrgent ? 'color:#9B2C2C;' : 'color:var(--text-main);'}">
        ${isUrgent ? '🚀 ' : '💡 '}${title}
      </div>
      <div style="font-size:14px; opacity:0.8; margin-bottom:16px; line-height:1.5; color:var(--text-muted);">
        ${desc}
      </div>
      ${isUrgent ? '<button class="btn-fun" style="background:#9B2C2C; width:100%; font-size:12px; border:none; cursor:pointer;">Prioritize Descope</button>' : ''}
    `;
    return card;
  }

  function render() {
    if (!list || !compute || !setupApi) return;
    
    const setupData = setupApi.loadSetup();
    const s = compute(setupData);
    
    // Clear the "Analyzing signals..." placeholder
    list.innerHTML = "";

    // Handle empty state (Bug 4/7 safety)
    if (!setupData.committedSP || setupData.committedSP == 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-light);">
          <b>No data to analyze.</b><br>Go to Setup to initialize your sprint.
        </div>`;
      return;
    }

    let hasCriticalActions = false;

    // 1. High Risk Descope
    if (s.riskScore > 60) {
      list.appendChild(createActionCard(
        "Immediate De-scope", 
        `Your risk score is ${Math.round(s.riskScore)}%. We recommend moving ~${Math.round(s.committed * 0.15)} SP to the backlog to stabilize delivery.`, 
        true
      ));
      hasCriticalActions = true;
    }
    
    // 2. Volatility Management (Bug 1: Uses the 3-sprint history)
    if (s.vol > 0.25) {
      list.appendChild(createActionCard(
        "Refinement Audit", 
        "Historical velocity is swinging by over 25%. Break stories into smaller, 1-3pt units to improve predictability.", 
        false
      ));
    }

    // 3. Capacity/Focus Check
    if (s.focusFactor < 0.7) {
      list.appendChild(createActionCard(
        "Focus Protection", 
        "Team focus is low due to leave or holidays. Cancel non-essential meetings this sprint to protect deep-work hours.", 
        false
      ));
    }

    // 4. Always provide a Baseline Action
    list.appendChild(createActionCard(
      "WIP Limit", 
      "Maintain flow by limiting active tickets to 2 per developer. Prevent 'Started but not Finished' syndrome.", 
      false
    ));

    // 5. Success State
    if (!hasCriticalActions && s.riskScore < 30) {
      const successMsg = document.createElement("div");
      successMsg.style.cssText = "padding:16px; background:#f0fdf4; border-radius:12px; color:#166534; font-size:13px; font-weight:600; text-align:center; margin-bottom:16px;";
      successMsg.innerHTML = "✨ Sprint signals are looking healthy and stable.";
      list.prepend(successMsg);
    }
  }

  // Run on load
  render();
})();

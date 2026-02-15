(() => {
  const list = document.getElementById("suggestionsList");
  const setupApi = window.Scrummer?.setup;
  const compute = window.Scrummer?.computeSignals;

  function createActionCard(title, desc, isUrgent = false) {
    const card = document.createElement("div");
    card.className = `action-card ${isUrgent ? 'urgent' : ''}`;
    
    card.innerHTML = `
      <div style="font-weight:700; margin-bottom:4px; font-size:15px; ${isUrgent ? 'color:#9B2C2C;' : ''}">${title}</div>
      <div style="font-size:13px; opacity:0.8; margin-bottom:12px;">${desc}</div>
      ${isUrgent ? '<button class="btn-fun" style="background:#9B2C2C; width:100%; font-size:12px;">Take Action Now</button>' : ''}
    `;
    return card;
  }

  function render() {
    if (!list || !compute) return;
    const s = compute(setupApi.loadSetup());
    list.innerHTML = "";

    if (s.riskScore > 60) {
      list.appendChild(createActionCard("Immediate De-scope", "Risk is critical. Identify 15% of points to move to the next sprint.", true));
    }
    
    if (s.vol > 0.25) {
      list.appendChild(createActionCard("Refinement Audit", "Velocity is unstable. Split stories into smaller, 1-3pt units.", false));
    }

    list.appendChild(createActionCard("WIP Limit", "Protect flow by limiting active tickets to 2 per developer.", false));
  }

  render();
})();

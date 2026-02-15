/* =========================================================
   Scrummer — copilot.js (Modern Joy Edition)
   Aesthetic: AI-First, Clean Typography, Premium Pills
   ========================================================= */

(function(){
  const $ = (id) => document.getElementById(id);
  const setupApi = window.Scrummer?.setup;
  const computeSignals = window.Scrummer?.computeSignals;
  const COPILOT_KEY = "scrummer-copilot-v1";

  // --- Persistence ---
  const loadCopilot = () => {
    try {
      const raw = localStorage.getItem(COPILOT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };

  const saveCopilot = (obj) => localStorage.setItem(COPILOT_KEY, JSON.stringify(obj));

  /* -----------------------------
      UI Interaction Helpers
  ------------------------------ */
  function setActiveTab(tab) {
    document.querySelectorAll(".segBtn").forEach(b => {
      const isActive = b.dataset.tab === tab;
      b.classList.toggle("is-active", isActive);
      
      // Syncing with Modern Joy CSS variables
      if (isActive) {
        b.style.background = 'var(--accent-primary)';
        b.style.color = 'white';
      } else {
        b.style.background = 'var(--border-soft)';
        b.style.color = 'var(--text-muted)';
      }
    });
  }

  function showMsg(text, type = "success") {
    const el = $("copilotMsg");
    if (!el) return;
    el.style.display = "block";
    el.style.color = type === "success" ? "#059669" : "#dc2626";
    el.innerHTML = `<b>${text}</b>`;
    setTimeout(() => { el.style.display = "none"; }, 1800);
  }

  // --- AI Recommendation Logic ---
  function recommend(signals) {
    const over = signals.overcommitRatio || 0;
    const focus = signals.focusFactor || 0;
    const vol = signals.vol || 0;
    const conf = signals.confidence || 0;

    if (over > 1.15) return "planning"; // Too much scope
    if (focus < 0.85) return "daily";    // Too many distractions
    if (vol > 0.20) return "refine";    // Unstable velocity
    if (conf < 75) return "retro";      // Low confidence
    return "daily"; 
  }

  function setRecommendationUI(tab) {
    const badge = $("copilotRecommended");
    const names = { planning: "Planning", daily: "Daily", refine: "Refinement", review: "Review", retro: "Retro" };
    if (badge) {
        badge.textContent = "AI Suggests: " + (names[tab] || "Daily");
        badge.style.background = "#f0fdf4";
        badge.style.color = "#166534";
    }
  }

  function renderBrief(s) {
    if ($("briefScope")) $("briefScope").textContent = Math.round(s.overcommitRatio * 100) + "%";
    if ($("briefCapRatio")) $("briefCapRatio").textContent = Math.round(s.focusFactor * 100) + "%";
    if ($("briefConf")) $("briefConf").textContent = Math.round(s.confidence) + "%";
    if ($("briefRisk")) {
        const risk = Math.round(s.riskScore);
        $("briefRisk").textContent = risk;
        $("briefRisk").style.color = risk > 60 ? "#ef4444" : risk > 30 ? "#f59e0b" : "#10b981";
    }
  }

  // Content Template Generator
  function contentFor(tab, s) {
    const base = {
      planning: {
        title: "Sprint Planning",
        why: "Scope pressure is high. Use this ritual to negotiate a realistic commitment.",
        list: [
          "Compare planned SP against the 3-sprint average.",
          "Identify 'Stretch Goals' to move to the next sprint.",
          "Check for overlapping holidays or team leave."
        ],
        fields: [{ id: "finalCommit", label: "Agreed Commitment", type: "number", placeholder: "SP" }]
      },
      daily: {
        title: "Daily Standup",
        why: "Focus factor is low. Use today to swarm on blockers and stop starting new work.",
        list: [
          "Identify tickets older than 3 days.",
          "Is anyone 'blocked' but not 'flagged'?",
          "Review the WIP (Work In Progress) limit."
        ],
        fields: [{ id: "blocker", label: "Critical Blocker", type: "text", placeholder: "Task ID" }]
      },
      refine: {
        title: "Backlog Refinement",
        why: "Velocity volatility is high. Stories need better slicing and 'Ready' criteria.",
        list: [
          "Break stories > 5SP into smaller units.",
          "Clarify Acceptance Criteria for top 5 items.",
          "Estimate technical complexity for new requests."
        ],
        fields: [{ id: "readyCount", label: "Ready Items", type: "number", placeholder: "Qty" }]
      },
      review: {
        title: "Sprint Review",
        why: "Confidence is lagging. Showcase what's 'Done' and reset expectations.",
        list: ["Demo completed features.", "Gather stakeholder sentiment.", "Capture new items for the backlog."],
        fields: [{ id: "stakeholder", label: "Stakeholder Sentiment", type: "text", placeholder: "Feedback" }]
      },
      retro: {
        title: "Retrospective",
        why: "Delivery predictability is dropping. Pick one process experiment.",
        list: ["What slowed us down?", "What was our 'Win'?", "One experiment for next sprint."],
        fields: [{ id: "experiment", label: "Next Experiment", type: "text", placeholder: "e.g. Pair Programming" }]
      }
    };
    return base[tab] || base.planning;
  }

  /* -----------------------------
      Panel Rendering
  ------------------------------ */
  function renderPanel(tab, s) {
    const c = contentFor(tab, s);
    const store = loadCopilot();

    if ($("panelTitle")) $("panelTitle").textContent = c.title;
    if ($("panelWhy")) $("panelWhy").textContent = c.why;

    const ul = $("panelList");
    if (ul) {
      ul.innerHTML = c.list.map(t => `<li style="margin-bottom:12px;">${t}</li>`).join('');
    }

    const grid = $("decisionFields");
    if (grid) {
      grid.innerHTML = "";
      c.fields.forEach(f => {
        const wrap = document.createElement("div");
        wrap.className = "input-group";
        
        const val = store[tab]?.[f.id] || "";
        wrap.innerHTML = `
          <label class="kpi-label">${f.label}</label>
          <input id="cp_${f.id}" type="${f.type}" class="fun-input" value="${val}" placeholder="${f.placeholder}">
        `;
        grid.appendChild(wrap);
      });
    }

    // Save/Clear Listeners
    $("copilotSave").onclick = () => {
      const currentStore = loadCopilot();
      const obj = {};
      c.fields.forEach(f => {
        const el = $("cp_" + f.id);
        obj[f.id] = el ? el.value : "";
      });
      currentStore[tab] = obj;
      saveCopilot(currentStore);
      showMsg("Decisions Saved! ✨");
    };

    $("copilotClear").onclick = () => {
      const currentStore = loadCopilot();
      delete currentStore[tab];
      saveCopilot(currentStore);
      renderPanel(tab, s);
      showMsg("Form Reset", "danger");
    };
  }

  function init() {
    if (!setupApi || !computeSignals) return;
    const s = computeSignals(setupApi.loadSetup());

    renderBrief(s);
    const rec = recommend(s);
    setRecommendationUI(rec);

    document.querySelectorAll(".segBtn").forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        setActiveTab(tab);
        renderPanel(tab, s);
      };
    });

    setActiveTab(rec);
    renderPanel(rec, s);
  }

  init();
})();

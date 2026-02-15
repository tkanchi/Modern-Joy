/* =========================================================
   Scrummer — copilot.js (Modern Joy Edition)
   Aesthetic: AI-First, Clean Typography, Premium Pills
   ========================================================= */

(function(){
  const $ = (id) => document.getElementById(id);
  const setupApi = window.Scrummer?.setup;
  const computeSignals = window.Scrummer?.computeSignals;

  const COPILOT_KEY = "scrummer-copilot-v1";

  function loadCopilot(){
    try{
      const raw = localStorage.getItem(COPILOT_KEY);
      const v = raw ? JSON.parse(raw) : {};
      return (v && typeof v === "object") ? v : {};
    }catch{ return {}; }
  }

  function saveCopilot(obj){
    try{ localStorage.setItem(COPILOT_KEY, JSON.stringify(obj)); }catch(e){}
  }

  /* -----------------------------
     Modern Joy: Active Tab Styling
  ------------------------------ */
  function setActiveTab(tab){
    document.querySelectorAll(".segBtn").forEach(b => {
      const isActive = b.dataset.tab === tab;
      b.classList.toggle("is-active", isActive);
      
      // Applying Modern Joy specific styles
      if (isActive) {
        b.style.background = 'var(--text-main)';
        b.style.color = 'white';
        b.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      } else {
        b.style.background = 'var(--bg-app)';
        b.style.color = 'var(--text-muted)';
        b.style.boxShadow = 'none';
      }
    });
  }

  function showMsg(text, type = "success"){
    const el = $("copilotMsg");
    if (!el) return;
    el.style.display = "block";
    el.style.color = type === "success" ? "var(--success)" : "var(--danger)";
    el.innerHTML = `<b>${text}</b>`;
    setTimeout(()=>{ el.style.display="none"; }, 1800);
  }

  // --- Recommendation logic ---
  function recommend(signals){
    const over = signals.overcommitRatio || 0;
    const capRatio = (signals.avgVelocity > 0) ? (signals.capacitySP / signals.avgVelocity) : 0;
    const focus = signals.focusFactor || 0;
    const vol = signals.vol || 0;
    const conf = signals.confidence || 0;

    if (over > 1.10 || capRatio < 1.0) return "planning";
    if (focus < 0.90) return "daily";
    if (vol > 0.18) return "retro";
    if (conf < 70) return "review";
    return "planning";
  }

  function setRecommendationUI(tab){
    const map = {
      planning: ["badgePlanning", "Planning"],
      daily: ["badgeDaily", "Daily"],
      refine: ["badgeRefine", "Refinement"],
      review: ["badgeReview", "Review"],
      retro: ["badgeRetro", "Retro"]
    };

    Object.keys(map).forEach(k=>{
      const el = $(map[k][0]);
      if (el) el.style.display = (k === tab) ? "inline-flex" : "none";
    });

    const badge = $("copilotRecommended");
    if (badge) {
        badge.textContent = "AI Recommendation: " + (map[tab]?.[1] || "—");
        badge.className = "kpi-tag tag-good";
    }
  }

  function fmtX(n){
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(2) + "x";
  }

  function renderBrief(s){
    if ($("briefScope")) $("briefScope").textContent = fmtX(s.overcommitRatio);
    
    const capRatio = (s.avgVelocity > 0) ? (s.capacitySP / s.avgVelocity) : 0;
    if ($("briefCapRatio")) $("briefCapRatio").textContent = fmtX(capRatio);

    if ($("briefConf")) $("briefConf").textContent = Math.round(s.confidence) + "%";
    if ($("briefRisk")) $("briefRisk").textContent = String(Math.round(s.riskScore));
  }

  // Content templates
  function contentFor(tab, s){
    const over = s.overcommitRatio || 0;
    const capRatio = (s.avgVelocity > 0) ? (s.capacitySP / s.avgVelocity) : 0;
    const focus = s.focusFactor || 0;
    const vol = s.vol || 0;
    const conf = s.confidence || 0;

    const base = {
      planning: {
        title: "Sprint Planning",
        why: "Align scope with reality. Signals suggest checking commitment pressure.",
        list: [
          "Validate scope against average velocity.",
          "Confirm availability assumptions (leave/holidays).",
          "Identify optional backlog items for de-scoping."
        ],
        fields: [
          { id:"finalCommit", label:"Final Commitment (SP)", type:"number", placeholder:"e.g. 40" },
          { id:"riskAcceptance", label:"Risk Acceptance", type:"select", options:["Low","Medium","High"] }
        ]
      },
      daily: {
        title: "Daily Standup",
        why: "Protect flow. Unblock tickets fast and swarm on critical items.",
        list: [
          "Remove blockers with owners.",
          "Limit parallel work (WIP).",
          "Escalate dependencies early."
        ],
        fields: [
          { id:"blockerOwner", label:"Blocker Owner", type:"text", placeholder:"Name" },
          { id:"wipMove", label:"WIP Decision", type:"select", options:["No change","Reduce WIP","Pause new work"] }
        ]
      },
      refine: {
        title: "Refinement",
        why: "Reduce future surprises. Break down large stories now.",
        list: [
          "Confirm acceptance criteria.",
          "Split oversized items.",
          "Ensure top items are 'Ready'."
        ],
        fields: [
          { id:"readyCount", label:"Items marked Ready", type:"number", placeholder:"0" }
        ]
      },
      review: {
        title: "Sprint Review",
        why: "Make progress visible. Reset priorities based on demo feedback.",
        list: [
          "Highlight shipped vs committed.",
          "Capture stakeholder feedback.",
          "Confirm priority for next sprint."
        ],
        fields: [
          { id:"shipped", label:"Status", type:"select", options:["Ahead","On track","Behind"] }
        ]
      },
      retro: {
        title: "Retrospective",
        why: "Improve the system. Pick ONE experiment to reduce risk next time.",
        list: [
          "Identify biggest system constraint.",
          "Choose one measurable experiment.",
          "Assign owner + review date."
        ],
        fields: [
          { id:"experiment", label:"Chosen Experiment", type:"text", placeholder:"e.g. Max 3 WIP" }
        ]
      }
    };

    // Signal-driven adjustments
    if (tab === "planning" && over > 1.10) base.planning.list.unshift("🔥 High Scope Pressure: Re-check commitment!");
    if (tab === "daily" && focus < 0.90) base.daily.list.unshift("⚠️ Low Focus: Reduce WIP immediately.");

    return base[tab];
  }

  /* -----------------------------
     Modern Joy: Panel Rendering
  ------------------------------ */
  function renderPanel(tab, s){
    const c = contentFor(tab, s);

    if ($("panelTitle")) $("panelTitle").textContent = c.title;
    if ($("panelWhy")) $("panelWhy").textContent = c.why;

    const ul = $("panelList");
    if (ul){
      ul.innerHTML = "";
      c.list.forEach(t=>{
        const li = document.createElement("li");
        li.style.marginBottom = "8px";
        li.textContent = t;
        ul.appendChild(li);
      });
    }

    const grid = $("decisionFields");
    if (!grid) return;
    grid.innerHTML = "";

    const store = loadCopilot();
    const saved = store[tab] || {};

    c.fields.forEach(f=>{
      const wrap = document.createElement("div");
      wrap.style.marginBottom = "16px";

      const label = document.createElement("label");
      label.style.display = "block";
      label.style.fontSize = "11px";
      label.style.fontWeight = "800";
      label.style.color = "var(--text-muted)";
      label.style.textTransform = "uppercase";
      label.style.marginBottom = "6px";
      label.textContent = f.label;
      wrap.appendChild(label);

      let input;
      const commonStyle = "width:100%; padding:10px; border-radius:12px; border:1px solid #E5E7EB; background:#F9FAFB; font-family:inherit; font-size:13px;";

      if (f.type === "select"){
        input = document.createElement("select");
        input.setAttribute('style', commonStyle);
        (f.options || []).forEach(opt=>{
          const o = document.createElement("option");
          o.value = opt; o.textContent = opt;
          input.appendChild(o);
        });
      } else {
        input = document.createElement("input");
        input.type = f.type || "text";
        input.placeholder = f.placeholder || "";
        input.setAttribute('style', commonStyle);
      }

      input.id = "cp_" + f.id;
      if (saved[f.id]) input.value = saved[f.id];

      wrap.appendChild(input);
      grid.appendChild(wrap);
    });

    // Save/Clear Handlers
    $("copilotSave").onclick = () => {
      const store = loadCopilot();
      const obj = {};
      c.fields.forEach(f => {
        const el = $("cp_" + f.id);
        obj[f.id] = el ? el.value : "";
      });
      store[tab] = obj;
      saveCopilot(store);
      showMsg("Notes Saved!");
    };

    $("copilotClear").onclick = () => {
      const store = loadCopilot();
      delete store[tab];
      saveCopilot(store);
      renderPanel(tab, s);
      showMsg("Cleared", "danger");
    };
  }

  function init(){
    if (!setupApi || !computeSignals) return;
    const setup = setupApi.loadSetup();
    const s = computeSignals(setup);

    renderBrief(s);
    const rec = recommend(s);
    setRecommendationUI(rec);

    document.querySelectorAll(".segBtn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const tab = btn.dataset.tab;
        setActiveTab(tab);
        renderPanel(tab, s);
      });
    });

    setActiveTab(rec);
    renderPanel(rec, s);
  }

  init();
})();

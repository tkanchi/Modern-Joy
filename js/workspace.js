/**
 * SCRUMMER — Workspace Engine
 * Handles real-time ceremony inputs, persistence, and signal sync.
 */

(function(){
  const $ = (id) => document.getElementById(id);

  // --- Premium Storage API ---
  const readLS = (key, fallback = "") => {
    try { 
      const v = localStorage.getItem(key); 
      return (v === null ? fallback : v); 
    } catch(e) { return fallback; }
  };

  const writeLS = (key, value) => {
    try { localStorage.setItem(key, value); } catch(e) {}
  };

  /**
   * Binds a UI element to LocalStorage with auto-save
   */
  function bindValue(id, key) {
    const el = $(id);
    if (!el) return;
    el.value = readLS(key, "");
    el.addEventListener("input", () => {
      writeLS(key, el.value);
      // Trigger a sync if it's a critical planning field
      if (id.startsWith("plan")) syncToSetup();
    });
  }

  /**
   * Pushes Workspace values back to the core Setup engine
   * This ensures Intelligence.html and Workspace.html stay in sync.
   */
  function syncToSetup() {
    const map = [
      ["planCommitted", "committedSP"],
      ["planSprintDays", "sprintDays"],
      ["planTeamMembers", "teamMembers"],
      ["planLeaveDays", "leaveDays"]
    ];

    const data = {};
    map.forEach(([from, to]) => {
      const el = $(from);
      if (el && el.value !== "") data[to] = el.value;
    });

    if (window.Scrummer?.setup?.saveSetup) {
      const existing = window.Scrummer.setup.loadSetup();
      window.Scrummer.setup.saveSetup(Object.assign({}, existing, data));
      
      // Notify other components (like Copilot) to refresh their math
      window.dispatchEvent(new Event('storage'));
    }
  }

  // --- Initialize Workspace Fields ---
  
  // 🚀 Planning & Capacity Inputs
  const planningFields = ["planCommitted", "planSprintDays", "planTeamMembers", "planLeaveDays"];
  planningFields.forEach(id => {
    // Map IDs to internal workspace keys
    bindValue(id, `ws.plan.${id}`);
  });

  // 📝 Ceremony Note-taking
  const noteFields = [
    ["planningNotes", "ws.notes.planning"],
    ["dailyNotes", "ws.notes.daily"],
    ["refineNotes", "ws.notes.refine"],
    ["reviewNotes", "ws.notes.review"],
    ["retroImprove", "ws.notes.retroImprove"],
    ["retroActions", "ws.notes.retroActions"]
  ];
  noteFields.forEach(([id, key]) => bindValue(id, key));

  /**
   * Premium Feedback Handler
   * Provides the "Modern Joy" success pulse
   */
  function wireSave(btnId, msgId, successMsg) {
    const btn = $(btnId); 
    const msg = $(msgId);
    if (!btn) return;

    btn.addEventListener("click", () => {
      syncToSetup();
      if (msg) {
        msg.textContent = successMsg || "Changes Saved";
        msg.style.display = "block";
        msg.style.color = "var(--success)";
        msg.style.fontWeight = "700";
        msg.style.animation = "fadeInUp 0.3s ease";
        
        setTimeout(() => { 
          msg.style.display = "none"; 
        }, 2000);
      }
    });
  }

  // --- Wire Ceremony Actions ---
  wireSave("savePlanning", "msgPlanning", "Planning synced to Intelligence.");
  wireSave("saveDaily", "msgDaily", "Daily notes updated.");
  wireSave("saveRefine", "msgRefine", "Refinement targets saved.");
  wireSave("saveReview", "msgReview", "Stakeholder feedback captured.");
  wireSave("saveRetro", "msgRetro", "Retro action items recorded.");

})();

/* =========================================================
   Scrummer — shell.js (Modern Joy Edition)
   Core Engine: Handles Math, Storage, UI, and Theme Logic
   ========================================================= */

(() => {
  // ----------------------------
  // 1) UI Initialization (Nav & Theme)
  // ----------------------------
  const initUI = () => {
    const themeBtn = document.getElementById('themeToggle');
    
    // THEME LOGIC (BUG 5 FIX)
    const applyTheme = (theme) => {
      if (theme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      if (themeBtn) themeBtn.innerText = `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`;
    };

    // Load initial theme from storage
    const savedTheme = localStorage.getItem('scrummer-theme') || 'light';
    applyTheme(savedTheme);

    // Single Click Listener for Theme Toggle
    if (themeBtn) {
      themeBtn.onclick = () => {
        const isCurrentlyDark = document.body.classList.contains('dark-mode');
        const nextTheme = isCurrentlyDark ? 'light' : 'dark';
        localStorage.setItem('scrummer-theme', nextTheme);
        applyTheme(nextTheme);
      };
    }

    // NAVIGATION HIGHLIGHTING (Restores missing sidebar tabs)
    const page = document.body?.getAttribute("data-page") || "";
    if (page) {
      document.querySelectorAll(".nav-item").forEach(link => {
        const linkPage = link.getAttribute("data-page") || link.getAttribute("href");
        if (linkPage && (linkPage.includes(page) || page.includes(linkPage))) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      });
    }
  };

  // ----------------------------
  // 2) Modern Page Transitions
  // ----------------------------
  const initTransitions = () => {
    const main = document.querySelector('.main');
    if (main) {
      main.style.opacity = '0';
      main.style.transform = 'translateY(8px)';
      main.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      
      requestAnimationFrame(() => {
        main.style.opacity = '1';
        main.style.transform = 'translateY(0)';
      });
    }
  };

  initUI();
  initTransitions();
})();

/* =========================================================
   CORE ANALYTICS ENGINE (Mathematical Logic)
   ========================================================= */
(() => {
  const STORAGE_KEY = "scrummer-setup-v1";
  const SNAP_KEY = "scrummer-snapshots-v1";

  // --- Utility Helpers ---
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
  function safeNum(v){ const n = Number(v); return (Number.isFinite(n) && n >= 0) ? n : 0; }
  
  function mean(arr){
    const a = arr.filter(n => n > 0);
    if (!a.length) return 0;
    return a.reduce((x,y)=>x+y,0) / a.length;
  }
  
  function stdev(arr){
    const a = arr.filter(n => n > 0);
    if (a.length < 2) return 0;
    const m = mean(a);
    const v = a.reduce((s,x)=>s + (x-m)*(x-m), 0) / (a.length - 1);
    return Math.sqrt(v);
  }

  function loadSetup(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  
  function saveSetup(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  function computeSignals(setup){
    const sprintDays = safeNum(setup.sprintDays);
    const teamMembers = safeNum(setup.teamMembers);
    const leaveDays = safeNum(setup.leaveDays);
    const committed = safeNum(setup.committedSP);

    // Velocity History Logic (3 fields) - Bug 1 Fixed
    const velocities = [
      safeNum(setup.v1), 
      safeNum(setup.v2), 
      safeNum(setup.v3)
    ].filter(n => n > 0);

    const avgVelocity = mean(velocities);
    const vol = (avgVelocity > 0) ? (stdev(velocities) / avgVelocity) : 0;

    const idealPD = (sprintDays * teamMembers) || 1;
    const availablePD = Math.max(0, idealPD - leaveDays);
    const availabilityRatio = availablePD / idealPD;

    const capacitySP = avgVelocity > 0 ? (avgVelocity * availabilityRatio) : 0;
    const overcommitRatio = avgVelocity > 0 ? (committed / avgVelocity) : 0;
    const capacityShortfallRatio = capacitySP > 0 ? (committed / capacitySP) : 0;

    const over = clamp((overcommitRatio - 1) * 60, 0, 50);
    const cap = clamp((capacityShortfallRatio - 1) * 50, 0, 35);
    const vola = clamp(vol * 30, 0, 15);

    const riskScore = Math.round(clamp(over + cap + vola, 0, 100));
    const base = committed > 0 ? (capacitySP / committed) * 100 : 0;
    const confidence = Math.round(clamp(base - (vol * 50), 0, 100));

    let capacityHealth = "—";
    if (committed > 0 && capacitySP > 0){
      const ratio = capacitySP / committed;
      if (ratio >= 1.0) capacityHealth = "Healthy";
      else if (ratio >= 0.85) capacityHealth = "At Risk";
      else capacityHealth = "Critical";
    }

    return {
      sprintDays, teamMembers, leaveDays, committed,
      velocities, avgVelocity, capacitySP, vol,
      riskScore, confidence, capacityHealth,
      components: { over, cap, vola },
      focusFactor: availabilityRatio
    };
  }

  // --- Public API ---
  window.Scrummer = window.Scrummer || {};
  window.Scrummer.setup = { loadSetup, saveSetup, STORAGE_KEY };
  window.Scrummer.computeSignals = computeSignals;
})();

/* =========================================================
   Scrummer — shell.js (Modern Joy Edition)
   Core Engine: Handles Math, Storage, UI, and Theme Logic
   ========================================================= */

// Theme Toggle Handler
document.addEventListener('click', (e) => {
    if (e.target.id === 'themeToggle') {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('scrummer-theme', isDark ? 'dark' : 'light');
        e.target.innerText = isDark ? "Theme: Dark" : "Theme: Light";
    }
});

// Load Theme on Startup
if (localStorage.getItem('scrummer-theme') === 'dark') {
    document.body.classList.add('dark-mode');
    setTimeout(() => {
        if(document.getElementById('themeToggle')) 
            document.getElementById('themeToggle').innerText = "Theme: Dark";
    }, 10);
}

(() => {
  // ----------------------------
  // 1) Active Sidebar & Theme Logic
  // ----------------------------
  const initUI = () => {
    // Navigation Highlighting
    const page = document.body?.getAttribute("data-page") || "";
    if (page) {
      document.querySelectorAll(".nav-item").forEach(link => {
        const linkPage = link.getAttribute("data-page") || link.getAttribute("href");
        if (linkPage && linkPage.includes(page)) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      });
    }

    // BUG 5 FIX: Theme Toggle Logic
    const themeBtn = document.getElementById('themeToggle');
    const applyTheme = (theme) => {
      if (theme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      if (themeBtn) themeBtn.innerText = `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`;
    };

    // Initialize Theme from Storage
    const savedTheme = localStorage.getItem('scrummer-theme') || 'light';
    applyTheme(savedTheme);

    // Toggle Listener
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        const currentTheme = isDark ? 'dark' : 'light';
        localStorage.setItem('scrummer-theme', currentTheme);
        applyTheme(currentTheme);
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
  function safeNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
  
  function mean(arr){
    const a = arr.filter(n => Number.isFinite(n) && n > 0);
    if (!a.length) return 0;
    return a.reduce((x,y)=>x+y,0) / a.length;
  }
  
  function stdev(arr){
    const a = arr.filter(n => Number.isFinite(n) && n > 0);
    if (a.length < 2) return 0;
    const m = mean(a);
    const v = a.reduce((s,x)=>s + (x-m)*(x-m), 0) / (a.length - 1);
    return Math.sqrt(v);
  }

  // --- Setup Persistence ---
  function loadSetup(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveSetup(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  /**
   * 🧮 COMPUTE SIGNALS
   */
  function computeSignals(setup){
    const sprintDays = safeNum(setup.sprintDays);
    const teamMembers = safeNum(setup.teamMembers);
    const leaveDays = safeNum(setup.leaveDays);
    const committed = safeNum(setup.committedSP);

    // Velocity History Logic (3 fields)
    const velocities = [
      safeNum(setup.v1), 
      safeNum(setup.v2), 
      safeNum(setup.v3)
    ].filter(n => n > 0);

    const avgVelocity = mean(velocities);
    const vol = (avgVelocity > 0) ? (stdev(velocities) / avgVelocity) : 0;

    // Ideal person-days vs Availability
    const idealPD = sprintDays * teamMembers;
    const availablePD = Math.max(0, idealPD - leaveDays);
    const availabilityRatio = idealPD > 0 ? (availablePD / idealPD) : 0;

    // Capacity in Story Points
    const capacitySP = avgVelocity > 0 ? (avgVelocity * availabilityRatio) : 0;

    // Ratios for Signal Detection
    const overcommitRatio = avgVelocity > 0 ? (committed / avgVelocity) : 0;
    const capacityShortfallRatio = capacitySP > 0 ? (committed / capacitySP) : 0;
    const focusFactor = availabilityRatio;

    // Risk components (Weighted for 0..100 Score)
    const over = clamp((overcommitRatio - 1) * 60, 0, 50);
    const cap = clamp((capacityShortfallRatio - 1) * 50, 0, 35);
    const vola = clamp(vol * 30, 0, 15);

    const riskScore = clamp(over + cap + vola, 0, 100);
    const base = committed > 0 ? (capacitySP / committed) * 100 : 0;
    const confidence = clamp(base - (vol * 50), 0, 100); // Volatility penalty

    let capacityHealth = "—";
    if (committed > 0 && capacitySP > 0){
      const ratio = capacitySP / committed;
      if (ratio >= 1.0) capacityHealth = "Healthy";
      else if (ratio >= 0.85) capacityHealth = "At Risk";
      else capacityHealth = "Critical";
    }

    const riskBand = riskScore <= 30 ? "Low" : (riskScore <= 60 ? "Moderate" : "High");

    return {
      sprintDays, teamMembers, leaveDays, committed,
      velocities, avgVelocity, idealPD, availablePD, availabilityRatio,
      capacitySP, overcommitRatio, capacityShortfallRatio, focusFactor, vol,
      riskScore, riskBand, confidence, capacityHealth,
      components: { over, cap, vola }
    };
  }

  // --- Snapshot Management ---
  function loadSnapshots(){
    try{
      const raw = localStorage.getItem(SNAP_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveSnapshots(arr){ localStorage.setItem(SNAP_KEY, JSON.stringify(arr)); }

  function addSnapshot(snapshot){
    const arr = loadSnapshots();
    arr.unshift(snapshot);
    saveSnapshots(arr.slice(0, 30));
    return arr;
  }

  function makeSnapshot(signals){
    const now = new Date();
    return {
      id: `${now.getTime()}`,
      ts: now.toISOString(),
      committed: signals.committed || 0,
      avgVelocity: signals.avgVelocity || 0,
      capacitySP: signals.capacitySP || 0,
      focusFactor: signals.focusFactor || 0,
      riskScore: signals.riskScore || 0,
      riskBand: signals.riskBand || "—",
      confidence: signals.confidence || 0,
      capacityHealth: signals.capacityHealth || "—",
      vol: signals.vol || 0
    };
  }

  // --- Public API ---
  window.Scrummer = window.Scrummer || {};
  window.Scrummer.setup = { loadSetup, saveSetup, STORAGE_KEY };
  window.Scrummer.snapshots = { loadSnapshots, saveSnapshots, addSnapshot, makeSnapshot, SNAP_KEY };
  window.Scrummer.computeSignals = computeSignals;
})();

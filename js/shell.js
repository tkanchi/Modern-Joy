/* =========================================================
   Scrummer — shell.js (Zero-Bug Master Edition)
   Core Engine: Handles Math, Storage, UI, and Theme Logic
   ========================================================= */

(() => {
    const STORAGE_KEY = "scrummer-setup-v1";

    // ----------------------------
    // 1) UI Initialization (Nav & Theme)
    // ----------------------------
    const initUI = () => {
        const themeBtn = document.getElementById('themeToggle');
        
        // BUG 6 FIX: Theme Persistence
        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            if (themeBtn) themeBtn.innerText = `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`;
        };

        const savedTheme = localStorage.getItem('scrummer-theme') || 'light';
        applyTheme(savedTheme);

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
    // 2) Mathematical Logic (3-Field Velocity)
    // ----------------------------
    const safeNum = (v) => { const n = Number(v); return (Number.isFinite(n) && n >= 0) ? n : 0; };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    const computeSignals = (setup) => {
        const sprintDays = safeNum(setup.sprintDays);
        const teamMembers = safeNum(setup.teamMembers);
        const leaveDays = safeNum(setup.leaveDays);
        const committed = safeNum(setup.committedSP);

        // BUG 1 FIX: Logic for 3 Velocity Fields
        const vels = [
            safeNum(setup.v1), 
            safeNum(setup.v2), 
            safeNum(setup.v3)
        ].filter(v => v > 0);

        const avgVelocity = vels.length ? (vels.reduce((a, b) => a + b) / vels.length) : 0;
        
        // Volatility Calculation (Standard Deviation / Mean)
        let vol = 0;
        if (vels.length > 1) {
            const m = avgVelocity;
            const variance = vels.reduce((s, x) => s + Math.pow(x - m, 2), 0) / (vels.length - 1);
            vol = Math.sqrt(variance) / m;
        }

        // Capacity & Ratios
        const idealPD = (sprintDays * teamMembers) || 1;
        const availablePD = Math.max(0, idealPD - safeNum(leaveDays));
        const availabilityRatio = availablePD / idealPD;
        const capacitySP = avgVelocity * availabilityRatio;

        // Risk Scoring Logic
        const overcommitRatio = avgVelocity > 0 ? (committed / avgVelocity) : 0;
        const capShortfallRatio = capacitySP > 0 ? (committed / capacitySP) : 0;

        const over = clamp((overcommitRatio - 1) * 60, 0, 50);
        const cap = clamp((capShortfallRatio - 1) * 50, 0, 35);
        const vola = clamp(vol * 30, 0, 15);

        const riskScore = Math.round(clamp(over + cap + vola, 0, 100));
        const confidence = Math.round(clamp((committed > 0 ? (capacitySP / committed) * 100 : 0) - (vol * 50), 0, 100));

        let health = "—";
        if (committed > 0 && capacitySP > 0) {
            const ratio = capacitySP / committed;
            if (ratio >= 1.0) health = "Healthy";
            else if (ratio >= 0.85) health = "At Risk";
            else health = "Critical";
        }

        return {
            avgVelocity, vol, riskScore, confidence,
            capacityHealth: health,
            focusFactor: availabilityRatio,
            components: { over, cap, vola },
            overcommitRatio, capacitySP
        };
    };

    // ----------------------------
    // 3) Storage & Public API
    // ----------------------------
    window.Scrummer = {
        setup: {
            loadSetup: () => {
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    return raw ? JSON.parse(raw) : {};
                } catch { return {}; }
            },
            saveSetup: (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)),
            STORAGE_KEY
        },
        computeSignals
    };

    // Boot
    initUI();
})();

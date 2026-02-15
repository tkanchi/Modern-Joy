/**
 * SCRUMMER — Visuals Engine
 * Updates the UI bars and colors based on Metric signals.
 */

const ScrummerUI = {
    // Helper to get color based on value (Green -> Yellow -> Red)
    getHealthColor: (value, isInverse = false) => {
        // isInverse = true for Risk (High is Bad), false for Confidence (High is Good)
        const score = isInverse ? 100 - value : value;
        if (score >= 80) return "#22c55e"; // Success Green
        if (score >= 50) return "#eab308"; // Warning Yellow
        return "#ef4444"; // Danger Red
    },

    updateDashboard: (signals) => {
        // 1. Update Progress Bars
        const bars = [
            { id: "riskBar", val: signals.riskScore, inv: true },
            { id: "confBar", val: signals.confidence, inv: false },
            { id: "capBar", val: (signals.capacitySP / signals.committed) * 100, inv: false }
        ];

        bars.forEach(bar => {
            const el = document.getElementById(bar.id);
            if (el) {
                el.style.width = `${clamp(bar.val, 5, 100)}%`;
                el.style.backgroundColor = ScrummerUI.getHealthColor(bar.val, bar.inv);
            }
        });

        // 2. Update Text Labels
        const labels = {
            "riskScoreLabel": `${signals.riskScore}%`,
            "confScoreLabel": `${Math.round(signals.confidence)}%`,
            "healthLabel": signals.capacityHealth,
            "volatilityLabel": `${Math.round(signals.vol * 100)}%`
        };

        Object.entries(labels).forEach(([id, text]) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        });
    }
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

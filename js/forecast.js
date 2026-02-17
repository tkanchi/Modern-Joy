/* =========================================================
   Scrummer — forecast.js (FULL)
   Works with your updated forecast.html IDs:
   - forecastMode
   - sprintDays, teamMembers, leaveDays, interruptPct
   - v1, v2, v3
   - capacityDaysBox + idealPerMember + holidayDays + spPerDay
   - usePredictability + predictability
   - leavesList + sumLeavesBtn + leavesSumText
   - calcBtn, resetBtn, pullFromSetup, toggleExplain
   - explainBox
   - interruptWarn, leaveWarn, velocityWarn, spikeWarn
   - rawCap, effDays, velPerDay, forecastSp
   - commitSp, formulaBox
   - consRange, likelyRange, stretchRange
   ========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);

  function avg(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function show(id, yes) {
    const el = $(id);
    if (!el) return;
    el.style.display = yes ? "block" : "none";
  }

  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }

  function numFrom(id, fallback = 0) {
    const el = $(id);
    if (!el) return fallback;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function setText(id, text) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
  }

  function setHTML(id, html) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = html;
  }

  // ---------------------------------
  // Leaves import helper (optional)
  // ---------------------------------
  function sumLeavesFromTextarea() {
    const ta = $("leavesList");
    const label = $("leavesSumText");
    if (!label) return 0;

    const raw = (ta?.value || "").trim();
    if (!raw) {
      label.textContent = "Planned Leaves Total: —";
      return 0;
    }

    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const nums = lines
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0);

    const total = nums.reduce((a, b) => a + b, 0);
    label.textContent = `Planned Leaves Total: ${round(total)} days`;
    return total;
  }

  // ---------------------------------
  // Mode UI toggles
  // ---------------------------------
  function setModeUI() {
    const mode = $("forecastMode")?.value || "existing";

    // Show/hide new mode box
    show("capacityDaysBox", mode === "capacityDays");

    // Hide old-only input blocks in new mode
    const oldOnlyInputs = ["interruptPct", "v1", "v2", "v3"];
    oldOnlyInputs.forEach((id) => {
      const el = $(id);
      if (!el) return;
      const container = el.closest("div");
      if (container) container.style.display = (mode === "existing" ? "block" : "none");
    });

    // Hide the entire velocities info-banner in new mode
    const v1 = $("v1");
    if (v1) {
      const banner = v1.closest(".info-banner");
      if (banner) banner.style.display = (mode === "existing" ? "block" : "none");
    }

    // Warnings irrelevant in new mode
    if (mode !== "existing") {
      show("interruptWarn", false);
      show("velocityWarn", false);
      show("spikeWarn", false);
    }

    return mode;
  }

  // ---------------------------------
  // Main calculate (two modes)
  // ---------------------------------
  function calculate() {
    const mode = setModeUI();

    const teamMembers = numFrom("teamMembers", 0);
    let leaveDays = numFrom("leaveDays", 0);

    // ----------------------------
    // MODE A: EXISTING (Velocity-based)
    // ----------------------------
    if (mode === "existing") {
      const sprintDays = numFrom("sprintDays", 0);
      const interruptPctRaw = numFrom("interruptPct", 0);
      const interruptPct = interruptPctRaw / 100;

      const velocities = [
        numFrom("v1", 0),
        numFrom("v2", 0),
        numFrom("v3", 0),
      ].filter((v) => v > 0);

      const rawCap = sprintDays * teamMembers;
      const effectiveBase = rawCap - leaveDays;
      const effDays = effectiveBase * (1 - interruptPct);

      const avgVel = avg(velocities);
      const velPerDay = rawCap > 0 ? avgVel / rawCap : 0;
      const forecast = (effDays > 0 && velPerDay > 0) ? effDays * velPerDay : 0;

      show("interruptWarn", interruptPctRaw > 40);
      show("leaveWarn", rawCap > 0 && leaveDays > rawCap);
      show("velocityWarn", velocities.length < 2);
      show("spikeWarn", avgVel > 0 && forecast > (avgVel * 1.15));

      setText("rawCap", rawCap > 0 ? `Raw Capacity: ${rawCap} team-days` : `Raw Capacity: —`);
      setText("effDays", rawCap > 0 ? `Effective Days: ${round(effDays)} effective team-days` : `Effective Days: —`);

      setText(
        "velPerDay",
        (rawCap > 0 && avgVel > 0)
          ? `Velocity per Team-Day: ${round(velPerDay)} SP / team-day`
          : `Velocity per Team-Day: —`
      );

      setText("forecastSp", forecast > 0 ? `Forecast SP: ${round(forecast)} story points` : `Forecast SP: —`);

      setText("consRange", forecast > 0 ? `Conservative: ${Math.floor(forecast * 0.9)} SP` : `Conservative: —`);
      setText("likelyRange", forecast > 0 ? `Likely: ${Math.round(forecast)} SP` : `Likely: —`);
      setText("stretchRange", forecast > 0 ? `Stretch: ${Math.ceil(forecast * 1.05)} SP` : `Stretch: —`);

      show("commitSp", false);
      setText("commitSp", "Committable SP (Predictability): —");

      setText(
        "formulaBox",
        "Formulas (Existing): Raw = Sprint Days × Members | Effective = (Raw − Leave) × (1 − Interruptions%) | Velocity/Day = Avg Velocity ÷ Raw | Forecast = Effective × Velocity/Day"
      );

      return;
    }

    // ----------------------------
    // MODE B: NEW (Ideal − Holidays − Leaves) × SP/day
    // ----------------------------
    const idealPerMember = numFrom("idealPerMember", 0);
    const holidayDays = numFrom("holidayDays", 0);
    const spPerDay = numFrom("spPerDay", 4);

    // Optional import: if textarea has values, use summed leaves
    const importedLeaves = sumLeavesFromTextarea();
    if (importedLeaves > 0) leaveDays = importedLeaves;

    const usePred = ($("usePredictability")?.value || "no") === "yes";
    const predictability = clamp01(numFrom("predictability", 0.695));

    const teamIdeal = teamMembers * idealPerMember;
    const teamActualDays = teamIdeal - holidayDays - leaveDays;
    const forecast = teamActualDays > 0 ? (teamActualDays * spPerDay) : 0;
    const committable = (usePred && forecast > 0) ? (forecast * predictability) : 0;

    show("leaveWarn", teamIdeal > 0 && (holidayDays + leaveDays) > teamIdeal);

    setText("rawCap", teamIdeal > 0 ? `Team Ideal Capacity: ${round(teamIdeal)} days` : `Team Ideal Capacity: —`);
    setText("effDays", teamIdeal > 0 ? `Team Actual Capacity: ${round(teamActualDays)} days` : `Team Actual Capacity: —`);
    setText("velPerDay", `SP per Productive Day: ${round(spPerDay)} SP/day`);

    setText("forecastSp", forecast > 0 ? `Forecast SP: ${round(forecast)} story points` : `Forecast SP: —`);

    setText("consRange", forecast > 0 ? `Conservative: ${Math.floor(forecast * 0.9)} SP` : `Conservative: —`);
    setText("likelyRange", forecast > 0 ? `Likely: ${Math.round(forecast)} SP` : `Likely: —`);
    setText("stretchRange", forecast > 0 ? `Stretch: ${Math.ceil(forecast * 1.05)} SP` : `Stretch: —`);

    show("commitSp", usePred);
    if (usePred) {
      setText(
        "commitSp",
        forecast > 0
          ? `Committable SP (Predictability): ${round(committable)} SP (× ${round(predictability)})`
          : `Committable SP (Predictability): —`
      );
    } else {
      setText("commitSp", "Committable SP (Predictability): —");
    }

    setHTML(
      "formulaBox",
      `<div style="font-weight:900; margin-bottom:6px; color:var(--text-main);">Formulas (New Model)</div>
       <div>Actual Capacity (days) = Ideal Capacity − Public Holidays − Planned Leaves</div>
       <div>Team Ideal Capacity (days) = Team Members × Ideal Capacity per Member</div>
       <div>Team Actual Capacity (days) = Team Ideal − Holidays − Leaves</div>
       <div>Forecast SP = Team Actual Capacity × SP/day</div>
       <div>Committable SP = Forecast SP × Predictability (optional)</div>`
    );
  }

  // ---------------------------------
  // Wire events safely
  // ---------------------------------
  function wire() {
    $("calcBtn")?.addEventListener("click", calculate);
    $("forecastMode")?.addEventListener("change", calculate);

    $("sumLeavesBtn")?.addEventListener("click", () => {
      const total = sumLeavesFromTextarea();
      const leaveEl = $("leaveDays");
      if (total > 0 && leaveEl) leaveEl.value = round(total);
      calculate();
    });

    // Live recalc for new model fields
    ["idealPerMember", "holidayDays", "spPerDay", "predictability", "leavesList"]
      .forEach((id) => $(id)?.addEventListener("input", calculate));

    $("usePredictability")?.addEventListener("change", calculate);

    $("resetBtn")?.addEventListener("click", () => {
      document.querySelectorAll("input.fun-input").forEach((i) => (i.value = ""));
      const ta = $("leavesList");
      if (ta) ta.value = "";
      calculate();
    });

    $("pullFromSetup")?.addEventListener("click", () => {
      const setup = JSON.parse(localStorage.getItem("scrummer_setup_v1") || "{}");
      if (setup) {
        if ($("sprintDays")) $("sprintDays").value = setup.sprintDays || "";
        if ($("teamMembers")) $("teamMembers").value = setup.teamMembers || "";
        if ($("leaveDays")) $("leaveDays").value = setup.leaveDays || "";
        if ($("v1")) $("v1").value = setup.v1 || "";
        if ($("v2")) $("v2").value = setup.v2 || "";
        if ($("v3")) $("v3").value = setup.v3 || "";
      }
      calculate();
    });

    $("toggleExplain")?.addEventListener("click", () => {
      const box = $("explainBox");
      const btn = $("toggleExplain");
      if (!box || !btn) return;
      const open = box.style.display === "block";
      box.style.display = open ? "none" : "block";
      btn.textContent = open ? "Show Details" : "Hide Details";
    });

    // Init
    calculate();
  }

  // Run when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();

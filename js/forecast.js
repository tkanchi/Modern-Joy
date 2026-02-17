/* =========================================================
   Scrummer — forecast.js
   - Supports 2 forecast modes:
     1) Existing (Velocity-based) [your current logic]
     2) New: Capacity Days × SP/day (Ideal − Holidays − Leaves)
   - Keeps existing logic intact as an option
   - Works with your current forecast.html IDs
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

  // ----------------------------
  // Leaves import helper (optional)
  // ----------------------------
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

  // ----------------------------
  // Mode UI toggles
  // ----------------------------
  function setModeUI() {
    const mode = $("forecastMode")?.value || "existing";

    // Show/hide new inputs box
    show("capacityDaysBox", mode === "capacityDays");

    // Hide old-only inputs when new mode selected
    // (your HTML structure wraps each input in its own <div>, so closest("div") works)
    const oldOnlyInputs = ["interruptPct", "v1", "v2", "v3"];
    oldOnlyInputs.forEach((id) => {
      const el = $(id);
      if (!el) return;
      const container = el.closest("div");
      if (container) container.style.display = (mode === "existing" ? "block" : "none");
    });

    // Hide the velocities info-banner as a whole in new mode
    const v1 = $("v1");
    if (v1) {
      const banner = v1.closest(".info-banner");
      if (banner) banner.style.display = (mode === "existing" ? "block" : "none");
    }

    // Existing warnings irrelevant in new mode
    if (mode !== "existing") {
      show("interruptWarn", false);
      show("velocityWarn", false);
      show("spikeWarn", false);
    }

    return mode;
  }

  // ----------------------------
  // Main calculation (2 modes)
  // ----------------------------
  function calculate() {
    const mode = setModeUI();

    // Shared inputs
    const teamMembers = Number($("teamMembers")?.value) || 0;
    let leaveDays = Number($("leaveDays")?.value) || 0;

    // ----------------------------
    // MODE A: EXISTING (Velocity-based)
    // ----------------------------
    if (mode === "existing") {
      const sprintDays = Number($("sprintDays")?.value) || 0;

      const interruptPctRaw = Number($("interruptPct")?.value) || 0;
      const interruptPct = interruptPctRaw / 100;

      const velocities = [
        Number($("v1")?.value),
        Number($("v2")?.value),
        Number($("v3")?.value),
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

      if ($("rawCap")) $("rawCap").textContent =
        rawCap > 0 ? `Raw Capacity: ${rawCap} team-days` : `Raw Capacity: —`;

      if ($("effDays")) $("effDays").textContent =
        rawCap > 0 ? `Effective Days: ${round(effDays)} effective team-days` : `Effective Days: —`;

      if ($("velPerDay")) $("velPerDay").textContent =
        (rawCap > 0 && avgVel > 0)
          ? `Velocity per Team-Day: ${round(velPerDay)} SP / team-day`
          : `Velocity per Team-Day: —`;

      if ($("forecastSp")) $("forecastSp").textContent =
        forecast > 0 ? `Forecast SP: ${round(forecast)} story points` : `Forecast SP: —`;

      if ($("consRange")) $("consRange").textContent =
        forecast > 0 ? `Conservative: ${Math.floor(forecast * 0.9)} SP` : `Conservative: —`;

      if ($("likelyRange")) $("likelyRange").textContent =
        forecast > 0 ? `Likely: ${Math.round(forecast)} SP` : `Likely: —`;

      if ($("stretchRange")) $("stretchRange").textContent =
        forecast > 0 ? `Stretch: ${Math.ceil(forecast * 1.05)} SP` : `Stretch: —`;

      // New-model outputs hidden
      show("commitSp", false);
      if ($("commitSp")) $("commitSp").textContent = "Committable SP (Predictability): —";

      if ($("formulaBox")) {
        $("formulaBox").textContent =
          "Formulas (Existing): Raw = Sprint Days × Members | Effective = (Raw − Leave) × (1 − Interruptions%) | Velocity/Day = Avg Velocity ÷ Raw | Forecast = Effective × Velocity/Day";
      }

      return;
    }

    // ----------------------------
    // MODE B: NEW (Ideal − Holidays − Leaves) × SP/day
    // ----------------------------
    const idealPerMember = Number($("idealPerMember")?.value) || 0;
    const holidayDays = Number($("holidayDays")?.value) || 0;
    const spPerDay = Number($("spPerDay")?.value) || 4;

    // Optional import: if textarea has values, use summed leaves
    const importedLeaves = sumLeavesFromTextarea();
    if (importedLeaves > 0) leaveDays = importedLeaves;

    const usePred = ($("usePredictability")?.value || "no") === "yes";
    const predictability = clamp01(Number($("predictability")?.value) || 0.695);

    // Team Ideal Capacity = Members × Ideal per member
    const teamIdeal = teamMembers * idealPerMember;

    // Team Actual Capacity = Team Ideal − Holidays − Leaves
    const teamActualDays = teamIdeal - holidayDays - leaveDays;

    // Forecast SP = Team Actual Days × SP/day
    const forecast = teamActualDays > 0 ? (teamActualDays * spPerDay) : 0;

    // Optional: Committable SP
    const committable = (usePred && forecast > 0) ? (forecast * predictability) : 0;

    // Warning: holidays+leaves exceed ideal
    show("leaveWarn", teamIdeal > 0 && (holidayDays + leaveDays) > teamIdeal);

    // Reuse existing output slots with new labels
    if ($("rawCap")) $("rawCap").textContent =
      teamIdeal > 0 ? `Team Ideal Capacity: ${round(teamIdeal)} days` : `Team Ideal Capacity: —`;

    if ($("effDays")) $("effDays").textContent =
      teamIdeal > 0 ? `Team Actual Capacity: ${round(teamActualDays)} days` : `Team Actual Capacity: —`;

    if ($("velPerDay")) $("velPerDay").textContent =
      `SP per Productive Day: ${round(spPerDay)} SP/day`;

    if ($("forecastSp")) $("forecastSp").textContent =
      forecast > 0 ? `Forecast SP: ${round(forecast)} story points` : `Forecast SP: —`;

    if ($("consRange")) $("consRange").textContent =
      forecast > 0 ? `Conservative: ${Math.floor(forecast * 0.9)} SP` : `Conservative: —`;

    if ($("likelyRange")) $("likelyRange").textContent =
      forecast > 0 ? `Likely: ${Math.round(forecast)} SP` : `Likely: —`;

    if ($("stretchRange")) $("stretchRange").textContent =
      forecast > 0 ? `Stretch: ${Math.ceil(forecast * 1.05)} SP` : `Stretch: —`;

    show("commitSp", usePred);
    if ($("commitSp")) {
      $("commitSp").textContent = usePred
        ? (forecast > 0
            ? `Committable SP (Predictability): ${round(committable)} SP (× ${round(predictability)})`
            : `Committable SP (Predictability): —`)
        : "Committable SP (Predictability): —";
    }

    if ($("formulaBox")) {
      $("formulaBox").innerHTML =
        `<div style="font-weight:900; margin-bottom:6px; color:var(--text-main);">Formulas (New Model)</div>
         <div>Actual Capacity (days) = Ideal Capacity − Public Holidays − Planned Leaves</div>
         <div>Team Ideal Capacity (days) = Team Members × Ideal Capacity per Member</div>
         <div>Team Actual Capacity (days) = Team Ideal − Holidays − Leaves</div>
         <div>Forecast SP = Team Actual Capacity × SP/day</div>
         <div>Committable SP = Forecast SP × Predictability (optional)</div>`;
    }
  }

  // ----------------------------
  // Wire events (safe if elements missing)
  // ----------------------------
  function wire() {
    $("calcBtn")?.addEventListener("click", calculate);

    $("forecastMode")?.addEventListener("change", calculate);

    // Live recalc for new fields
    ["idealPerMember", "holidayDays", "spPerDay", "usePredictability", "predictability", "leavesList"]
      .forEach((id) => $(id)?.addEventListener("input", calculate));

    $("sumLeavesBtn")?.addEventListener("click", () => {
      const total = sumLeavesFromTextarea();
      if (total > 0 && $("leaveDays")) $("leaveDays").value = round(total);
      calculate();
    });

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

    // Initial render
    calculate();
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();

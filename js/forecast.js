/* =========================================================
   Scrummer — forecast.js (CLEAN FINAL)
   ONLY:
   1) Velocity Forecast: avg of N, N-1, N-2
   2) Capacity Forecast (your exact logic):
      idealPerPersonDays = sprintDays * focusFactor
      totalIdealDays = teamCount * idealPerPersonDays
      totalActualDays = totalIdealDays - (leaves * weight)
      forecastSP = totalActualDays * spPerDay
   ========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);

  const round2 = (n) => Math.round(n * 100) / 100;

  function show(el, yes){
    if(!el) return;
    el.style.display = yes ? "block" : "none";
  }

  function num(id, fallback = 0){
    const el = $(id);
    if(!el) return fallback;
    const v = Number(el.value);
    return Number.isFinite(v) ? v : fallback;
  }

  function setText(id, text){
    const el = $(id);
    if(el) el.textContent = text;
  }

  function setHTML(id, html){
    const el = $(id);
    if(el) el.innerHTML = html;
  }

  function setModeUI(){
    const mode = $("forecastMode")?.value || "capacity";
    show($("velocityBox"), mode === "velocity");
    show($("capacityBox"), mode === "capacity");
    return mode;
  }

  function warn(msg){
    setText("warnText", msg);
    show($("warnBox"), true);
  }

  function clearWarn(){
    show($("warnBox"), false);
    setText("warnText", "");
  }

  function calcVelocity(){
    clearWarn();

    const n  = num("velN", 0);
    const n1 = num("velN1", 0);
    const n2 = num("velN2", 0);

    // allow zeros but warn if all empty
    if(n === 0 && n1 === 0 && n2 === 0){
      warn("Enter Sprint N, N-1, and N-2 velocities to calculate the average.");
    }

    const avgVel = (n + n1 + n2) / 3;

    setText("resultTitle", "🔵 Velocity Forecast");
    setText("resultMain", `Forecast SP = ${round2(avgVel)} SP`);

    setHTML("formulaBox", `
      <div style="font-weight:900; color:var(--text-main); margin-bottom:6px;">Formulas</div>
      <div>Average Velocity = (Sprint N + Sprint N-1 + Sprint N-2) / 3</div>
      <div style="margin-top:8px;">
        = (${round2(n)} + ${round2(n1)} + ${round2(n2)}) / 3
        = <b>${round2(avgVel)}</b>
      </div>
    `);
  }

  function calcCapacity(){
    clearWarn();

    const sprintDays   = num("sprintDays", 0);
    const focusFactor  = num("focusFactor", 0);
    const teamCount    = num("teamCount", 0);
    const spPerDay     = num("spPerDay", 0);
    const leaves       = num("leaves", 0);
    const weightRaw    = num("weight", 0);

    const weight = Math.max(0, Math.min(1, weightRaw));

    if(sprintDays <= 0) return warn("Sprint Days must be > 0.");
    if(teamCount <= 0) return warn("Team Count must be > 0.");
    if(spPerDay <= 0) return warn("SP/day must be > 0.");
    if(focusFactor < 0 || focusFactor > 1) return warn("Focus Factor must be between 0 and 1.");
    if(weightRaw < 0 || weightRaw > 1) return warn("Unavailability Weight must be between 0 and 1.");
    if(leaves < 0) return warn("Leaves cannot be negative.");

    // ✅ Your exact steps
    const idealPerPersonDays = sprintDays * focusFactor;
    const totalIdealDays = teamCount * idealPerPersonDays;
    const totalActualDays = totalIdealDays - (leaves * weight);

    if(totalActualDays < 0){
      warn("Total Actual Capacity (Days) became negative. Reduce Leaves, Weight, or increase Days/Team/Focus.");
    }

    const totalIdealSP = totalIdealDays * spPerDay;
    const forecastSP = Math.max(0, totalActualDays) * spPerDay;

    setText("resultTitle", "🟢 Capacity Forecast (Focus + Leaves Weight)");
    setText("resultMain", `Forecast SP = ${round2(forecastSP)} SP`);

    setHTML("formulaBox", `
      <div style="font-weight:900; color:var(--text-main); margin-bottom:6px;">Formulas (Exactly as requested)</div>

      <div><b>1) Ideal Capacity (Days per person)</b></div>
      <div>Ideal = Sprint Days × Focus Factor</div>
      <div>= ${round2(sprintDays)} × ${round2(focusFactor)} = <b>${round2(idealPerPersonDays)}</b></div>

      <div style="margin-top:10px;"><b>2) Total Ideal Capacity (Days)</b></div>
      <div>Total Ideal Days = Team Count × Ideal</div>
      <div>= ${round2(teamCount)} × ${round2(idealPerPersonDays)} = <b>${round2(totalIdealDays)}</b></div>

      <div style="margin-top:10px;"><b>3) Total Ideal Capacity (SP)</b></div>
      <div>Total Ideal SP = Total Ideal Days × SP/day</div>
      <div>= ${round2(totalIdealDays)} × ${round2(spPerDay)} = <b>${round2(totalIdealSP)}</b></div>

      <div style="margin-top:10px;"><b>4) Total Actual Capacity (Days)</b></div>
      <div>Total Actual Days = Total Ideal Days − (Leaves × Weight)</div>
      <div>= ${round2(totalIdealDays)} − (${round2(leaves)} × ${round2(weight)})</div>
      <div>= ${round2(totalIdealDays)} − ${round2(leaves * weight)} = <b>${round2(totalActualDays)}</b></div>

      <div style="margin-top:10px;"><b>5) Total Actual Capacity (SP)</b></div>
      <div>Forecast SP = Total Actual Days × SP/day</div>
      <div>= ${round2(Math.max(0, totalActualDays))} × ${round2(spPerDay)} = <b>${round2(forecastSP)}</b></div>
    `);
  }

  function calculate(){
    const mode = setModeUI();
    if(mode === "velocity") return calcVelocity();
    return calcCapacity();
  }

  function reset(){
    document.querySelectorAll("input.fun-input").forEach(i => i.value = "");
    // sensible defaults
    if($("focusFactor")) $("focusFactor").value = "0.60";
    if($("spPerDay")) $("spPerDay").value = "4";
    if($("weight")) $("weight").value = "0.50";
    calculate();
  }

  function wire(){
    $("forecastMode")?.addEventListener("change", calculate);
    $("calcBtn")?.addEventListener("click", calculate);
    $("resetBtn")?.addEventListener("click", reset);

    // Live recalculation on input changes
    [
      "velN","velN1","velN2",
      "sprintDays","focusFactor","teamCount","spPerDay","leaves","weight"
    ].forEach(id => $(id)?.addEventListener("input", calculate));

    calculate();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
/* =========================================================
   Scrummer — forecast.js (FINAL + ROLES SAFE)
   ONLY:
   1) Velocity Forecast: avg of N, N-1, N-2
   2) Capacity Forecast (your exact logic):
      idealPerPersonDays = sprintDays * focusFactor
      totalIdealDays = teamCount * idealPerPersonDays
      totalActualDays = totalIdealDays - (leaves * weight)
      forecastSP = totalActualDays * spPerDay

   + Optional Roles:
      - If roles exist, auto-calc:
        teamCount = sum(roleMembers)
        leaves    = sum(roleLeaves)
      - Also show per-role ideal/actual days + SP
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

  // ---------------------------
  // Roles helpers (OPTIONAL)
  // ---------------------------
  function getRoleRows(){
    const wrap = $("rolesContainer");
    if(!wrap) return [];
    return Array.from(wrap.querySelectorAll(".roleRow"));
  }

  function roleTotals(){
    const rows = getRoleRows();
    let members = 0;
    let leaves = 0;

    rows.forEach(r => {
      const m = Number(r.querySelector(".roleMembers")?.value || 0) || 0;
      const l = Number(r.querySelector(".roleLeaves")?.value || 0) || 0;
      if(m > 0) members += m;
      if(l > 0) leaves += l;
    });

    return { members, leaves, hasRoles: rows.length > 0 };
  }

  function applyRolesAutofill(){
    const t = roleTotals();

    const teamEl = $("teamCount");
    const leavesEl = $("leaves");

    const teamHint = $("teamCountHint");
    const leavesHint = $("leavesHint");

    if(!teamEl || !leavesEl) return t;

    if(t.hasRoles){
      // lock these to role totals
      teamEl.value = t.members;
      leavesEl.value = round2(t.leaves);

      teamEl.readOnly = true;
      leavesEl.readOnly = true;

      show(teamHint, true);
      show(leavesHint, true);
    } else {
      teamEl.readOnly = false;
      leavesEl.readOnly = false;

      show(teamHint, false);
      show(leavesHint, false);
    }

    return t;
  }

  function addRoleRow(name="Dev", members="", leaves=""){
    const wrap = $("rolesContainer");
    if(!wrap) return;

    const row = document.createElement("div");
    row.className = "roleRow";
    row.style.border = "1px solid var(--border)";
    row.style.borderRadius = "16px";
    row.style.padding = "12px";
    row.style.background = "var(--bg-card)";

    row.innerHTML = `
      <div style="display:grid; gap:10px;">
        <div style="display:grid; grid-template-columns:1fr 140px; gap:10px;">
          <div>
            <div style="font-weight:900; margin-bottom:6px;">Role</div>
            <input class="fun-input roleName" placeholder="e.g., Dev / QA / BA" value="${name}">
          </div>
          <div>
            <div style="font-weight:900; margin-bottom:6px;">Members</div>
            <input class="fun-input roleMembers" type="number" min="0" step="1" placeholder="0" value="${members}">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 140px; gap:10px; align-items:end;">
          <div>
            <div style="font-weight:900; margin-bottom:6px;">Leaves (person-days)</div>
            <input class="fun-input roleLeaves" type="number" min="0" step="0.5" placeholder="0" value="${leaves}">
          </div>
          <button class="btnGhost removeRoleBtn" type="button">Remove</button>
        </div>
      </div>
    `;

    wrap.appendChild(row);

    row.querySelector(".removeRoleBtn").addEventListener("click", () => {
      row.remove();
      calculate();
    });

    row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", calculate));

    calculate();
  }

  // ---------------------------
  // Velocity calculation
  // ---------------------------
  function calcVelocity(){
    clearWarn();

    const n  = num("velN", 0);
    const n1 = num("velN1", 0);
    const n2 = num("velN2", 0);

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

  // ---------------------------
  // Capacity calculation (exact + roles)
  // ---------------------------
  function calcCapacity(){
    clearWarn();

    // Apply roles autofill if roles exist
    const roleMeta = applyRolesAutofill();

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

    // Per-role breakdown (only if roles exist)
    let roleBreakdownHTML = "";
    if(roleMeta.hasRoles){
      const rows = getRoleRows();

      roleBreakdownHTML = `
        <div style="margin-top:14px; font-weight:900; color:var(--text-main);">Role Breakdown</div>
      `;

      rows.forEach((r) => {
        const roleName = (r.querySelector(".roleName")?.value || "Role").trim() || "Role";
        const m = Number(r.querySelector(".roleMembers")?.value || 0) || 0;
        const l = Number(r.querySelector(".roleLeaves")?.value || 0) || 0;

        const roleIdealDays = m * idealPerPersonDays;
        const roleActualDays = roleIdealDays - (l * weight);
        const roleSP = Math.max(0, roleActualDays) * spPerDay;

        roleBreakdownHTML += `
          <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border);">
            <div style="font-weight:900; color:var(--text-main);">${roleName}</div>
            <div>Ideal Days = ${round2(m)} × ${round2(idealPerPersonDays)} = <b>${round2(roleIdealDays)}</b></div>
            <div>Actual Days = ${round2(roleIdealDays)} − (${round2(l)} × ${round2(weight)}) = <b>${round2(roleActualDays)}</b></div>
            <div>Actual SP = max(0, ${round2(roleActualDays)}) × ${round2(spPerDay)} = <b>${round2(roleSP)}</b></div>
          </div>
        `;
      });
    }

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

      ${roleBreakdownHTML}
    `);
  }

  function calculate(){
    const mode = setModeUI();
    if(mode === "velocity") return calcVelocity();
    return calcCapacity();
  }

  function reset(){
    // Clear inputs
    document.querySelectorAll("input.fun-input").forEach(i => i.value = "");

    // Remove roles
    const wrap = $("rolesContainer");
    if(wrap) wrap.innerHTML = "";

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

    $("addRoleBtn")?.addEventListener("click", () => addRoleRow("Role", "", ""));

    // Live recalculation on input changes
    [
      "velN","velN1","velN2",
      "sprintDays","focusFactor","teamCount","spPerDay","leaves","weight"
    ].forEach(id => $(id)?.addEventListener("input", calculate));

    // start clean
    calculate();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
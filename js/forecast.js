/* =========================================================
   Scrummer — forecast.js (FINAL + ROLES + STORAGE + SUMMARY)
   FIXES:
   ✅ Formulas reference should be always visible (keep in HTML: #formulaReference)
   ✅ Actual calculations should render separately into #formulaActual
   ========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const round2 = (n) => Math.round(n * 100) / 100;

  const LS_KEY = "scrummer_forecast_roles_v1";

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
  // Roles: storage
  // ---------------------------
  function saveRoles(){
    const rows = getRoleRows();
    const roles = rows.map(r => ({
      name: (r.querySelector(".roleName")?.value || "Role").trim(),
      members: Number(r.querySelector(".roleMembers")?.value || 0) || 0,
      leaves: Number(r.querySelector(".roleLeaves")?.value || 0) || 0,
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(roles));
  }

  function loadRoles(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr)) return [];
      return arr.map(x => ({
        name: String(x?.name ?? "Role"),
        members: Number(x?.members ?? 0) || 0,
        leaves: Number(x?.leaves ?? 0) || 0,
      }));
    } catch {
      return [];
    }
  }

  // ---------------------------
  // Roles: helpers
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

    return { members, leaves, hasRoles: rows.length > 0, count: rows.length };
  }

  function updateRoleTags(){
    const t = roleTotals();
    setText("rolesCountTag", `Roles: ${t.count}`);
    setText("rolesMembersTag", `Members: ${round2(t.members)}`);
    setText("rolesLeavesTag", `Leaves: ${round2(t.leaves)}`);
  }

  function applyRolesAutofill(){
    const t = roleTotals();

    const teamEl = $("teamCount");
    const leavesEl = $("leaves");
    const teamHint = $("teamCountHint");
    const leavesHint = $("leavesHint");

    if(!teamEl || !leavesEl) return t;

    if(t.hasRoles){
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

  function makeRoleRow({name="Role", members="", leaves=""} = {}){
    const row = document.createElement("div");
    row.className = "roleRow";

    row.innerHTML = `
      <div class="roleRowTop">
        <div>
          <div style="font-weight:900; margin-bottom:6px;">Role</div>
          <input class="fun-input roleName" placeholder="e.g., Dev / QA / BA" value="${escapeHtml(name)}">
        </div>

        <div>
          <div style="font-weight:900; margin-bottom:6px;">Members</div>
          <input class="fun-input roleMembers mono" type="number" min="0" step="1" placeholder="0" value="${members}">
        </div>

        <div>
          <div style="font-weight:900; margin-bottom:6px;">Leaves</div>
          <input class="fun-input roleLeaves mono" type="number" min="0" step="0.5" placeholder="0" value="${leaves}">
        </div>

        <button class="iconBtn removeRoleBtn" type="button" title="Remove role">✖</button>
      </div>
    `;

    row.querySelector(".removeRoleBtn").addEventListener("click", () => {
      row.remove();
      saveRoles();
      calculate();
    });

    row.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", () => {
        saveRoles();
        calculate();
      });
    });

    return row;
  }

  function addRoleRow(role){
    const wrap = $("rolesContainer");
    if(!wrap) return;
    wrap.appendChild(makeRoleRow(role));
    saveRoles();
    calculate();
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ---------------------------
  // NEW: Render helper for “Your Calculation”
  // (writes into #formulaActual only)
  // ---------------------------
  function showCalcPlaceholder(mode){
    const el = $("formulaActual");
    if(!el) return;

    const msg = mode === "velocity"
      ? "Enter Sprint N, N-1 and N-2 velocities, then click Calculate to see the step-by-step average."
      : "Enter values, then click Calculate to see your step-by-step capacity forecast.";

    setHTML("formulaActual", `
      <div style="font-weight:900; margin-bottom:6px;">🧮 Your Calculation</div>
      <div style="color:var(--text-muted); font-weight:800; line-height:1.6;">
        ${msg}
      </div>
    `);
  }

  // ---------------------------
  // Velocity
  // ---------------------------
  function calcVelocity(){
    clearWarn();
    show($("summaryGrid"), false);

    const n  = num("velN", 0);
    const n1 = num("velN1", 0);
    const n2 = num("velN2", 0);

    if(n === 0 && n1 === 0 && n2 === 0){
      warn("Enter Sprint N, N-1, and N-2 velocities to calculate the average.");
      showCalcPlaceholder("velocity");
      setText("resultTitle", "🔵 Velocity Forecast");
      setText("resultMain", "Forecast SP = 0 SP");
      return;
    }

    const avgVel = (n + n1 + n2) / 3;

    setText("resultTitle", "🔵 Velocity Forecast");
    setText("resultMain", `Forecast SP = ${round2(avgVel)} SP`);

    // ✅ Write ONLY actual calculation to #formulaActual
    setHTML("formulaActual", `
      <div style="font-weight:900; margin-bottom:6px;">🧮 Your Calculation</div>
      <div><b>Average Velocity</b> = (Sprint N + Sprint N-1 + Sprint N-2) / 3</div>
      <div style="margin-top:8px;">
        = (${round2(n)} + ${round2(n1)} + ${round2(n2)}) / 3
        = <b>${round2(avgVel)}</b>
      </div>
    `);
  }

  // ---------------------------
  // Capacity (exact + summaries)
  // ---------------------------
  function renderTeamSummary({
    sprintDays, focusFactor, teamCount, spPerDay, leaves, weight,
    idealPerPersonDays, totalIdealDays, totalActualDays, forecastSP
  }){
    setHTML("teamSummary", `
      <div class="kvRow"><div class="kvLabel">Ideal days/person</div><div class="kvVal mono">${round2(idealPerPersonDays)}</div></div>
      <div class="kvRow"><div class="kvLabel">Total ideal days</div><div class="kvVal mono">${round2(totalIdealDays)}</div></div>
      <div class="kvRow"><div class="kvLabel">Leaves × weight</div><div class="kvVal mono">${round2(leaves)} × ${round2(weight)} = ${round2(leaves * weight)}</div></div>
      <div class="kvRow"><div class="kvLabel">Total actual days</div><div class="kvVal mono">${round2(totalActualDays)}</div></div>
      <div class="kvRow"><div class="kvLabel">Forecast SP</div><div class="kvVal mono">${round2(forecastSP)}</div></div>
    `);
  }

  function renderRoleSummary({ idealPerPersonDays, spPerDay, weight }){
    const rows = getRoleRows();
    if(!rows.length){
      setHTML("roleSummary", `<div style="color:var(--text-muted); font-weight:800;">No roles added.</div>`);
      return;
    }

    let body = "";
    rows.forEach(r => {
      const roleName = (r.querySelector(".roleName")?.value || "Role").trim() || "Role";
      const m = Number(r.querySelector(".roleMembers")?.value || 0) || 0;
      const l = Number(r.querySelector(".roleLeaves")?.value || 0) || 0;

      const roleIdealDays = m * idealPerPersonDays;
      const roleActualDays = roleIdealDays - (l * weight);
      const roleSP = Math.max(0, roleActualDays) * spPerDay;

      body += `
        <tr>
          <td>${escapeHtml(roleName)}</td>
          <td class="tableRight mono">${round2(m)}</td>
          <td class="tableRight mono">${round2(Math.max(0, roleActualDays))}</td>
          <td class="tableRight mono">${round2(roleSP)}</td>
        </tr>
      `;
    });

    setHTML("roleSummary", `
      <table class="tableMini">
        <thead>
          <tr>
            <th>Role</th>
            <th class="tableRight">Members</th>
            <th class="tableRight">Actual Days</th>
            <th class="tableRight">SP</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `);
  }

  function calcCapacity(){
    clearWarn();

    updateRoleTags();
    const roleMeta = applyRolesAutofill();

    const sprintDays   = num("sprintDays", 0);
    const focusFactor  = num("focusFactor", 0);
    const teamCount    = num("teamCount", 0);
    const spPerDay     = num("spPerDay", 0);
    const leaves       = num("leaves", 0);
    const weightRaw    = num("weight", 0);
    const weight = Math.max(0, Math.min(1, weightRaw));

    if(sprintDays <= 0) { showCalcPlaceholder("capacity"); return warn("Sprint Days must be > 0."); }
    if(teamCount <= 0)  { showCalcPlaceholder("capacity"); return warn("Team Count must be > 0."); }
    if(spPerDay <= 0)   { showCalcPlaceholder("capacity"); return warn("SP/day must be > 0."); }
    if(focusFactor < 0 || focusFactor > 1) { showCalcPlaceholder("capacity"); return warn("Focus Factor must be between 0 and 1."); }
    if(weightRaw < 0 || weightRaw > 1)     { showCalcPlaceholder("capacity"); return warn("Unavailability Weight must be between 0 and 1."); }
    if(leaves < 0) { showCalcPlaceholder("capacity"); return warn("Leaves cannot be negative."); }

    // ✅ EXACT logic (unchanged)
    const idealPerPersonDays = sprintDays * focusFactor;
    const totalIdealDays = teamCount * idealPerPersonDays;
    const totalActualDays = totalIdealDays - (leaves * weight);
    const forecastSP = Math.max(0, totalActualDays) * spPerDay;

    if(totalActualDays < 0){
      warn("Total Actual Capacity (Days) became negative. Reduce Leaves, Weight, or increase Days/Team/Focus.");
    }

    setText("resultTitle", "🟢 Capacity Forecast (Focus + Leaves Weight)");
    setText("resultMain", `Forecast SP = ${round2(forecastSP)} SP`);

    show($("summaryGrid"), true);

    renderTeamSummary({
      sprintDays, focusFactor, teamCount, spPerDay, leaves, weight,
      idealPerPersonDays, totalIdealDays, totalActualDays, forecastSP
    });

    renderRoleSummary({ idealPerPersonDays, spPerDay, weight });

    // ✅ Write ONLY actual calculation to #formulaActual (reference stays in HTML)
    setHTML("formulaActual", `
      <div style="font-weight:900; color:var(--text-main); margin-bottom:6px;">🧮 Your Calculation</div>

      <div><b>1) Ideal Capacity (Days per person)</b></div>
      <div>= ${round2(sprintDays)} × ${round2(focusFactor)} = <b>${round2(idealPerPersonDays)}</b></div>

      <div style="margin-top:10px;"><b>2) Total Ideal Capacity (Days)</b></div>
      <div>= ${round2(teamCount)} × ${round2(idealPerPersonDays)} = <b>${round2(totalIdealDays)}</b></div>

      <div style="margin-top:10px;"><b>3) Total Actual Capacity (Days)</b></div>
      <div>= ${round2(totalIdealDays)} − (${round2(leaves)} × ${round2(weight)})</div>
      <div>= ${round2(totalIdealDays)} − ${round2(leaves * weight)} = <b>${round2(totalActualDays)}</b></div>

      <div style="margin-top:10px;"><b>4) Total Actual Capacity (SP)</b></div>
      <div>= max(0, ${round2(totalActualDays)}) × ${round2(spPerDay)}</div>
      <div>= <b>${round2(forecastSP)}</b></div>

      ${roleMeta.hasRoles ? `<div style="margin-top:10px; color:var(--text-muted); font-weight:800;">
        Role totals auto-fill Team Count & Leaves from Roles.
      </div>` : ``}
    `);
  }

  function calculate(){
    const mode = setModeUI();
    if(mode === "velocity") return calcVelocity();
    return calcCapacity();
  }

  function reset(){
    document.querySelectorAll("input.fun-input").forEach(i => i.value = "");

    const wrap = $("rolesContainer");
    if(wrap) wrap.innerHTML = "";
    localStorage.removeItem(LS_KEY);

    if($("focusFactor")) $("focusFactor").value = "0.60";
    if($("spPerDay")) $("spPerDay").value = "4";
    if($("weight")) $("weight").value = "0.50";

    updateRoleTags();
    calculate();
  }

  function wire(){
    $("forecastMode")?.addEventListener("change", calculate);
    $("calcBtn")?.addEventListener("click", calculate);
    $("resetBtn")?.addEventListener("click", reset);

    $("addRoleBtn")?.addEventListener("click", () => addRoleRow({ name:"Role", members:"", leaves:"" }));

    [
      "velN","velN1","velN2",
      "sprintDays","focusFactor","teamCount","spPerDay","leaves","weight"
    ].forEach(id => $(id)?.addEventListener("input", calculate));

    const stored = loadRoles();
    if(stored.length){
      stored.forEach(r => addRoleRow(r));
    } else {
      updateRoleTags();
    }

    // ✅ On load, show placeholder in “Your Calculation”
    showCalcPlaceholder($("forecastMode")?.value || "capacity");

    calculate();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();

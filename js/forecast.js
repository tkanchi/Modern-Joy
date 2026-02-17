/* =========================================================
   SCRUMMER — ROLE BASED CAPACITY FORECAST
   ========================================================= */

(() => {

  const $ = (id) => document.getElementById(id);

  function num(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  let roleIndex = 0;

  // -----------------------------------------
  // ADD ROLE ROW
  // -----------------------------------------
  function addRoleRow(name = "", members = "", leaves = "") {

    const container = $("rolesContainer");

    const row = document.createElement("div");
    row.className = "roleRow";
    row.dataset.index = roleIndex++;

    row.innerHTML = `
      <input class="fun-input roleName" placeholder="Role Name" value="${name}">
      <input class="fun-input roleMembers" type="number" min="0" placeholder="Members" value="${members}">
      <input class="fun-input roleLeaves" type="number" min="0" placeholder="Leaves (person-days)" value="${leaves}">
      <button class="btnGhost removeRole">✕</button>
      <div class="roleResult"></div>
    `;

    container.appendChild(row);

    row.querySelector(".removeRole").addEventListener("click", () => {
      row.remove();
      calculate();
    });

    row.querySelectorAll("input").forEach(input =>
      input.addEventListener("input", calculate)
    );
  }

  // -----------------------------------------
  // MAIN CALCULATION
  // -----------------------------------------
  function calculate() {

    const sprintDays = num($("sprintDays").value);
    const focusFactor = num($("focusFactor").value);
    const spPerDay = num($("spPerDay").value);
    const weight = num($("unavailabilityWeight").value);

    const idealPerMember = sprintDays * focusFactor;

    let totalActualDays = 0;
    let totalActualSP = 0;

    const rows = document.querySelectorAll(".roleRow");

    rows.forEach(row => {

      const roleName = row.querySelector(".roleName").value || "Role";
      const members = num(row.querySelector(".roleMembers").value);
      const leaves = num(row.querySelector(".roleLeaves").value);

      const totalIdealDays = members * idealPerMember;
      const actualDays = totalIdealDays - (leaves * weight);
      const actualSP = actualDays * spPerDay;

      totalActualDays += actualDays;
      totalActualSP += actualSP;

      row.querySelector(".roleResult").innerHTML = `
        <div><b>${roleName}</b></div>
        <div>Ideal Days: ${round(totalIdealDays)}</div>
        <div>Actual Days: ${round(actualDays)}</div>
        <div>Actual SP: ${round(actualSP)}</div>
      `;
    });

    $("idealPerMemberResult").textContent =
      `Ideal Capacity per Member: ${round(idealPerMember)} days`;

    $("totalActualDays").textContent =
      `Total Actual Capacity (Days): ${round(totalActualDays)}`;

    $("totalActualSP").textContent =
      `Total Actual Capacity (Story Points): ${round(totalActualSP)}`;
  }

  // -----------------------------------------
  // WIRE EVENTS
  // -----------------------------------------
  function wire() {

    $("addRoleBtn").addEventListener("click", () => addRoleRow());

    ["sprintDays", "focusFactor", "spPerDay", "unavailabilityWeight"]
      .forEach(id => {
        $(id).addEventListener("input", calculate);
      });

    calculate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

})();
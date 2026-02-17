(() => {

const $ = id => document.getElementById(id);

function round(n){ return Math.round(n * 100) / 100; }

function avg(arr){
  return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
}

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

function setText(id,text){
  const el = $(id);
  if(el) el.textContent = text;
}

/* ================= MODE SWITCH ================= */

function setModeUI(){
  const mode = $("forecastMode").value;
  $("existingBox").style.display = mode==="existing"?"block":"none";
  $("roleModelBox").style.display = mode==="roleModel"?"block":"none";
}

/* ================= ROLE HANDLING ================= */

function addRoleRow(name="",members=0,unavailable=0){
  const tpl = $("roleRowTpl").content.cloneNode(true);
  const row = tpl.querySelector(".roleRow");

  row.querySelector(".roleName").value = name;
  row.querySelector(".roleMembers").value = members;
  row.querySelector(".roleUnavailable").value = unavailable;

  row.querySelector(".roleRemove").addEventListener("click",()=>{
    row.remove();
    calculate();
  });

  row.querySelectorAll("input").forEach(i=>{
    i.addEventListener("input",calculate);
  });

  $("rolesTbody").appendChild(tpl);
}

function readRoles(){
  return [...document.querySelectorAll(".roleRow")].map(r=>({
    name: r.querySelector(".roleName").value || "Role",
    members: Number(r.querySelector(".roleMembers").value||0),
    unavailable: Number(r.querySelector(".roleUnavailable").value||0)
  }));
}

/* ================= CALCULATE ================= */

function calculate(){

  const mode = $("forecastMode").value;

  if(mode==="existing"){
    const sprintDays = Number($("sprintDays").value||0);
    const teamMembers = Number($("teamMembers").value||0);
    const leaveDays = Number($("leaveDays").value||0);
    const interrupt = Number($("interruptPct").value||0)/100;

    const velocities=[
      Number($("v1").value||0),
      Number($("v2").value||0),
      Number($("v3").value||0)
    ].filter(v=>v>0);

    const raw = sprintDays * teamMembers;
    const eff = (raw - leaveDays) * (1-interrupt);
    const avgVel = avg(velocities);
    const velPerDay = raw? avgVel/raw:0;
    const forecast = eff*velPerDay;

    setText("rawCap",`Raw Capacity: ${round(raw)}`);
    setText("effDays",`Effective Days: ${round(eff)}`);
    setText("forecastSp",`Forecast SP: ${round(forecast)}`);
    $("roleBreakdown").innerHTML="";
    return;
  }

  /* ========== ROLE MODEL ========== */

  const totalDays = Number($("totalDays").value||0);
  const spPerDay = Number($("spPerDay").value||0);
  const weight = clamp01(Number($("unavailableWeight").value||0));

  const roles = readRoles();

  let totalMembers=0;
  let totalCapacityDays=0;
  let totalSP=0;

  const breakdown = roles.map(r=>{
    const adjusted = totalDays - (r.unavailable * weight);
    const capDays = adjusted * r.members;
    const capSP = capDays * spPerDay;

    totalMembers+=r.members;
    totalCapacityDays+=capDays;
    totalSP+=capSP;

    return {...r,adjusted,capDays,capSP};
  });

  setText("rawCap",`Total Team Members: ${totalMembers}`);
  setText("effDays",`Total Capacity Days: ${round(totalCapacityDays)}`);
  setText("forecastSp",`Total Forecast SP: ${round(totalSP)}`);

  /* breakdown table */

  $("roleBreakdown").innerHTML = `
    <table style="width:100%; margin-top:10px;">
      <tr>
        <th>Role</th><th>Members</th><th>Adj Days</th><th>Capacity SP</th>
      </tr>
      ${breakdown.map(r=>`
        <tr>
          <td>${r.name}</td>
          <td>${r.members}</td>
          <td>${round(r.capDays)}</td>
          <td>${round(r.capSP)}</td>
        </tr>`).join("")}
    </table>
  `;
}

/* ================= INIT ================= */

$("forecastMode").addEventListener("change",()=>{setModeUI();calculate();});
$("calcBtn").addEventListener("click",calculate);
$("addRoleBtn").addEventListener("click",()=>addRoleRow());

setModeUI();
addRoleRow("Dev",0,0);
addRoleRow("QA",0,0);

})();

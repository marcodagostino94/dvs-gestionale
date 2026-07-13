import {injectIcons} from "./icons.js";
import {loadData, saveData, resetData, importDataObject} from "./data.js";
import {escapeHtml, sortByNumericId, displayDate, isoToday, addCycle, licenseStatus, renewLicenses, softwareStatus, renewAllSoftware} from "./utils.js";

const state = {
  data: loadData(),
  view: "rooms",
  query: "",
  filter: "all"
};

if (renewAllSoftware(state.data)) saveData(state.data);

const app = document.getElementById("app");
const title = document.getElementById("page-title");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");
const addButton = document.getElementById("add-button");
const notificationsButton = document.getElementById("notifications-button");
const notificationDot = document.getElementById("notification-dot");
const splashScreen = document.getElementById("splash-screen");
const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginButton = document.getElementById("login-button");
const biometricButton = document.getElementById("biometric-button");
const sheet = document.getElementById("sheet");
const sheetContent = document.getElementById("sheet-content");

function find(type,id) {
  return state.data[type].find(item => item.id === id);
}

function assignedRoom(type,id,excludeRoomId=null) {
  for (const room of state.data.rooms) {
    if (room.id === excludeRoomId) continue;
    for (const station of room.stations || []) {
      if (type === "computers" && station.computerId === id) return room;
      if (type === "hardware" && station.hardwareId === id) return room;
      if (type === "licenses" && (station.avidLicenseId === id || (station.pluginLicenseIds || []).includes(id))) return room;
    }
  }
  return null;
}

function assignedStationLabel(type,id) {
  for (const room of state.data.rooms) {
    for (let i=0;i<(room.stations||[]).length;i++) {
      const station=room.stations[i];
      const found=type==="computers"?station.computerId===id:type==="hardware"?station.hardwareId===id:station.avidLicenseId===id||(station.pluginLicenseIds||[]).includes(id);
      if(found)return `Sala ${room.id}${room.stations.length>1?` · ${i+1}`:""}`;
    }
  }
  return "";
}
function setView(view) {
  state.view = view;
  state.query = "";
  state.filter = "all";
  render();
}

function render() {
  document.querySelectorAll(".tabbar button, .sidebar-nav button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  title.textContent = {
    rooms:"Sale",
    computers:"Computer",
    hardware:"Hardware",
    licenses:"Licenze",
    summary:"Sintesi",
    settings:"Altro"
  }[state.view];

  addButton.hidden = ["summary","settings"].includes(state.view);
  updateNotifications();

  try {
    app.classList.remove("view-enter");
    void app.offsetWidth;
    app.classList.add("view-enter");
    if (state.view === "rooms") renderRooms();
    else if (state.view === "computers" || state.view === "hardware" || state.view === "licenses") renderInventory(state.view);
    else if (state.view === "summary") renderSummary();
    else renderSettings();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="error-card glass"><h3>Errore di visualizzazione</h3><p>${escapeHtml(error.message)}</p><button class="primary-button" id="reset-error">Ripristina dati iniziali</button></section>`;
    document.getElementById("reset-error").onclick = () => {
      state.data = resetData();
      render();
    };
  }
}

function renderRooms() {
  app.innerHTML = `<div class="room-grid">${state.data.rooms.map(room => {
    const stations=(room.stations||[]).map((station,index)=>{
      const computer=find("computers",station.computerId);
      const avid=find("licenses",station.avidLicenseId);
      const plugins=(station.pluginLicenseIds||[]).map(id=>find("licenses",id)).filter(Boolean);
      const all=[avid,...plugins].filter(Boolean).map(softwareStatus);
      const warningTexts=[avid,...plugins].filter(Boolean).map(item=>({item,status:softwareStatus(item)})).filter(x=>["warning","expired"].includes(x.status.level)).map(x=>x.item.category==="plugin"?`${x.item.pluginType}: ${x.status.label}`:x.status.label);
      return `<div class="station-block ${index>0?"extra-station":""}">
        <div class="room-row"><div><strong>${computer?escapeHtml(computer.id):"Nessun computer"}</strong>${computer?`<small>${escapeHtml(computer.model)}</small>`:""}</div>${computer?.os?`<span class="os-badge os-${escapeHtml(computer.os.toLowerCase())}">${escapeHtml(computer.os.toUpperCase())}</span>`:""}</div>
        <div class="room-row"><div><strong>${avid?escapeHtml(avid.id):"Nessuna Avid"}</strong></div>${avid?`<span class="type-badge ${avid.type.toLowerCase()}">${escapeHtml(avid.type.toUpperCase())}</span>`:""}</div>
        ${plugins.map(p=>`<div class="room-row"><div><strong>${escapeHtml(p.pluginType.toUpperCase())}</strong></div><span class="cycle-badge ${p.billingCycle==="monthly"?"monthly":"annual"}">${p.billingCycle==="monthly"?"MENSILE":"ANNUALE"}</span></div>`).join("")}
        ${warningTexts.length?`<div class="room-warning-text">${warningTexts.map(escapeHtml).join("<br>")}</div>`:""}
      </div>`;
    }).join("");
    const statuses=(room.stations||[]).flatMap(st=>[st.avidLicenseId,...(st.pluginLicenseIds||[])].filter(Boolean).map(id=>softwareStatus(find("licenses",id))));
    const level=statuses.some(s=>s.level==="expired")?"expired":statuses.some(s=>s.level==="warning")?"warning":"";
    return `<button class="room-card glass ${level}" data-room="${room.id}"><h3>Sala ${room.id}</h3>${stations}</button>`;
  }).join("")}</div>`;
  app.querySelectorAll("[data-room]").forEach(button=>button.onclick=()=>openRoom(Number(button.dataset.room)));
}
function filterOptions(type) {
  return {
    computers:[["all","Tutti"],["available","Disponibili"],["assigned","Assegnati"],["warehouse","Magazzino"]],
    hardware:[["all","Tutti"],["available","Disponibili"],["assigned","Assegnati"]],
    licenses:[["all","Tutte"],["avid","Avid"],["plugin","Plugin"],["assigned","Assegnate"],["available","Magazzino"],["warning","In scadenza"],["expired","Scadute"]]
  }[type];
}

function renderInventory(type) {
  let baseItems = sortByNumericId(state.data[type]);
  baseItems = [...baseItems].sort((a,b) => {
    const assignedA = assignedRoom(type,a.id) ? 0 : 1;
    const assignedB = assignedRoom(type,b.id) ? 0 : 1;
    if (assignedA !== assignedB) return assignedA - assignedB;
    const na = Number((String(a.id).match(/\d+/) || ["999999"])[0]);
    const nb = Number((String(b.id).match(/\d+/) || ["999999"])[0]);
    return na - nb || String(a.id).localeCompare(String(b.id));
  });
  let items = baseItems.filter(item =>
    Object.values(item).join(" ").toLowerCase().includes(state.query.toLowerCase())
  );

  items = items.filter(item => {
    const room = assignedRoom(type,item.id);
    if (state.filter === "available") return !room;
    if (state.filter === "assigned") return Boolean(room);
    if (state.filter === "warehouse") return type === "computers" && item.warehouse;
    if (type === "licenses" && state.filter === "avid") return item.category === "avid";
    if (type === "licenses" && state.filter === "plugin") return item.category === "plugin";
    if (type === "licenses" && ["active","warning","expired"].includes(state.filter)) {
      return licenseStatus(item).level === state.filter;
    }
    return true;
  });

  app.innerHTML = `
    <input id="search-input" class="search-input" placeholder="Cerca…" value="${escapeHtml(state.query)}">
    <div class="filterbar">${filterOptions(type).map(([value,label]) =>
      `<button data-filter="${value}" class="${state.filter === value ? "selected" : ""}">${label}</button>`
    ).join("")}</div>
    <div class="list">${items.map(item => inventoryCard(type,item)).join("") || `<div class="empty-state">Nessun elemento trovato</div>`}</div>`;

  document.getElementById("search-input").oninput = event => {
    state.query = event.target.value;
    renderInventory(type);
  };
  app.querySelectorAll("[data-filter]").forEach(button => {
    button.onclick = () => {
      state.filter = button.dataset.filter;
      renderInventory(type);
    };
  });
  app.querySelectorAll("[data-item]").forEach(button => {
    button.onclick = () => openItemView(type,button.dataset.item);
  });
}

function inventoryCard(type,item) {
  const room = assignedRoom(type,item.id);

  if (type === "computers") {
    const availability = room ? `Sala ${room.id}` : item.warehouse ? `Disponibile · <b class="warehouse-label">MAGAZZINO</b>` : "Disponibile";
    return `<button class="list-card glass" data-item="${escapeHtml(item.id)}">
      <div class="list-card-main">
        <h3><strong>${escapeHtml(item.id)}</strong><span class="compact-model"> · ${escapeHtml(item.model)}</span></h3>
        <div class="badge-row">
          ${item.os ? `<span class="os-badge os-${escapeHtml(item.os.toLowerCase())}">${escapeHtml(item.os.toUpperCase())}</span>` : `<span class="os-badge os-none">macOS NON INDICATO</span>`}
          <span class="date-badge">FORMATTATO ${displayDate(item.formatDate)}</span>
        </div>
        <div class="assignment-bottom ${room ? "assigned" : "available"}">${availability}</div>
        ${!room && item.warehouse && item.warehouseLocation ? `<p class="warehouse-location">${escapeHtml(item.warehouseLocation)}</p>` : ""}
      </div><span class="chevron">›</span>
    </button>`;
  }

  if (type === "hardware") {
    return `<button class="list-card glass" data-item="${escapeHtml(item.id)}">
      <div>
        <h3>${escapeHtml(item.id)} · ${escapeHtml(item.model)}</h3>
        <p>${escapeHtml(item.serial || "Nessun seriale")}</p>
        <span class="status-pill ${room ? "warn" : "ok"}">${room ? `Sala ${room.id}` : "Disponibile"}</span>
      </div><span class="chevron">›</span>
    </button>`;
  }

  const status = softwareStatus(item);
  const cycleClass=item.billingCycle==="monthly"?"monthly":"annual";
  const cycleLabel=item.billingCycle==="monthly"?"MENSILE":"ANNUALE";
  const location=room?assignedStationLabel("licenses",item.id):"Magazzino";
  const mainBadge=item.category==="avid"?`<span class="type-badge ${item.type.toLowerCase()}">${escapeHtml(item.type.toUpperCase())}</span>`:`<span class="plugin-kind-badge">${escapeHtml(item.pluginType.toUpperCase())}</span>`;
  return `<button class="list-card glass license-card ${status.level}" data-item="${escapeHtml(item.id)}"><div><h3>${escapeHtml(item.id)} ${mainBadge} <span class="cycle-badge ${cycleClass}">${cycleLabel}</span></h3><p>Scadenza: ${displayDate(item.expiry)}</p><span class="status-pill ${status.level==="expired"?"bad":status.level==="warning"?"warn":"ok"}">${escapeHtml(status.label)} · ${escapeHtml(location)}</span></div><span class="chevron">›</span></button>`;
}


function detailBlock(title,rows) {
  return `<section class="detail-block">
    <h4>${escapeHtml(title)}</h4>
    <div class="detail-grid">
      ${rows.map(([label,content]) => `
        <div class="detail-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(content ?? "—")}</strong>
        </div>`).join("")}
    </div>
  </section>`;
}

function openRoom(id) {
  const room=state.data.rooms.find(item=>item.id===id);
  modalContent.innerHTML=`<div class="modal-title-row"><h2>Sala ${id}</h2><button class="text-button" id="edit-room">Modifica</button></div>
    ${(room.stations||[]).map((station,index)=>{
      const computer=find("computers",station.computerId),hardware=find("hardware",station.hardwareId),avid=find("licenses",station.avidLicenseId),plugins=(station.pluginLicenseIds||[]).map(pid=>find("licenses",pid)).filter(Boolean);
      return `<section class="detail-block">${room.stations.length>1?`<h4>Postazione ${index+1}</h4>`:""}${detailBlock("Computer",computer?[["ID",computer.id],["Modello",computer.model],["Sistema operativo",computer.os]]:[["Stato","Non assegnato"]])}${detailBlock("Hardware",hardware?[["ID",hardware.id],["Modello",hardware.model]]:[["Stato","Non assegnato"]])}${detailBlock("Avid",avid?[["ID",avid.id],["Tipo",avid.type],["Scadenza",displayDate(avid.expiry)]]:[["Stato","Non assegnata"]])}${plugins.length?detailBlock("Plugin",plugins.map(p=>[p.pluginType,`${p.billingCycle==="monthly"?"Mensile":"Annuale"} · ${displayDate(p.expiry)}`])):""}</section>`;
    }).join("")}
    ${room.notes?detailBlock("Note",[["Dettagli",room.notes]]):""}<div class="modal-actions"><button class="secondary-button" id="close-modal">Chiudi</button></div>`;
  document.getElementById("edit-room").onclick=()=>editRoom(id);document.getElementById("close-modal").onclick=closeModal;openModal();
}

function editRoom(id) {
  const room=state.data.rooms.find(item=>item.id===id);
  modalContent.innerHTML=`<h2>Modifica Sala ${id}</h2><div id="stations-editor">${(room.stations||[]).map((station,index)=>stationEditor(station,index,room.id,room.stations.length)).join("")}</div><button id="add-station" class="secondary-button full-button">+ Aggiungi postazione</button>${textareaField("room-notes","Note / IP",room.notes)}<div class="modal-actions"><button class="secondary-button" id="cancel-room">Annulla</button><button class="primary-button" id="save-room">Salva</button></div>`;
  bindStationEditorEvents(room.id);
  document.getElementById("add-station").onclick=()=>{const c=document.getElementById("stations-editor"),i=c.querySelectorAll(".station-editor-card").length;c.insertAdjacentHTML("beforeend",stationEditor({computerId:"",hardwareId:"",avidLicenseId:"",pluginLicenseIds:[]},i,room.id,i+1));bindStationEditorEvents(room.id);};
  document.getElementById("cancel-room").onclick=()=>openRoom(id);
  document.getElementById("save-room").onclick=()=>{room.stations=collectStations();room.notes=value("room-notes");saveData(state.data);closeModal();render();};
  openModal();
}

function stationEditor(station,index,roomId,total) {
  return `<section class="station-editor-card" data-station-index="${index}"><div class="station-editor-header">${total>1?`<strong>Postazione ${index+1}</strong>`:"<strong>Configurazione sala</strong>"}${index>0?`<button class="danger-link" data-remove-station="${index}">Rimuovi</button>`:""}</div>${pickerField(`station-${index}-computer`,"Computer",selectedLabel("computers",station.computerId),station.computerId)}${pickerField(`station-${index}-hardware`,"Hardware",selectedLabel("hardware",station.hardwareId),station.hardwareId)}${pickerField(`station-${index}-avid`,"Licenza Avid",selectedLabel("licenses",station.avidLicenseId),station.avidLicenseId)}${multiPickerField(`station-${index}-plugins`,"Plugin",(station.pluginLicenseIds||[]))}</section>`;
}

function multiPickerField(id,label,ids){const text=ids.length?ids.map(x=>find("licenses",x)?.pluginType||x).join(", "):"Nessun plugin";return `<div class="field"><label>${label}</label><button type="button" id="${id}" class="picker-button"><span>${escapeHtml(text)}</span><span class="picker-chevron">›</span></button><input type="hidden" id="${id}-value" value="${escapeHtml(ids.join(","))}"></div>`;}

function bindStationEditorEvents(roomId){
  document.querySelectorAll(".station-editor-card").forEach(card=>{const i=card.dataset.stationIndex;document.getElementById(`station-${i}-computer`).onclick=()=>openAssignmentSheet("computers","Computer",value(`station-${i}-computer-value`),roomId,`station-${i}-computer`);document.getElementById(`station-${i}-hardware`).onclick=()=>openAssignmentSheet("hardware","Hardware",value(`station-${i}-hardware-value`),roomId,`station-${i}-hardware`);document.getElementById(`station-${i}-avid`).onclick=()=>openLicenseSheet("avid",value(`station-${i}-avid-value`),roomId,`station-${i}-avid`,false);document.getElementById(`station-${i}-plugins`).onclick=()=>openLicenseSheet("plugin",value(`station-${i}-plugins-value`),roomId,`station-${i}-plugins`,true);});
  document.querySelectorAll("[data-remove-station]").forEach(btn=>btn.onclick=()=>btn.closest(".station-editor-card").remove());
}
function collectStations(){return [...document.querySelectorAll(".station-editor-card")].map(card=>{const i=card.dataset.stationIndex;return {computerId:value(`station-${i}-computer-value`),hardwareId:value(`station-${i}-hardware-value`),avidLicenseId:value(`station-${i}-avid-value`),pluginLicenseIds:value(`station-${i}-plugins-value`).split(",").filter(Boolean)};});}

function openLicenseSheet(category,current,roomId,targetId,multiple){
  const currentIds=multiple?(current?current.split(","):[]):[current].filter(Boolean),items=sortByNumericId(state.data.licenses.filter(x=>x.category===category));
  sheetContent.innerHTML=`<div class="sheet-handle"></div><div class="sheet-title-row"><h2>Seleziona ${category==="avid"?"Avid":"Plugin"}</h2><button id="close-sheet" class="text-button">Chiudi</button></div>${items.map(item=>{const used=assignedRoom("licenses",item.id,roomId);return `<button class="sheet-option ${used?"used":"free"} ${currentIds.includes(item.id)?"selected":""}" data-license-value="${escapeHtml(item.id)}"><strong>${escapeHtml(item.id)} · ${escapeHtml(item.category==="avid"?item.type:item.pluginType)}</strong><span>${used?`Assegnata alla Sala ${used.id}`:"Disponibile"}</span></button>`;}).join("")}<div class="modal-actions"><button id="confirm-license-sheet" class="primary-button">Conferma</button></div>`;
  let selected=[...currentIds];
  sheetContent.querySelectorAll("[data-license-value]").forEach(btn=>btn.onclick=()=>{const id=btn.dataset.licenseValue,used=assignedRoom("licenses",id,roomId);if(used){alert(`LICENZA ${id} già assegnata alla Sala ${used.id}.`);return;}if(multiple){selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];btn.classList.toggle("selected");}else{selected=[id];sheetContent.querySelectorAll("[data-license-value]").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");}});
  document.getElementById("confirm-license-sheet").onclick=()=>{document.getElementById(`${targetId}-value`).value=selected.join(",");document.getElementById(targetId).querySelector("span").textContent=multiple?(selected.length?selected.map(x=>find("licenses",x)?.pluginType||x).join(", "):"Nessun plugin"):selectedLabel("licenses",selected[0]||"");closeSheet();};document.getElementById("close-sheet").onclick=closeSheet;openSheet();
}
function openItemView(type,id) {
  const item = find(type,id);
  const room = assignedRoom(type,id);
  const rows = type === "computers" ? [
    ["Modello",item.model],["Processore",item.processor],["RAM",item.ram],["Scheda grafica",item.gpu],["Seriale",item.serial],
    ["Sistema operativo",item.os ? `macOS ${item.os}` : "—"],["Data formattazione",displayDate(item.formatDate)],
    ["Magazzino",item.warehouse ? "Sì" : "No"],["Posizione",item.warehouseLocation],["Assegnazione",room ? `Sala ${room.id}` : "Disponibile"],["Note",item.notes]
  ] : type === "hardware" ? [
    ["Modello",item.model],["Seriale",item.serial],["Driver",item.driver],["Assegnazione",room ? `Sala ${room.id}` : "Disponibile"],["Note",item.notes]
  ] : item.category === "plugin" ? [
    ["Tipo","Plugin"],["Plugin",item.pluginType],["Seriale",item.serial],["Durata",item.billingCycle==="monthly"?"Mensile":"Annuale"],["Attivazione",displayDate(item.activation)],["Scadenza",displayDate(item.expiry)],["Sospensione richiesta",item.deactivationRequested?"Sì":"No"],["Assegnazione",room?assignedStationLabel("licenses",item.id):"Magazzino"],["Note",item.notes]
  ] : [
    ["Tipo",item.type],["System ID",item.systemId],["Codice",item.code],["Versione",item.version],
    ["Durata",item.billingCycle === "monthly" ? "Mensile" : "Annuale"],["Attivazione",displayDate(item.activation)],
    ["Scadenza",displayDate(item.expiry)],["Disattivazione richiesta",item.deactivationRequested ? "Sì" : "No"],
    ["Assegnazione",room ? `Sala ${room.id}` : "Non assegnata"],["Note",item.notes]
  ];

  modalContent.innerHTML = `
    <div class="modal-title-row"><h2>${escapeHtml(item.id)}</h2><button class="text-button" id="edit-item">Modifica</button></div>
    ${detailBlock(type === "computers" ? "Computer" : type === "hardware" ? "Hardware" : "Licenza Avid",rows)}
    <div class="modal-actions"><button class="secondary-button" id="close-modal">Chiudi</button></div>`;

  document.getElementById("edit-item").onclick = () => {
    if (type === "licenses" && item.category === "plugin") openLicenseEdit("plugin",id);
    else openItemEdit(type,id);
  };
  document.getElementById("close-modal").onclick = closeModal;
  openModal();
}

function openItemEdit(type,id="") {
  const item = id ? find(type,id) : {};
  const isNew = !id;

  if (type === "computers") {
    modalContent.innerHTML = `
      <h2>${isNew ? "Aggiungi" : "Modifica"} computer</h2>
      ${inputField("item-id","ID macchina",item.id || "","text",isNew ? "" : "readonly")}
      ${inputField("model","Modello",item.model || "")}
      ${inputField("processor","Processore",item.processor || "")}
      ${inputField("ram","RAM",item.ram || "")}
      ${inputField("gpu","Scheda grafica",item.gpu || "")}
      ${inputField("serial","Seriale",item.serial || "")}
      <div class="field"><label>Sistema operativo</label>${segmentControl("os",["Mojave","Monterey","Ventura","Sonoma","Sequoia","Tahoe"],item.os || "")}</div>
      ${inputField("format-date","Data formattazione",item.formatDate || "","date")}
      <label class="check-card"><input id="warehouse" type="checkbox" ${item.warehouse ? "checked" : ""}><span><strong>MAGAZZINO</strong><small>Indica che il computer si trova fisicamente in magazzino.</small></span></label>
      <div class="field ${item.warehouse ? "" : "hidden"}" id="warehouse-location-wrap"><label>Posizione magazzino</label><input id="warehouse-location" value="${escapeHtml(item.warehouseLocation || "")}" placeholder="Es. Scaffale B · Ripiano 2"></div>
      ${textareaField("notes","Note",item.notes || "")}
      ${editActions(type,id,isNew)}`;

    document.getElementById("warehouse").onchange = event => {
      document.getElementById("warehouse-location-wrap").classList.toggle("hidden",!event.target.checked);
    };
  } else if (type === "hardware") {
    modalContent.innerHTML = `
      <h2>${isNew ? "Aggiungi" : "Modifica"} hardware</h2>
      ${inputField("item-id","ID hardware",item.id || "","text",isNew ? "" : "readonly")}
      ${inputField("model","Modello",item.model || "")}
      ${inputField("serial","Seriale",item.serial || "")}
      ${inputField("driver","Driver",item.driver || "")}
      ${textareaField("notes","Note",item.notes || "")}
      ${editActions(type,id,isNew)}`;
  } else {
    const activation = item.activation || isoToday();
    const cycle = item.billingCycle || "monthly";
    const expiry = item.expiry || addCycle(activation,cycle);
    modalContent.innerHTML = `
      <h2>${isNew ? "Aggiungi" : "Modifica"} licenza</h2>
      ${inputField("item-id","ID licenza",item.id || "","text",isNew ? "" : "readonly")}
      <div class="field"><label>Tipo</label>${segmentControl("license-type",["Singolo","Ultimate"],item.type || "Singolo","typed")}</div>
      ${inputField("system-id","System ID",item.systemId || "")}
      ${inputField("code","Codice licenza",item.code || "")}
      ${inputField("version","Versione",item.version || "")}
      <div class="field"><label>Durata</label>${segmentControl("billing-cycle",["monthly","annual"],cycle)}</div>
      ${inputField("activation","Data attivazione",activation,"date")}
      ${inputField("expiry","Data scadenza",expiry,"date","readonly")}
      <label class="check-card"><input id="deactivation" type="checkbox" ${item.deactivationRequested ? "checked" : ""}><span><strong>Disattivazione richiesta</strong><small>Alla scadenza la licenza diventa rossa e non viene rinnovata.</small></span></label>
      ${textareaField("notes","Note",item.notes || "")}
      ${editActions(type,id,isNew)}`;

    document.getElementById("activation").onchange = recalculateExpiry;
  }

  modalContent.querySelectorAll("[data-segment-group]").forEach(button => {
    button.onclick = () => {
      const group = button.dataset.segmentGroup;
      modalContent.querySelectorAll(`[data-segment-group="${group}"]`).forEach(peer => peer.classList.remove("selected"));
      button.classList.add("selected");
      document.getElementById(`${group}-value`).value = button.dataset.value;
      if (group === "billing-cycle") recalculateExpiry();
    };
  });

  document.getElementById("cancel-edit").onclick = () => id ? openItemView(type,id) : closeModal;
  document.getElementById("save-edit").onclick = () => saveItem(type,id);
  if (!isNew) document.getElementById("delete-edit").onclick = () => deleteItem(type,id);
  openModal();
}

function recalculateExpiry() {
  const activation = value("activation") || isoToday();
  const cycle = value("billing-cycle-value") || "monthly";
  document.getElementById("activation").value = activation;
  document.getElementById("expiry").value = addCycle(activation,cycle);
}

function saveItem(type,oldId) {
  let item;
  if (type === "computers") {
    item = {
      id:value("item-id"),model:value("model"),processor:value("processor"),ram:value("ram"),gpu:value("gpu"),
      serial:value("serial"),os:value("os-value"),formatDate:value("format-date"),
      warehouse:document.getElementById("warehouse").checked,
      warehouseLocation:value("warehouse-location"),notes:value("notes")
    };
  } else if (type === "hardware") {
    item = {id:value("item-id"),model:value("model"),serial:value("serial"),driver:value("driver"),notes:value("notes")};
  } else {
    item = {
      id:value("item-id"),category:"avid",type:value("license-type-value"),systemId:value("system-id"),code:value("code"),
      version:value("version"),billingCycle:value("billing-cycle-value"),activation:value("activation"),
      expiry:value("expiry"),deactivationRequested:document.getElementById("deactivation").checked,notes:value("notes")
    };
  }

  if (!item.id) return alert("Inserisci un ID.");
  if (!oldId && find(type,item.id)) return alert("Esiste già un elemento con questo ID.");

  if (oldId) Object.assign(find(type,oldId),item);
  else state.data[type].push(item);

  if (renewLicenses(state.data)) {}
  saveData(state.data);
  closeModal();
  render();
}

function deleteItem(type,id) {
  const room = assignedRoom(type,id);
  const message = room ? `L'elemento è assegnato alla Sala ${room.id}. Verrà rimosso anche dalla sala. Continuare?` : `Eliminare definitivamente ${id}?`;
  if (!confirm(message)) return;

  state.data[type] = state.data[type].filter(item => item.id !== id);
  state.data.rooms.forEach(roomItem => {
    if (type === "computers" && roomItem.computerId === id) roomItem.computerId = "";
    if (type === "hardware" && roomItem.hardwareId === id) roomItem.hardwareId = "";
    if (type === "licenses" && roomItem.licenseId === id) roomItem.licenseId = "";
  });
  saveData(state.data);
  closeModal();
  render();
}

function renderSummary() {
  app.innerHTML=`<section class="summary-sheet"><div class="summary-heading"><h2>Riepilogo sale</h2><p>Vista non modificabile</p></div>${state.data.rooms.map(room=>`<article class="summary-room-card glass"><header>Sala ${room.id}</header>${(room.stations||[]).map(station=>{const computer=find("computers",station.computerId),hardware=find("hardware",station.hardwareId),avid=find("licenses",station.avidLicenseId),plugins=(station.pluginLicenseIds||[]).map(id=>find("licenses",id)).filter(Boolean);return `<div class="summary-columns"><section><small>COMPUTER</small><strong>${computer?escapeHtml(computer.id):"—"}</strong><span>${computer?escapeHtml(computer.model):"Non assegnato"}</span>${computer?.os?`<span class="os-badge os-${escapeHtml(computer.os.toLowerCase())}">${escapeHtml(computer.os.toUpperCase())}</span>`:""}</section><section><small>HARDWARE</small><strong>${hardware?escapeHtml(hardware.id):"—"}</strong><span>${hardware?escapeHtml(hardware.model):"Non assegnato"}</span></section><section class="summary-avid ${avid?avid.type.toLowerCase():"empty"}"><small>AVID</small><strong>${avid?escapeHtml(avid.id):"—"}</strong><span>${avid?escapeHtml(avid.type.toUpperCase()):"Non assegnata"}</span></section><section><small>PLUGIN</small>${plugins.length?plugins.map(p=>`<div class="summary-plugin"><strong>${escapeHtml(p.pluginType.toUpperCase())}</strong><span>${p.billingCycle==="monthly"?"MENSILE":"ANNUALE"}</span></div>`).join(""):`<span>Nessun plugin</span>`}</section></div>`;}).join("")}</article>`).join("")}</section>`;
}
function renderSettings() {
  app.innerHTML = `
    <section class="settings-card glass">
      <h3>Backup dati</h3><p>Esporta un file JSON da conservare su iCloud Drive.</p>
      <button class="primary-button" id="export-button">Esporta backup</button>
      <button class="secondary-button" id="import-button">Importa backup</button>
      <input id="import-file" type="file" accept=".json" hidden>
    </section>
    <section class="settings-card glass">
      <h3>Installazione su iPhone</h3>
      <p>Apri il sito con Safari, premi Condividi e scegli “Aggiungi alla schermata Home”.</p>
    </section>
    <section class="settings-card glass">
      <h3>Ripristino</h3><p>Riporta l’app ai dati iniziali.</p>
      <button class="danger-button" id="reset-button">Ripristina dati iniziali</button>
    </section>`;

  document.getElementById("export-button").onclick = exportBackup;
  document.getElementById("import-button").onclick = () => document.getElementById("import-file").click();
  document.getElementById("import-file").onchange = event => importBackup(event.target.files[0]);
  document.getElementById("reset-button").onclick = () => {
    if (!confirm("Ripristinare tutti i dati iniziali?")) return;
    state.data = resetData();
    render();
  };
}

function notifications() {
  return state.data.licenses.map(license => ({
    license,
    status:licenseStatus(license),
    room:assignedRoom("licenses",license.id)
  })).filter(item => ["warning","expired"].includes(item.status.level));
}

function updateNotifications() {
  const items = notifications();
  notificationDot.hidden = items.length === 0;
  notificationsButton.classList.remove("warning","expired");
  if (items.some(item => item.status.level === "expired")) notificationsButton.classList.add("expired");
  else if (items.length) notificationsButton.classList.add("warning");
}

function openNotifications() {
  const items = notifications();
  modalContent.innerHTML = `
    <h2>Notifiche licenze</h2>
    <div class="notification-list">${items.length ? items.map(({license,status,room}) =>
      `<button class="notification-item ${status.level}" data-license="${escapeHtml(license.id)}" data-room="${room ? room.id : ""}">
        <strong>${escapeHtml(license.id)} · ${escapeHtml(license.type)}</strong>
        <span>${room ? `Sala ${room.id}` : "Non assegnata"}</span>
        <small>${escapeHtml(status.label)}</small>
      </button>`
    ).join("") : `<div class="empty-state">Nessuna licenza in scadenza o scaduta.</div>`}</div>
    <div class="modal-actions"><button class="secondary-button" id="close-modal">Chiudi</button></div>`;

  modalContent.querySelectorAll("[data-license]").forEach(button => {
    button.onclick = () => button.dataset.room ? openRoom(Number(button.dataset.room)) : openItemView("licenses",button.dataset.license);
  });
  document.getElementById("close-modal").onclick = closeModal;
  openModal();
}

function openAddMenu() {
  modalContent.innerHTML=`<h2>Aggiungi</h2><div class="add-menu">${state.view==="licenses"?`<button data-license-kind="avid"><span class="add-icon">A</span><strong>Licenza Avid</strong></button><button data-license-kind="plugin"><span class="add-icon">P</span><strong>Plugin</strong></button>`:`<button data-add="computers"><span class="add-icon">🖥</span><strong>Nuovo computer</strong></button><button data-add="hardware"><span class="add-icon rec-add">●</span><strong>Nuovo hardware</strong></button><button data-add="licenses"><span class="add-icon">🔑</span><strong>Nuova licenza</strong></button>`}</div><div class="modal-actions"><button class="secondary-button" id="close-modal">Annulla</button></div>`;
  modalContent.querySelectorAll("[data-add]").forEach(button=>button.onclick=()=>openItemEdit(button.dataset.add));
  modalContent.querySelectorAll("[data-license-kind]").forEach(button=>button.onclick=()=>openLicenseEdit(button.dataset.licenseKind));
  document.getElementById("close-modal").onclick=closeModal;openModal();
}

function openLicenseEdit(kind,id=""){
  const item=id?find("licenses",id):{},isNew=!id,category=kind||item.category||"avid";
  if(category==="plugin"){
    const activation=item.activation||isoToday(),cycle=item.billingCycle||"annual";
    modalContent.innerHTML=`<h2>${isNew?"Aggiungi":"Modifica"} plugin</h2>${inputField("item-id","ID licenza",item.id||"")}<div class="field"><label>Plugin</label>${segmentControl("plugin-type",["Continuum","Sapphire"],item.pluginType||"Continuum","typed")}</div>${inputField("serial","Seriale",item.serial||"")}<div class="field"><label>Durata</label>${segmentControl("billing-cycle",["monthly","annual"],cycle)}</div>${inputField("activation","Data attivazione",activation,"date")}${inputField("expiry","Data scadenza",item.expiry||addCycle(activation,cycle),"date","readonly")}<label class="check-card"><input id="deactivation" type="checkbox" ${item.deactivationRequested?"checked":""}><span><strong>Sospensione richiesta</strong></span></label>${textareaField("notes","Note",item.notes||"")}${editActions("licenses",id,isNew)}`;
  }else{openItemEdit("licenses",id);return;}
  modalContent.querySelectorAll("[data-segment-group]").forEach(button=>button.onclick=()=>{const group=button.dataset.segmentGroup;modalContent.querySelectorAll(`[data-segment-group="${group}"]`).forEach(peer=>peer.classList.remove("selected"));button.classList.add("selected");document.getElementById(`${group}-value`).value=button.dataset.value;if(group==="billing-cycle")recalculateExpiry();});
  document.getElementById("activation").onchange=recalculateExpiry;document.getElementById("cancel-edit").onclick=()=>id?openItemView("licenses",id):closeModal();
  document.getElementById("save-edit").onclick=()=>{const obj={id:value("item-id"),category:"plugin",pluginType:value("plugin-type-value"),serial:value("serial"),billingCycle:value("billing-cycle-value"),activation:value("activation"),expiry:value("expiry"),deactivationRequested:document.getElementById("deactivation").checked,notes:value("notes")};if(!obj.id)return alert("Inserisci un ID.");if(!id&&find("licenses",obj.id))return alert("Esiste già un elemento con questo ID.");if(id)Object.assign(find("licenses",id),obj);else state.data.licenses.push(obj);saveData(state.data);closeModal();render();};
  if(!isNew)document.getElementById("delete-edit").onclick=()=>deleteItem("licenses",id);openModal();
}
function inputField(id,label,inputValue="",type="text",attributes="") {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${escapeHtml(inputValue)}" ${attributes}></div>`;
}

function textareaField(id,label,inputValue="") {
  return `<div class="field"><label for="${id}">${label}</label><textarea id="${id}">${escapeHtml(inputValue)}</textarea></div>`;
}

function selectField(id,label,options) {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options}</select></div>`;
}

function segmentControl(group,items,current,extraClass="") {
  return `<div class="segmented ${extraClass}">${items.map(item => {
    const selected = String(item).toLowerCase() === String(current).toLowerCase();
    const label = item === "monthly" ? "MENSILE" : item === "annual" ? "ANNUALE" : String(item).toUpperCase();
    return `<button type="button" data-segment-group="${group}" data-value="${escapeHtml(item)}" class="${selected ? "selected" : ""} ${String(item).toLowerCase()}">${label}</button>`;
  }).join("")}</div><input type="hidden" id="${group}-value" value="${escapeHtml(current)}">`;
}

function editActions(type,id,isNew) {
  return `<div class="modal-actions">
    ${isNew ? "" : `<button class="danger-button" id="delete-edit">Elimina</button>`}
    <button class="secondary-button" id="cancel-edit">Annulla</button>
    <button class="primary-button" id="save-edit">Salva</button>
  </div>`;
}

function value(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function openModal() {
  modalContent.classList.remove("modal-enter");
  if (!modal.open) modal.showModal();
  void modalContent.offsetWidth;
  modalContent.classList.add("modal-enter");
}

function closeModal() {
  modalContent.classList.add("modal-leave");
  setTimeout(() => {
    modalContent.classList.remove("modal-leave");
    modal.close();
  }, 160);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state.data,null,2)],{type:"application/json"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `DVS_backup_${isoToday()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state.data = importDataObject(JSON.parse(reader.result));
      render();
      alert("Backup importato.");
    } catch {
      alert("File di backup non valido.");
    }
  };
  reader.readAsText(file);
}

document.querySelectorAll(".tabbar button, .sidebar-nav button").forEach(button => {
  button.onclick = () => setView(button.dataset.view);
});
addButton.onclick = openAddMenu;
notificationsButton.onclick = openNotifications;
modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});


function showLoginAfterSplash() {
  if (typeof window.__dvsRevealLogin === "function") {
    window.__dvsRevealLogin();
  }
}

function enterApplication() {
  loginScreen.classList.add("login-exit");
  setTimeout(() => {
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    appShell.classList.add("app-enter");
    state.view = "rooms";
    render();
  },320);
}

loginButton.onclick = () => {
  loginButton.disabled = true;
  loginButton.textContent = "Apertura…";
  enterApplication();
};
if (biometricButton && !biometricButton.disabled) {
  biometricButton.onclick = () => {
    document.getElementById("login-note").textContent = "Face ID / Touch ID sarà operativo dopo il collegamento al login cloud sicuro.";
  };
}

sheet.addEventListener("click",event => {
  if (event.target === sheet) closeSheet();
});

showLoginAfterSplash();

injectIcons();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) await registration.unregister();
      await navigator.serviceWorker.register("sw.js?v=2.1.0");
    } catch (error) {
      console.warn("Service worker non disponibile:",error);
    }
  });
}
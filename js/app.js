import {injectIcons} from "./icons.js";
import {loadData, saveData, resetData, importDataObject} from "./data.js";
import {escapeHtml, sortByNumericId, displayDate, isoToday, addCycle, licenseStatus, renewLicenses} from "./utils.js";

const state = {
  data: loadData(),
  view: "rooms",
  query: "",
  filter: "all"
};

if (renewLicenses(state.data)) saveData(state.data);

const app = document.getElementById("app");
const title = document.getElementById("page-title");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");
const addButton = document.getElementById("add-button");
const notificationsButton = document.getElementById("notifications-button");
const notificationDot = document.getElementById("notification-dot");

function find(type,id) {
  return state.data[type].find(item => item.id === id);
}

function assignedRoom(type,id,excludeRoomId=null) {
  const key = type === "computers" ? "computerId" : type === "hardware" ? "hardwareId" : "licenseId";
  return state.data.rooms.find(room => room.id !== excludeRoomId && room[key] === id);
}

function setView(view) {
  state.view = view;
  state.query = "";
  state.filter = "all";
  render();
}

function render() {
  document.querySelectorAll(".tabbar button").forEach(button => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  title.textContent = {
    rooms:"Sale",
    computers:"Computer",
    hardware:"Hardware",
    licenses:"Licenze Avid",
    summary:"Sintesi",
    settings:"Altro"
  }[state.view];

  addButton.hidden = ["summary","settings"].includes(state.view);
  updateNotifications();

  try {
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
    const computer = find("computers",room.computerId);
    const license = find("licenses",room.licenseId);
    const status = licenseStatus(license);
    return `<button class="room-card glass ${status.level}" data-room="${room.id}">
      <h3>Sala ${room.id}</h3>
      <p>${computer ? `${escapeHtml(computer.id)} · ${escapeHtml(computer.model)}` : "Nessun computer"}</p>
      <p>${license ? `<span class="type-badge ${license.type.toLowerCase()}">${escapeHtml(license.type.toUpperCase())}</span> ${escapeHtml(license.id)}` : "Nessuna licenza"}</p>
      ${license && ["warning","expired"].includes(status.level) ? `<p class="alert-copy">${escapeHtml(status.label)}</p>` : ""}
      <span class="status-pill ${status.level === "expired" ? "bad" : status.level === "warning" ? "warn" : computer ? "ok" : "off"}">${license ? escapeHtml(status.label) : computer ? "Configurata" : "Da configurare"}</span>
    </button>`;
  }).join("")}</div>`;

  app.querySelectorAll("[data-room]").forEach(button => {
    button.onclick = () => openRoom(Number(button.dataset.room));
  });
}

function filterOptions(type) {
  return {
    computers:[["all","Tutti"],["available","Disponibili"],["assigned","Assegnati"],["warehouse","Magazzino"]],
    hardware:[["all","Tutti"],["available","Disponibili"],["assigned","Assegnati"]],
    licenses:[["all","Tutte"],["active","Attive"],["warning","In scadenza"],["expired","Scadute"]]
  }[type];
}

function renderInventory(type) {
  let items = sortByNumericId(state.data[type]).filter(item =>
    Object.values(item).join(" ").toLowerCase().includes(state.query.toLowerCase())
  );

  items = items.filter(item => {
    const room = assignedRoom(type,item.id);
    if (state.filter === "available") return !room;
    if (state.filter === "assigned") return Boolean(room);
    if (state.filter === "warehouse") return type === "computers" && item.warehouse;
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
      <div>
        <h3>${escapeHtml(item.id)} · ${escapeHtml(item.model)}</h3>
        <p>macOS ${escapeHtml(item.os || "non indicato")}</p>
        <p>Formattazione: ${displayDate(item.formatDate)}</p>
        <span class="status-pill ${room ? "warn" : "ok"}">${availability}</span>
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

  const status = licenseStatus(item);
  return `<button class="list-card glass license-card ${status.level}" data-item="${escapeHtml(item.id)}">
    <div>
      <h3>${escapeHtml(item.id)} <span class="type-badge ${item.type.toLowerCase()}">${escapeHtml(item.type.toUpperCase())}</span></h3>
      <p>${item.billingCycle === "monthly" ? "Mensile" : "Annuale"} · Scadenza: ${displayDate(item.expiry)}</p>
      <span class="status-pill ${status.level === "expired" ? "bad" : status.level === "warning" ? "warn" : "ok"}">${escapeHtml(status.label)}</span>
    </div><span class="chevron">›</span>
  </button>`;
}

function openRoom(id) {
  const room = state.data.rooms.find(item => item.id === id);
  const computer = find("computers",room.computerId);
  const hardware = find("hardware",room.hardwareId);
  const license = find("licenses",room.licenseId);

  modalContent.innerHTML = `
    <div class="modal-title-row"><h2>Sala ${id}</h2><button class="text-button" id="edit-room">Modifica</button></div>
    ${detailBlock("Computer", computer ? [
      ["ID",computer.id],["Modello",computer.model],["Processore",computer.processor],["RAM",computer.ram],
      ["Grafica",computer.gpu],["Seriale",computer.serial],["Sistema operativo",computer.os ? `macOS ${computer.os}` : "—"],
      ["Formattazione",displayDate(computer.formatDate)]
    ] : [["Stato","Non assegnato"]])}
    ${detailBlock("Hardware", hardware ? [["ID",hardware.id],["Modello",hardware.model],["Seriale",hardware.serial],["Driver",hardware.driver]] : [["Stato","Non assegnato"]])}
    ${detailBlock("Licenza Avid", license ? [
      ["ID",license.id],["Tipo",license.type],["System ID",license.systemId],["Codice",license.code],["Versione",license.version],
      ["Durata",license.billingCycle === "monthly" ? "Mensile" : "Annuale"],["Attivazione",displayDate(license.activation)],
      ["Scadenza",displayDate(license.expiry)],["Disattivazione richiesta",license.deactivationRequested ? "Sì" : "No"]
    ] : [["Stato","Non assegnata"]])}
    ${room.otherLicenses ? detailBlock("Altre licenze",[["Dettagli",room.otherLicenses]]) : ""}
    ${room.notes ? detailBlock("Note / IP / computer aggiuntivo",[["Dettagli",room.notes]]) : ""}
    <div class="modal-actions"><button class="secondary-button" id="close-modal">Chiudi</button></div>`;

  document.getElementById("edit-room").onclick = () => editRoom(id);
  document.getElementById("close-modal").onclick = closeModal;
  openModal();
}

function detailBlock(titleText,rows) {
  return `<section class="detail-block"><h4>${titleText}</h4><div class="detail-grid">${rows.filter(([,value]) => value !== "" && value != null).map(([label,value]) =>
    `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`
  ).join("")}</div></section>`;
}

function roomOptions(type,current,currentRoomId) {
  return `<option value="">Non assegnato</option>` + sortByNumericId(state.data[type]).map(item => {
    const used = assignedRoom(type,item.id,currentRoomId);
    const label = `${used ? "🔴" : "🟢"} ${item.id} · ${item.model || item.type}${used ? ` · Sala ${used.id}` : " · Disponibile"}`;
    return `<option value="${escapeHtml(item.id)}" ${item.id === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function editRoom(id) {
  const room = state.data.rooms.find(item => item.id === id);
  const oldComputer = room.computerId;
  const oldLicense = room.licenseId;

  modalContent.innerHTML = `
    <h2>Modifica Sala ${id}</h2>
    ${selectField("room-computer","Computer",roomOptions("computers",room.computerId,id))}
    ${selectField("room-hardware","Hardware video",roomOptions("hardware",room.hardwareId,id))}
    ${selectField("room-license","Licenza Avid",roomOptions("licenses",room.licenseId,id))}
    ${textareaField("room-other","Altre licenze",room.otherLicenses)}
    ${textareaField("room-notes","Note / IP / computer aggiuntivo",room.notes)}
    <div class="modal-actions">
      <button class="secondary-button" id="cancel-room">Annulla</button>
      <button class="primary-button" id="save-room">Salva</button>
    </div>`;

  document.getElementById("cancel-room").onclick = () => openRoom(id);
  document.getElementById("save-room").onclick = () => {
    const computerId = value("room-computer");
    const hardwareId = value("room-hardware");
    let licenseId = value("room-license");

    const duplicateComputer = computerId && assignedRoom("computers",computerId,id);
    const duplicateHardware = hardwareId && assignedRoom("hardware",hardwareId,id);
    const duplicateLicense = licenseId && assignedRoom("licenses",licenseId,id);

    if (duplicateComputer) return alert(`COMPUTER ${computerId} già assegnato alla Sala ${duplicateComputer.id}.`);
    if (duplicateHardware) return alert(`HARDWARE ${hardwareId} già assegnato alla Sala ${duplicateHardware.id}.`);
    if (duplicateLicense) return alert(`LICENZA ${licenseId} già assegnata alla Sala ${duplicateLicense.id}.`);

    if (oldComputer !== computerId && oldLicense) {
      const keep = confirm(`Hai cambiato computer. Vuoi mantenere la licenza Avid ${oldLicense} assegnata alla Sala ${id}?\n\nOK = mantieni\nAnnulla = rimuovi`);
      if (!keep) licenseId = "";
    }

    room.computerId = computerId;
    room.hardwareId = hardwareId;
    room.licenseId = licenseId;
    room.otherLicenses = value("room-other");
    room.notes = value("room-notes");
    saveData(state.data);
    closeModal();
    render();
  };
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

  document.getElementById("edit-item").onclick = () => openItemEdit(type,id);
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
      id:value("item-id"),type:value("license-type-value"),systemId:value("system-id"),code:value("code"),
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
  app.innerHTML = `<section class="summary-sheet">
    <div class="summary-heading"><h2>Riepilogo sale</h2><p>Vista non modificabile</p></div>
    ${state.data.rooms.map(room => {
      const computer = find("computers",room.computerId);
      const license = find("licenses",room.licenseId);
      return `<article class="summary-row glass">
        <div class="summary-room">Sala ${room.id}</div>
        <div class="summary-data">
          <strong>${computer ? escapeHtml(computer.id) : "Nessun computer"}</strong>
          <span>${license ? `${escapeHtml(license.id)} · ${escapeHtml(license.type.toUpperCase())}` : "Nessuna licenza Avid"}</span>
          ${room.otherLicenses ? `<span class="other-license">${escapeHtml(room.otherLicenses)}</span>` : ""}
        </div>
      </article>`;
    }).join("")}
  </section>`;
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
  modalContent.innerHTML = `
    <h2>Aggiungi</h2>
    <div class="add-menu">
      <button data-add="computers"><span class="add-icon">🖥</span><strong>Nuovo computer</strong></button>
      <button data-add="hardware"><span class="add-icon rec-add">●</span><strong>Nuovo hardware</strong></button>
      <button data-add="licenses"><span class="add-icon">🔑</span><strong>Nuova licenza</strong></button>
    </div>
    <div class="modal-actions"><button class="secondary-button" id="close-modal">Annulla</button></div>`;

  modalContent.querySelectorAll("[data-add]").forEach(button => {
    button.onclick = () => openItemEdit(button.dataset.add);
  });
  document.getElementById("close-modal").onclick = closeModal;
  openModal();
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
  if (!modal.open) modal.showModal();
}

function closeModal() {
  modal.close();
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

document.querySelectorAll(".tabbar button").forEach(button => {
  button.onclick = () => setView(button.dataset.view);
});
addButton.onclick = openAddMenu;
notificationsButton.onclick = openNotifications;
modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

injectIcons();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) await registration.unregister();
      await navigator.serviceWorker.register("sw.js?v=1.0.0");
    } catch (error) {
      console.warn("Service worker non disponibile:",error);
    }
  });
}
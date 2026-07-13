import {injectIcons} from "./icons.js";
import {loadData, saveData, resetData, importDataObject} from "./data.js";
import {escapeHtml, sortByNumericId, displayDate, isoToday, addCycle, licenseStatus, renewLicenses, pluginStatus, renewPlugins} from "./utils.js";

const state = {
  data: loadData(),
  view: "rooms",
  query: "",
  filter: "all"
};

if (renewLicenses(state.data) || renewPlugins(state.data)) saveData(state.data);

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
    const computer = find("computers",room.computerId);
    const license = find("licenses",room.licenseId);
    const status = licenseStatus(license);
    const plugins = room.plugins || [];

    return `<button class="room-card glass ${status.level}" data-room="${room.id}">
      <h3>Sala ${room.id}</h3>

      <div class="room-line room-computer-line">
        ${computer
          ? `<strong>${escapeHtml(computer.id)}</strong><span class="room-model"> · ${escapeHtml(computer.model)}</span>${computer.os ? `<span class="os-badge os-${escapeHtml(computer.os.toLowerCase())}">${escapeHtml(computer.os.toUpperCase())}</span>` : ""}`
          : `<span class="room-empty">Nessun computer</span>`}
      </div>

      <div class="room-line">
        ${license
          ? `<strong>${escapeHtml(license.id)}</strong><span class="type-badge ${license.type.toLowerCase()}">${escapeHtml(license.type.toUpperCase())}</span>`
          : `<span class="room-empty">Nessuna licenza Avid</span>`}
      </div>

      ${plugins.length ? `<div class="plugin-badges">${plugins.map(plugin => {
        const pStatus = pluginStatus(plugin);
        return `<span class="plugin-badge ${pStatus.level}">${escapeHtml(plugin.type.toUpperCase())}</span>`;
      }).join("")}</div>` : ""}

      ${license && ["warning","expired"].includes(status.level) ? `<p class="alert-copy">${escapeHtml(status.label)}</p>` : ""}
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
  let baseItems = sortByNumericId(state.data[type]);
  if (type === "licenses") {
    baseItems = [...baseItems].sort((a,b) => {
      const assignedA = assignedRoom("licenses",a.id) ? 0 : 1;
      const assignedB = assignedRoom("licenses",b.id) ? 0 : 1;
      if (assignedA !== assignedB) return assignedA - assignedB;
      const na = Number((String(a.id).match(/\d+/) || ["999999"])[0]);
      const nb = Number((String(b.id).match(/\d+/) || ["999999"])[0]);
      return na - nb || String(a.id).localeCompare(String(b.id));
    });
  }
  let items = baseItems.filter(item =>
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

  const status = licenseStatus(item);
  const cycleClass = item.billingCycle === "monthly" ? "monthly" : "annual";
  const cycleLabel = item.billingCycle === "monthly" ? "MENSILE" : "ANNUALE";
  const location = room ? `Sala ${room.id}` : "Non assegnata";
  return `<button class="list-card glass license-card ${status.level}" data-item="${escapeHtml(item.id)}">
    <div>
      <h3>${escapeHtml(item.id)} <span class="type-badge ${item.type.toLowerCase()}">${escapeHtml(item.type.toUpperCase())}</span> <span class="cycle-badge ${cycleClass}">${cycleLabel}</span></h3>
      <p>Scadenza: ${displayDate(item.expiry)}</p>
      <span class="status-pill ${status.level === "expired" ? "bad" : status.level === "warning" ? "warn" : "ok"}">${escapeHtml(status.label)} · ${escapeHtml(location)}</span>
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
    ${(room.plugins || []).length ? `<section class="detail-block"><h4>Plugin</h4>${room.plugins.map(plugin => {
      const ps = pluginStatus(plugin);
      return `<div class="plugin-detail"><strong>${escapeHtml(plugin.type)}</strong><span>${escapeHtml(plugin.serial || "Nessun seriale")}</span><span>${plugin.billingCycle === "monthly" ? "Mensile" : "Annuale"} · ${displayDate(plugin.expiry)}</span><span class="status-pill ${ps.level === "expired" ? "bad" : ps.level === "warning" ? "warn" : "ok"}">${escapeHtml(ps.label)}</span></div>`;
    }).join("")}</section>` : ""}
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
    ${pickerField("computer-picker","Computer",selectedLabel("computers",room.computerId),room.computerId)}
    ${pickerField("hardware-picker","Hardware video",selectedLabel("hardware",room.hardwareId),room.hardwareId)}
    ${pickerField("license-picker","Licenza Avid",selectedLabel("licenses",room.licenseId),room.licenseId)}

    <section class="plugin-editor">
      <div class="plugin-editor-title"><h3>Plugin</h3><button id="add-plugin" class="text-button">+ Aggiungi</button></div>
      <div id="plugin-editor-list">${renderPluginEditors(room.plugins || [])}</div>
    </section>

    ${textareaField("room-notes","Note / IP / computer aggiuntivo",room.notes)}
    <div class="modal-actions">
      <button class="secondary-button" id="cancel-room">Annulla</button>
      <button class="primary-button" id="save-room">Salva</button>
    </div>`;

  document.getElementById("computer-picker").onclick = () => openAssignmentSheet("computers","Computer",value("computer-picker-value"),id,"computer-picker");
  document.getElementById("hardware-picker").onclick = () => openAssignmentSheet("hardware","Hardware video",value("hardware-picker-value"),id,"hardware-picker");
  document.getElementById("license-picker").onclick = () => openAssignmentSheet("licenses","Licenza Avid",value("license-picker-value"),id,"license-picker");
  document.getElementById("add-plugin").onclick = () => addPluginEditor();
  bindPluginEditorEvents();

  document.getElementById("cancel-room").onclick = () => openRoom(id);
  document.getElementById("save-room").onclick = () => {
    const computerId = value("computer-picker-value");
    const hardwareId = value("hardware-picker-value");
    let licenseId = value("license-picker-value");

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
    room.plugins = collectPlugins();
    room.notes = value("room-notes");

    if (renewPlugins(state.data)) {}
    saveData(state.data);
    closeModal();
    render();
  };
}

function selectedLabel(type,id) {
  if (!id) return "Non assegnato";
  const item = find(type,id);
  return item ? `${item.id} · ${item.model || item.type}` : "Non assegnato";
}

function pickerField(id,label,text,currentValue) {
  return `<div class="field"><label>${label}</label><button type="button" id="${id}" class="picker-button"><span>${escapeHtml(text)}</span><span class="picker-chevron">›</span></button><input type="hidden" id="${id}-value" value="${escapeHtml(currentValue)}"></div>`;
}

function openAssignmentSheet(type,label,current,currentRoomId,targetId) {
  const items = sortByNumericId(state.data[type]);
  const free = items.filter(item => !assignedRoom(type,item.id,currentRoomId));
  const used = items.filter(item => assignedRoom(type,item.id,currentRoomId));

  sheetContent.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title-row"><h2>Seleziona ${label}</h2><button id="close-sheet" class="text-button">Chiudi</button></div>
    <button class="sheet-option neutral ${current === "" ? "selected" : ""}" data-sheet-value="">
      <strong>Non assegnato</strong><span>Nessun elemento</span>
    </button>
    ${free.length ? `<h3 class="sheet-section-title">Disponibili</h3>${free.map(item => sheetOption(type,item,current,currentRoomId)).join("")}` : ""}
    ${used.length ? `<h3 class="sheet-section-title">Già assegnati</h3>${used.map(item => sheetOption(type,item,current,currentRoomId)).join("")}` : ""}
  `;

  sheetContent.querySelectorAll("[data-sheet-value]").forEach(button => {
    button.onclick = () => {
      const id = button.dataset.sheetValue;
      const usedRoom = id && assignedRoom(type,id,currentRoomId);
      if (usedRoom) {
        const name = type === "computers" ? "COMPUTER" : type === "hardware" ? "HARDWARE" : "LICENZA";
        alert(`${name} ${id} già assegnato/a alla Sala ${usedRoom.id}.`);
        return;
      }
      document.getElementById(`${targetId}-value`).value = id;
      document.getElementById(targetId).querySelector("span").textContent = selectedLabel(type,id);
      closeSheet();
    };
  });
  document.getElementById("close-sheet").onclick = closeSheet;
  openSheet();
}

function sheetOption(type,item,current,currentRoomId) {
  const usedRoom = assignedRoom(type,item.id,currentRoomId);
  const stateClass = usedRoom ? "used" : "free";
  const subtitle = usedRoom ? `Assegnato alla Sala ${usedRoom.id}` : "Disponibile";
  return `<button class="sheet-option ${stateClass} ${item.id === current ? "selected" : ""}" data-sheet-value="${escapeHtml(item.id)}">
    <strong>${escapeHtml(item.id)} · ${escapeHtml(item.model || item.type)}</strong>
    <span>${escapeHtml(subtitle)}</span>
  </button>`;
}

function openSheet() {
  if (!sheet.open) sheet.showModal();
  sheetContent.classList.remove("sheet-enter");
  void sheetContent.offsetWidth;
  sheetContent.classList.add("sheet-enter");
}

function closeSheet() {
  sheetContent.classList.add("sheet-leave");
  setTimeout(() => {
    sheetContent.classList.remove("sheet-leave");
    sheet.close();
  },160);
}

function renderPluginEditors(plugins) {
  return plugins.map((plugin,index) => pluginEditor(plugin,index)).join("");
}

function pluginEditor(plugin,index) {
  const type = plugin.type || "Continuum";
  const cycle = plugin.billingCycle || "annual";
  return `<div class="plugin-editor-card" data-plugin-index="${index}">
    <div class="plugin-editor-head"><strong>Plugin ${index+1}</strong><button type="button" class="remove-plugin danger-link" data-remove-plugin="${index}">Rimuovi</button></div>
    <div class="segmented typed plugin-type-segment">
      <button type="button" class="${type === "Continuum" ? "selected" : ""}" data-plugin-type="Continuum">CONTINUUM</button>
      <button type="button" class="${type === "Sapphire" ? "selected" : ""}" data-plugin-type="Sapphire">SAPPHIRE</button>
    </div>
    <input type="hidden" class="plugin-type-value" value="${escapeHtml(type)}">
    <div class="field"><label>Seriale</label><input class="plugin-serial" value="${escapeHtml(plugin.serial || "")}"></div>
    <div class="segmented">
      <button type="button" class="${cycle === "monthly" ? "selected" : ""}" data-plugin-cycle="monthly">MENSILE</button>
      <button type="button" class="${cycle === "annual" ? "selected" : ""}" data-plugin-cycle="annual">ANNUALE</button>
    </div>
    <input type="hidden" class="plugin-cycle-value" value="${escapeHtml(cycle)}">
    <div class="field"><label>Data attivazione</label><input type="date" class="plugin-activation" value="${escapeHtml(plugin.activation || isoToday())}"></div>
    <div class="field"><label>Data scadenza</label><input type="date" class="plugin-expiry" value="${escapeHtml(plugin.expiry || addCycle(plugin.activation || isoToday(),cycle))}" readonly></div>
    <label class="check-card compact-check"><input type="checkbox" class="plugin-deactivation" ${plugin.deactivationRequested ? "checked" : ""}><span><strong>Sospensione richiesta</strong></span></label>
  </div>`;
}

function addPluginEditor() {
  const container = document.getElementById("plugin-editor-list");
  const index = container.querySelectorAll(".plugin-editor-card").length;
  container.insertAdjacentHTML("beforeend",pluginEditor({type:"Continuum",billingCycle:"annual",activation:isoToday(),expiry:addCycle(isoToday(),"annual")},index));
  bindPluginEditorEvents();
}

function bindPluginEditorEvents() {
  document.querySelectorAll(".plugin-editor-card").forEach(card => {
    card.querySelectorAll("[data-plugin-type]").forEach(button => button.onclick = () => {
      card.querySelectorAll("[data-plugin-type]").forEach(peer => peer.classList.remove("selected"));
      button.classList.add("selected");
      card.querySelector(".plugin-type-value").value = button.dataset.pluginType;
    });
    card.querySelectorAll("[data-plugin-cycle]").forEach(button => button.onclick = () => {
      card.querySelectorAll("[data-plugin-cycle]").forEach(peer => peer.classList.remove("selected"));
      button.classList.add("selected");
      card.querySelector(".plugin-cycle-value").value = button.dataset.pluginCycle;
      recalcPluginCard(card);
    });
    card.querySelector(".plugin-activation").onchange = () => recalcPluginCard(card);
  });
  document.querySelectorAll("[data-remove-plugin]").forEach(button => button.onclick = () => {
    button.closest(".plugin-editor-card").remove();
  });
}

function recalcPluginCard(card) {
  const activation = card.querySelector(".plugin-activation").value || isoToday();
  const cycle = card.querySelector(".plugin-cycle-value").value || "annual";
  card.querySelector(".plugin-activation").value = activation;
  card.querySelector(".plugin-expiry").value = addCycle(activation,cycle);
}

function collectPlugins() {
  return [...document.querySelectorAll(".plugin-editor-card")].map(card => ({
    type:card.querySelector(".plugin-type-value").value,
    serial:card.querySelector(".plugin-serial").value.trim(),
    billingCycle:card.querySelector(".plugin-cycle-value").value,
    activation:card.querySelector(".plugin-activation").value,
    expiry:card.querySelector(".plugin-expiry").value,
    deactivationRequested:card.querySelector(".plugin-deactivation").checked
  }));
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
      const hardware = find("hardware",room.hardwareId);
      const license = find("licenses",room.licenseId);
      const plugins = room.plugins || [];
      const avidClass = license ? license.type.toLowerCase() : "empty";

      return `<article class="summary-room-card glass">
        <header>Sala ${room.id}</header>
        <div class="summary-columns">
          <section>
            <small>COMPUTER</small>
            <strong>${computer ? escapeHtml(computer.id) : "—"}</strong>
            <span>${computer ? escapeHtml(computer.model) : "Non assegnato"}</span>
            ${computer?.os ? `<span class="os-badge os-${escapeHtml(computer.os.toLowerCase())}">${escapeHtml(computer.os.toUpperCase())}</span>` : ""}
          </section>
          <section>
            <small>HARDWARE</small>
            <strong>${hardware ? escapeHtml(hardware.id) : "—"}</strong>
            <span>${hardware ? escapeHtml(hardware.model) : "Non assegnato"}</span>
          </section>
          <section class="summary-avid ${avidClass}">
            <small>AVID</small>
            <strong>${license ? escapeHtml(license.id) : "—"}</strong>
            <span>${license ? escapeHtml(license.type.toUpperCase()) : "Non assegnata"}</span>
          </section>
          <section>
            <small>PLUGIN</small>
            ${plugins.length ? plugins.map(plugin => {
              const ps = pluginStatus(plugin);
              return `<div class="summary-plugin"><strong>${escapeHtml(plugin.type.toUpperCase())}</strong><span class="${ps.level}">${escapeHtml(ps.label)}</span></div>`;
            }).join("") : `<span>Nessun plugin</span>`}
          </section>
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

function assignmentPicker(type,label,current,currentRoomId) {
  const items = sortByNumericId(state.data[type]);
  const cards = [
    `<button type="button" class="assignment-option ${current === "" ? "selected" : ""}" data-assignment-option data-group="${type}" data-value="">
      <span class="assignment-name">Non assegnato</span>
      <span class="assignment-status neutral">Nessun elemento</span>
    </button>`,
    ...items.map(item => {
      const used = assignedRoom(type,item.id,currentRoomId);
      const selected = item.id === current;
      const statusClass = used ? "used" : "free";
      const statusText = used ? `Assegnato alla Sala ${used.id}` : "Disponibile";
      return `<button type="button" class="assignment-option ${statusClass} ${selected ? "selected" : ""}" data-assignment-option data-group="${type}" data-value="${escapeHtml(item.id)}">
        <span class="assignment-name">${escapeHtml(item.id)} · ${escapeHtml(item.model || item.type)}</span>
        <span class="assignment-status ${statusClass}">${escapeHtml(statusText)}</span>
      </button>`;
    })
  ].join("");

  return `<div class="field"><label>${label}</label><div class="assignment-picker">${cards}</div><input type="hidden" id="assignment-${type}" value="${escapeHtml(current)}"></div>`;
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

document.querySelectorAll(".tabbar button").forEach(button => {
  button.onclick = () => setView(button.dataset.view);
});
addButton.onclick = openAddMenu;
notificationsButton.onclick = openNotifications;
modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});


function showLoginAfterSplash() {
  setTimeout(() => {
    splashScreen.classList.add("splash-exit");
    setTimeout(() => {
      splashScreen.classList.add("hidden");
      loginScreen.classList.remove("hidden");
      loginScreen.classList.add("login-enter");
    },500);
  },900);
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

loginButton.onclick = enterApplication;
biometricButton.onclick = () => {
  document.getElementById("login-note").textContent = "Face ID / Touch ID sarà operativo dopo il collegamento al login cloud sicuro.";
  biometricButton.classList.add("biometric-pulse");
  setTimeout(() => biometricButton.classList.remove("biometric-pulse"),600);
};

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
      await navigator.serviceWorker.register("sw.js?v=1.0.0");
    } catch (error) {
      console.warn("Service worker non disponibile:",error);
    }
  });
}
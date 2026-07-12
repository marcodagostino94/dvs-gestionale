const DEFAULT_DATA = {
 rooms: Array.from({length:15},(_,i)=>({id:i+1,computerId:i===0?"MAC 4":"",hardwareId:"",licenseId:"",otherLicenses:"",notes:""})),
 computers:[
  {id:"MAC 22",model:"Mac Studio (2023)",processor:"Apple M1 Max",ram:"32 GB",gpu:"",serial:"QF9V9M6V37",os:"Ventura",formatDate:"2026-04-28",warehouse:true,warehouseLocation:"Da definire",notes:"Importato dal Numbers"},
  {id:"MAC 4",model:"iMac Retina 5K 27-inch (2019)",processor:"Intel Core i9 3,6 GHz 8-core",ram:"32 GB 2667 MHz DDR4",gpu:"Radeon Pro 575X 4 GB",serial:"DGKYKHEZJV3Y",os:"Monterey",formatDate:"2026-03-09",warehouse:false,warehouseLocation:"",notes:"Nel file risultava in Sala 1"},
  {id:"MAC 10",model:"iMac Retina 5K 27-inch (2019)",processor:"Intel Core i5 3,7 GHz 6-core",ram:"24 GB 2400 MHz DDR4",gpu:"Radeon Pro 580X 8 GB",serial:"C02YW05HJV3Q",os:"Monterey",formatDate:"",warehouse:true,warehouseLocation:"Da definire",notes:""},
  {id:"MAC 13",model:"Mac Pro (Mid 2010)",processor:"2x Intel Xeon 2,4 GHz Quad-Core",ram:"12 GB 1066 MHz",gpu:"",serial:"CK10200WHF8",os:"",formatDate:"",warehouse:true,warehouseLocation:"Archivio storico",notes:"Mac storico"},
  {id:"MAC 3",model:"Mac Pro (Late 2013)",processor:"Intel Xeon E5 6-core",ram:"28 GB 1866 MHz ECC",gpu:"AMD FirePro D700 6 GB",serial:"F5KP70ADF694",os:"",formatDate:"2025-07-17",warehouse:true,warehouseLocation:"Archivio storico",notes:"Mac storico"},
  {id:"MAC 5",model:"iMac Retina 5K 27-inch (2020)",processor:"Intel Core i7 3,8 GHz 8-core",ram:"40 GB 2133 MHz DDR4",gpu:"Radeon Pro 5500 XT 8 GB",serial:"C02DQ1MQPN5W",os:"Monterey",formatDate:"2026-02-18",warehouse:true,warehouseLocation:"Da definire",notes:"Da verificare"},
  {id:"MAC 11",model:"iMac Retina 5K 27-inch (Late 2015)",processor:"Intel Core i5 3,2 GHz Quad-Core",ram:"24 GB 1867 MHz",gpu:"Radeon R9 M390 2 GB",serial:"C02S65TMGG7L",os:"Mojave",formatDate:"",warehouse:true,warehouseLocation:"Archivio storico",notes:"Mac storico"}
 ],
 hardware:[
  {id:"HW 8",model:"UltraStudio Monitor 3G",serial:"7106243",driver:"12.8.1",notes:""},
  {id:"HW 10",model:"UltraStudio Monitor 3G",serial:"11868651",driver:"",notes:""},
  {id:"HW 3",model:"Avid Artist DNxID",serial:"9077367",driver:"12.4.1",notes:""},
  {id:"HW 1",model:"Avid Artist DNxIO",serial:"3197864",driver:"12.8.1",notes:""},
  {id:"HW NITRIS 1",model:"Nitris DX",serial:"BFE23400193G",driver:"",notes:"Storico"},
  {id:"HW 16",model:"Teranex 2D Processor",serial:"2419046",driver:"",notes:"Storico"},
  {id:"HW 9",model:"8HD Mini",serial:"5829797",driver:"4.1",notes:"Da verificare"},
  {id:"HW EXPRESS 1",model:"Avid Express",serial:"3155387",driver:"",notes:"Storico"}
 ],
 licenses:[
  {id:"AVID 02",type:"Ultimate",systemId:"3496914",code:"MUHA-YNSD-RQ8V-DU6F",version:"2022.12.6",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"1 anno – disattivazione richiesta"},
  {id:"AVID 06",type:"Ultimate",systemId:"10769244273",code:"MUHA-G39S-5P8D-TYCH",version:"2022.12.5",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"Da verificare"},
  {id:"AVID 21",type:"Singolo",systemId:"10620086202",code:"MTHA-VGF5-WEZJ-VKRF",version:"2023.8.2",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"1 anno – disattivazione richiesta"},
  {id:"AVID 05",type:"Ultimate",systemId:"",code:"",version:"",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:true,notes:"Completare codici"},
  {id:"AVID 09",type:"Ultimate",systemId:"633901897",code:"MUHA-QHXN-RFMP-ZSPF",version:"",billingCycle:"annual",activation:"",expiry:"",deactivationRequested:false,notes:"Da verificare"}
 ]
};

let data=JSON.parse(localStorage.getItem("dvsData")||"null")||structuredClone(DEFAULT_DATA);
let view="rooms",query="",filter="all";
const app=document.getElementById("app"),title=document.getElementById("pageTitle"),modal=document.getElementById("modal"),mc=document.getElementById("modalContent");
const DAY=86400000;
const save=()=>localStorage.setItem("dvsData",JSON.stringify(data));
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const find=(type,id)=>data[type].find(x=>x.id===id);
const assigned=(type,id)=>data.rooms.find(r=>r[type==="computers"?"computerId":type==="hardware"?"hardwareId":"licenseId"]===id);
const numberOf=id=>{const m=String(id).match(/(\d+)/);return m?Number(m[1]):999999};
const sortNumeric=arr=>[...arr].sort((a,b)=>numberOf(a.id)-numberOf(b.id)||a.id.localeCompare(b.id));
function isoToday(){const d=new Date();d.setHours(0,0,0,0);return d.toISOString().slice(0,10)}
function parseISO(s){if(!s)return null;const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function toISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function displayDate(s){if(!s)return "—";const [y,m,d]=s.split("-");return `${d}-${m}-${y}`}
function daysSince(s){if(!s)return 0;return Math.max(0,Math.floor((parseISO(isoToday())-parseISO(s))/DAY))}
function assignmentState(type,id,currentRoomId=null){
 const room=data.rooms.find(r=>r.id!==currentRoomId&&r[type==="computers"?"computerId":type==="hardware"?"hardwareId":"licenseId"]===id);
 return room?{used:true,room:room.id}:{used:false,room:null}
}
function addCycle(dateStr,cycle){
 let d=parseISO(dateStr)||parseISO(isoToday()),day=d.getDate();
 if(cycle==="monthly"){d.setDate(1);d.setMonth(d.getMonth()+1);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()))}
 else d.setFullYear(d.getFullYear()+1);
 return toISO(d)
}
function normalize(){
 data.computers.forEach(c=>{
  if(c.warehouse===undefined)c.warehouse=false;
  if(c.warehouseLocation===undefined)c.warehouseLocation="";
  if(c.status!==undefined)delete c.status;
  if(c.os?.toLowerCase().includes("mojave"))c.os="Mojave";
  else if(c.os?.toLowerCase().includes("monterey"))c.os="Monterey";
  else if(c.os?.toLowerCase().includes("ventura"))c.os="Ventura";
  else if(c.os?.toLowerCase().includes("sonoma"))c.os="Sonoma";
  else if(c.os?.toLowerCase().includes("sequoia"))c.os="Sequoia";
  else if(c.os?.toLowerCase().includes("tahoe"))c.os="Tahoe";
 });
 data.hardware.forEach(h=>{if(h.status!==undefined)delete h.status});
 data.licenses.forEach(l=>{
  if(l.status!==undefined)delete l.status;
  if(l.deactivationRequested===undefined){l.deactivationRequested=String(l.deactivation||"").toLowerCase()==="sì";delete l.deactivation}
  if(!l.billingCycle)l.billingCycle="annual";
  if(l.activation&&!l.expiry)l.expiry=addCycle(l.activation,l.billingCycle);
  if(l.expiry&&!l.deactivationRequested){
   const today=parseISO(isoToday());let exp=parseISO(l.expiry);
   while(exp&&exp<today){l.expiry=addCycle(l.expiry,l.billingCycle);exp=parseISO(l.expiry)}
  }
 });
 save();
}
function licenseVisual(l){
 if(!l||!l.expiry)return{level:"none",label:"Nessuna scadenza",days:null};
 const today=parseISO(isoToday()),exp=parseISO(l.expiry),days=Math.ceil((exp-today)/DAY);
 if(l.deactivationRequested&&days<0)return{level:"expired",label:`Scaduta da ${daysSince(l.expiry)} giorni`,days};
 if(days>=0&&days<=5)return{level:"warning",label:days===0?"Scade oggi":`Scade tra ${days} giorni`,days};
 return{level:"ok",label:"Attiva",days}
}
normalize();

function render(){
 document.querySelectorAll(".tabbar button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 title.textContent={rooms:"Sale",computers:"Computer",hardware:"Hardware",licenses:"Licenze Avid",summary:"Sintesi",settings:"Altro"}[view];
 document.getElementById("addBtn").style.display=["settings","summary"].includes(view)?"none":"block";
 updateBell();
 if(view==="rooms")renderRooms();else if(view==="summary")renderSummary();else if(view==="settings")renderSettings();else renderInventory(view)
}
function renderRooms(){
 app.innerHTML=`<div class="grid">${data.rooms.map(r=>{const c=find("computers",r.computerId),l=find("licenses",r.licenseId),v=licenseVisual(l);return `<article class="card glass room-card ${v.level}" onclick="openRoom(${r.id})"><h3>Sala ${r.id}</h3><p>${c?esc(c.id+" · "+c.model):"Nessun computer"}</p><p>${l?`<span class="type-badge ${String(l.type).toLowerCase()}">${esc(l.type.toUpperCase())}</span> ${esc(l.id)}`:"Nessuna licenza"}</p>${l&&["warning","expired"].includes(v.level)?`<p class="attention-text">${esc(v.label)}</p>`:""}<span class="status ${v.level==="expired"?"bad":v.level==="warning"?"warn":c?"ok":"off"}">${l?esc(v.label):c?"Configurata":"Da configurare"}</span></article>`}).join("")}</div>`
}
function filterBar(type){
 const sets={
  computers:[["all","Tutti"],["available","Disponibili"],["assigned","Assegnati"],["warehouse","Magazzino"]],
  hardware:[["all","Tutti"],["available","Disponibili"],["assigned","Assegnati"]],
  licenses:[["all","Tutte"],["active","Attive"],["warning","In scadenza"],["expired","Scadute"]]
 };
 return `<div class="filterbar">${sets[type].map(([v,l])=>`<button class="${filter===v?"selected":""}" onclick="filter='${v}';renderInventory('${type}')">${l}</button>`).join("")}</div>`
}
function renderInventory(type){
 let items=sortNumeric(data[type]).filter(x=>Object.values(x).join(" ").toLowerCase().includes(query.toLowerCase()));
 items=items.filter(x=>{
  const r=assigned(type,x.id);
  if(filter==="available")return !r;
  if(filter==="assigned")return !!r;
  if(filter==="warehouse")return type==="computers"&&x.warehouse;
  if(type==="licenses"&&["active","warning","expired"].includes(filter))return licenseVisual(x).level===filter;
  return true
 });
 app.innerHTML=`<input class="search" placeholder="Cerca…" value="${esc(query)}" oninput="query=this.value;renderInventory('${type}')">${filterBar(type)}<div class="list">${items.map(x=>inventoryCard(type,x)).join("")||'<div class="empty">Nessun elemento trovato</div>'}</div>`
}
function inventoryCard(type,x){
 const r=assigned(type,x.id);
 if(type==="computers"){
  const availability=r?`Sala ${r.id}`:x.warehouse?`Disponibile · <b class="warehouse-word">MAGAZZINO</b>`:"Disponibile";
  return `<article class="list-card glass" onclick="openItemView('computers','${esc(x.id)}')"><div class="main"><h3>${esc(x.id)} · ${esc(x.model)}</h3><p>macOS ${esc(x.os||"non indicato")}</p><p>Formattazione: ${displayDate(x.formatDate)}</p><span class="status ${r?"warn":"ok"}">${availability}</span>${!r&&x.warehouse&&x.warehouseLocation?`<p class="warehouse-location">${esc(x.warehouseLocation)}</p>`:""}</div><span class="chev">›</span></article>`
 }
 if(type==="hardware"){
  return `<article class="list-card glass" onclick="openItemView('hardware','${esc(x.id)}')"><div class="main"><h3>${esc(x.id)} · ${esc(x.model)}</h3><p>${esc(x.serial||"Nessun seriale")}</p><span class="status ${r?"warn":"ok"}">${r?"Sala "+r.id:"Disponibile"}</span></div><span class="chev">›</span></article>`
 }
 const v=licenseVisual(x);
 return `<article class="list-card glass license-card ${v.level}" onclick="openItemView('licenses','${esc(x.id)}')"><div class="main"><h3>${esc(x.id)} <span class="type-badge ${String(x.type).toLowerCase()}">${esc(String(x.type).toUpperCase())}</span></h3><p>${x.billingCycle==="monthly"?"Mensile":"Annuale"} · Scadenza: ${displayDate(x.expiry)}</p><span class="status ${v.level==="expired"?"bad":v.level==="warning"?"warn":"ok"}">${esc(v.label)}</span></div><span class="chev">›</span></article>`
}
function detail(titleText,obj,rows){
 return `<section class="detail"><h4>${titleText}</h4><div class="kv">${rows.filter(([_,v])=>v!==""&&v!==undefined&&v!==null).map(([k,v])=>`<span>${esc(k)}</span><span>${esc(v)}</span>`).join("")}</div></section>`
}
function openRoom(id){
 const r=data.rooms.find(x=>x.id===id),c=find("computers",r.computerId),h=find("hardware",r.hardwareId),l=find("licenses",r.licenseId);
 mc.innerHTML=`<div class="modal-title-row"><h2>Sala ${id}</h2><button type="button" class="text-btn" onclick="editRoom(${id})">Modifica</button></div>
 ${c?detail("Computer",c,[["ID",c.id],["Modello",c.model],["Processore",c.processor],["RAM",c.ram],["Grafica",c.gpu],["Seriale",c.serial],["Sistema","macOS "+(c.os||"—")],["Formattazione",displayDate(c.formatDate)]]):detail("Computer",{},[["Stato","Non assegnato"]])}
 ${h?detail("Hardware",h,[["ID",h.id],["Modello",h.model],["Seriale",h.serial],["Driver",h.driver]]):detail("Hardware",{},[["Stato","Non assegnato"]])}
 ${l?detail("Licenza Avid",l,[["ID",l.id],["Tipo",l.type],["System ID",l.systemId],["Codice",l.code],["Versione",l.version],["Durata",l.billingCycle==="monthly"?"Mensile":"Annuale"],["Attivazione",displayDate(l.activation)],["Scadenza",displayDate(l.expiry)],["Disattivazione richiesta",l.deactivationRequested?"Sì":"No"]]):detail("Licenza Avid",{},[["Stato","Non assegnata"]])}
 ${r.otherLicenses?detail("Altre licenze",{},[["Dettagli",r.otherLicenses]]):""}
 ${r.notes?detail("Note / IP / computer aggiuntivo",{},[["Dettagli",r.notes]]):""}
 <div class="actions"><button class="secondary" value="cancel">Chiudi</button></div>`;
 modal.showModal()
}
function options(type,current,currentRoomId){
 return `<option value="">Non assegnato</option>`+sortNumeric(data[type]).map(x=>{
   const s=assignmentState(type,x.id,currentRoomId);
   const label=`${s.used?"🔴":"🟢"} ${x.id} · ${x.model||x.type}${s.used?` · Sala ${s.room}`:" · Disponibile"}`;
   return `<option value="${esc(x.id)}" ${x.id===current?"selected":""}>${esc(label)}</option>`
 }).join("")
}" ${x.id===current?"selected":""}>${esc(x.id+" · "+(x.model||x.type))}</option>`).join("")}
function editRoom(id){
 const r=data.rooms.find(x=>x.id===id),oldComputer=r.computerId,oldLicense=r.licenseId;
 mc.innerHTML=`<h2>Modifica Sala ${id}</h2>
 <div class="field"><label>Computer</label><select id="roomComputer">${options("computers",r.computerId,id)}</select></div>
 <div class="field"><label>Hardware video</label><select id="roomHardware">${options("hardware",r.hardwareId,id)}</select></div>
 <div class="field"><label>Licenza Avid</label><select id="roomLicense">${options("licenses",r.licenseId,id)}</select></div>
 <div class="field"><label>Altre licenze</label><textarea id="roomOther">${esc(r.otherLicenses)}</textarea></div>
 <div class="field"><label>Note / IP / computer aggiuntivo</label><textarea id="roomNotes">${esc(r.notes)}</textarea></div>
 <div class="actions"><button class="secondary" type="button" onclick="openRoom(${id})">Annulla</button><button class="primary" type="button" onclick="saveRoom(${id},'${esc(oldComputer)}','${esc(oldLicense)}')">Salva</button></div>`
}
function saveRoom(id,oldComputer,oldLicense){
 const r=data.rooms.find(x=>x.id===id),newComputer=document.getElementById("roomComputer").value,newHardware=document.getElementById("roomHardware").value;
 let selectedLicense=document.getElementById("roomLicense").value;
 const dupComputer=newComputer&&data.rooms.find(x=>x.id!==id&&x.computerId===newComputer);
 const dupHardware=newHardware&&data.rooms.find(x=>x.id!==id&&x.hardwareId===newHardware);
 const dupLicense=selectedLicense&&data.rooms.find(x=>x.id!==id&&x.licenseId===selectedLicense);
 if(dupComputer){alert(`COMPUTER ${newComputer} già assegnato alla Sala ${dupComputer.id}.`);return}
 if(dupHardware){alert(`HARDWARE ${newHardware} già assegnato alla Sala ${dupHardware.id}.`);return}
 if(dupLicense){alert(`LICENZA ${selectedLicense} già assegnata alla Sala ${dupLicense.id}.`);return}
 if(oldComputer!==newComputer&&oldLicense){
  const keep=confirm("Hai cambiato computer. Vuoi mantenere la licenza Avid "+oldLicense+" assegnata alla Sala "+id+"?\n\nOK = mantieni\nAnnulla = rimuovi");
  if(!keep)selectedLicense=""
 }
 r.computerId=newComputer;r.hardwareId=newHardware;r.licenseId=selectedLicense;r.otherLicenses=document.getElementById("roomOther").value;r.notes=document.getElementById("roomNotes").value;
 save();modal.close();render()
}
function openItemView(type,id){
 const x=find(type,id),r=assigned(type,id);
 const rows=type==="computers"?[["Modello",x.model],["Processore",x.processor],["RAM",x.ram],["Scheda grafica",x.gpu],["Seriale",x.serial],["Sistema operativo",x.os?`macOS ${x.os}`:"—"],["Data formattazione",displayDate(x.formatDate)],["Magazzino",x.warehouse?"Sì":"No"],["Posizione",x.warehouseLocation],["Assegnazione",r?`Sala ${r.id}`:"Disponibile"],["Note",x.notes]]:
 type==="hardware"?[["Modello",x.model],["Seriale",x.serial],["Driver",x.driver],["Assegnazione",r?`Sala ${r.id}`:"Disponibile"],["Note",x.notes]]:
 [["Tipo",x.type],["System ID",x.systemId],["Codice",x.code],["Versione",x.version],["Durata",x.billingCycle==="monthly"?"Mensile":"Annuale"],["Attivazione",displayDate(x.activation)],["Scadenza",displayDate(x.expiry)],["Disattivazione richiesta",x.deactivationRequested?"Sì":"No"],["Assegnazione",r?`Sala ${r.id}`:"Non assegnata"],["Note",x.notes]];
 mc.innerHTML=`<div class="modal-title-row"><h2>${esc(x.id)}</h2><button type="button" class="text-btn" onclick="openItemEdit('${type}','${esc(id)}')">Modifica</button></div>${detail(type==="computers"?"Computer":type==="hardware"?"Hardware":"Licenza Avid",x,rows)}<div class="actions"><button class="secondary" value="cancel">Chiudi</button></div>`;
 modal.showModal()
}
function segmented(id,items,current,colors=false){return `<div class="segmented ${colors?"typed":""}" id="${id}">${items.map(v=>`<button type="button" class="${String(v).toLowerCase()===String(current).toLowerCase()?"selected":""} ${String(v).toLowerCase()}" onclick="selectSegment('${id}','${esc(v)}')">${esc(String(v).toUpperCase())}</button>`).join("")}</div><input type="hidden" id="f_${id}" value="${esc(current)}">`}
function selectSegment(id,value){
 document.getElementById("f_"+id).value=value;
 [...document.getElementById(id).children].forEach(b=>b.classList.toggle("selected",b.textContent.trim()===String(value).toUpperCase()));
 if(id==="billingCycle")recalcExpiry()
}
function openItemEdit(type,id=""){
 const item=id?find(type,id):{},isNew=!id;
 if(type==="computers"){
  const os=item.os||"";
  mc.innerHTML=`<h2>${isNew?"Aggiungi":"Modifica"} computer</h2>${field("id","ID macchina",item.id,"text",isNew?"":"readonly")}${field("model","Modello",item.model)}${field("processor","Processore",item.processor)}${field("ram","RAM",item.ram)}${field("gpu","Scheda grafica",item.gpu)}${field("serial","Seriale",item.serial)}
  <div class="field"><label>Sistema operativo</label>${segmented("os",["Mojave","Monterey","Ventura","Sonoma","Sequoia","Tahoe"],os)}</div>
  ${field("formatDate","Data formattazione",item.formatDate,"date")}
  <label class="check-card"><input id="f_warehouse" type="checkbox" ${item.warehouse?"checked":""} onchange="toggleWarehouse()"><span><strong>MAGAZZINO</strong><small>Indica che il computer si trova fisicamente in magazzino.</small></span></label>
  <div id="warehouseLocationWrap" class="field ${item.warehouse?"":"hidden"}"><label>Posizione magazzino</label><input id="f_warehouseLocation" value="${esc(item.warehouseLocation||"")}" placeholder="Es. Scaffale B · Ripiano 2"></div>
  ${textarea("notes","Note",item.notes)}${editActions(type,id,isNew)}`
 }else if(type==="hardware"){
  mc.innerHTML=`<h2>${isNew?"Aggiungi":"Modifica"} hardware</h2>${field("id","ID hardware",item.id,"text",isNew?"":"readonly")}${field("model","Modello",item.model)}${field("serial","Seriale",item.serial)}${field("driver","Driver",item.driver)}${textarea("notes","Note",item.notes)}${editActions(type,id,isNew)}`
 }else{
  const activation=item.activation||isoToday(),cycle=item.billingCycle||"monthly",expiry=item.expiry||addCycle(activation,cycle),licType=item.type||"Singolo";
  mc.innerHTML=`<h2>${isNew?"Aggiungi":"Modifica"} licenza</h2>${field("id","ID licenza",item.id,"text",isNew?"":"readonly")}
  <div class="field"><label>Tipo</label>${segmented("licenseType",["Singolo","Ultimate"],licType,true)}</div>
  ${field("systemId","System ID",item.systemId)}${field("code","Codice licenza",item.code)}${field("version","Versione",item.version)}
  <div class="field"><label>Durata</label>${segmented("billingCycle",["monthly","annual"],cycle)}</div>
  ${field("activation","Data attivazione",activation,"date","onchange=\'recalcExpiry()\'")}
  ${field("expiry","Data scadenza",expiry,"date","readonly")}
  <label class="check-card"><input id="f_deactivationRequested" type="checkbox" ${item.deactivationRequested?"checked":""}><span><strong>Disattivazione richiesta</strong><small>Alla scadenza la licenza diventa rossa e non viene rinnovata.</small></span></label>
  ${textarea("notes","Note",item.notes)}${editActions(type,id,isNew)}`
 }
 modal.showModal()
}
function field(id,label,value="",type="text",attrs=""){
 const dateClass=type==="date"?" date-input":"";
 return `<div class="field"><label>${label}</label><input class="${dateClass}" id="f_${id}" type="${type}" value="${esc(value)}" ${attrs}></div>`
}</label><input id="f_${id}" value="${esc(value)}" ${extra}></div>`}
function textarea(id,label,value=""){return `<div class="field"><label>${label}</label><textarea id="f_${id}">${esc(value)}</textarea></div>`}
function editActions(type,id,isNew){return `<div class="actions">${isNew?"":`<button class="danger" type="button" onclick="deleteItem('${type}','${esc(id)}')">Elimina</button>`}<button class="secondary" value="cancel">Annulla</button><button class="primary" type="button" onclick="saveItem('${type}','${esc(id)}')">Salva</button></div>`}
function toggleWarehouse(){document.getElementById("warehouseLocationWrap").classList.toggle("hidden",!document.getElementById("f_warehouse").checked)}
function recalcExpiry(){document.getElementById("f_expiry").value=addCycle(document.getElementById("f_activation").value||isoToday(),document.getElementById("f_billingCycle").value||"monthly")}
function saveItem(type,oldId){
 let obj;
 if(type==="computers")obj={id:v("id"),model:v("model"),processor:v("processor"),ram:v("ram"),gpu:v("gpu"),serial:v("serial"),os:v("os"),formatDate:v("formatDate"),warehouse:document.getElementById("f_warehouse").checked,warehouseLocation:v("warehouseLocation"),notes:v("notes")};
 else if(type==="hardware")obj={id:v("id"),model:v("model"),serial:v("serial"),driver:v("driver"),notes:v("notes")};
 else obj={id:v("id"),type:v("licenseType"),systemId:v("systemId"),code:v("code"),version:v("version"),billingCycle:v("billingCycle"),activation:v("activation"),expiry:v("expiry"),deactivationRequested:document.getElementById("f_deactivationRequested").checked,notes:v("notes")};
 if(!obj.id){alert("Inserisci un ID.");return}
 if(!oldId&&find(type,obj.id)){alert("Esiste già un elemento con questo ID.");return}
 if(oldId)Object.assign(find(type,oldId),obj);else data[type].push(obj);
 normalize();modal.close();render()
}
function v(id){return document.getElementById("f_"+id)?.value.trim()||""}
function deleteItem(type,id){
 const r=assigned(type,id);
 if(!confirm(r?`L'elemento è assegnato alla Sala ${r.id}. Verrà rimosso anche dalla sala. Continuare?`:`Eliminare definitivamente ${id}?`))return;
 data[type]=data[type].filter(x=>x.id!==id);
 data.rooms.forEach(room=>{if(type==="computers"&&room.computerId===id)room.computerId="";if(type==="hardware"&&room.hardwareId===id)room.hardwareId="";if(type==="licenses"&&room.licenseId===id)room.licenseId=""});
 save();modal.close();render()
}
function openAddMenu(){
 mc.innerHTML=`<h2>Aggiungi</h2><div class="add-menu"><button type="button" onclick="openItemEdit('computers')"><span class="menu-symbol">▭</span><b>Nuovo computer</b></button><button type="button" onclick="openItemEdit('hardware')"><span class="menu-symbol rec-mini">●</span><b>Nuovo hardware</b></button><button type="button" onclick="openItemEdit('licenses')"><span class="menu-symbol">⌁</span><b>Nuova licenza</b></button></div><div class="actions"><button class="secondary" value="cancel">Annulla</button></div>`;
 modal.showModal()
}
function notifications(){
 return data.licenses.map(l=>({l,v:licenseVisual(l),r:assigned("licenses",l.id)})).filter(x=>["warning","expired"].includes(x.v.level))
}
function updateBell(){
 const ns=notifications(),dot=document.getElementById("bellDot"),btn=document.getElementById("bellBtn");
 dot.style.display=ns.length?"block":"none";btn.classList.remove("warning","expired");
 if(ns.some(x=>x.v.level==="expired"))btn.classList.add("expired");else if(ns.length)btn.classList.add("warning")
}
function openNotifications(){
 const ns=notifications();
 mc.innerHTML=`<h2>Notifiche licenze</h2><div class="list notification-list">${ns.length?ns.map(({l,v,r})=>`<button type="button" class="notification ${v.level}" onclick="${r?`openRoom(${r.id})`:`openItemView('licenses','${esc(l.id)}')`}"><b>${esc(l.id)} · ${esc(l.type)}</b><span>${r?"Sala "+r.id:"Non assegnata"}</span><small>${esc(v.label)}</small></button>`).join(""):'<div class="empty">Nessuna licenza in scadenza o scaduta.</div>'}</div><div class="actions"><button class="secondary" value="cancel">Chiudi</button></div>`;
 modal.showModal()
}
function renderSummary(){
 const rows=data.rooms.map(r=>{
  const c=find("computers",r.computerId),l=find("licenses",r.licenseId);
  return `<article class="summary-row glass">
    <div class="summary-room">Sala ${r.id}</div>
    <div class="summary-data">
      <strong>${c?esc(c.id):"Nessun computer"}</strong>
      <span>${l?`${esc(l.id)} · ${esc(String(l.type).toUpperCase())}`:"Nessuna licenza Avid"}</span>
      ${r.otherLicenses?`<span class="other-license">${esc(r.otherLicenses)}</span>`:""}
    </div>
  </article>`
 }).join("");
 app.innerHTML=`<section class="summary-sheet"><div class="summary-heading"><h2>Riepilogo sale</h2><p>Vista non modificabile</p></div>${rows}</section>`
}
function renderSettings(){
 app.innerHTML=`<section class="settings-card glass"><h3>Backup dati</h3><p>Esporta un file JSON da conservare su iCloud Drive.</p><button class="primary" onclick="exportData()">Esporta backup</button><button class="secondary" onclick="document.getElementById('importFile').click()">Importa backup</button><input id="importFile" type="file" accept=".json" hidden onchange="importData(this.files[0])"></section><section class="settings-card glass"><h3>Installazione su iPhone</h3><p class="hint">Apri il sito con Safari, premi Condividi e scegli “Aggiungi alla schermata Home”.</p></section><section class="settings-card glass"><h3>Ripristino</h3><p>Riporta l’app ai dati iniziali.</p><button class="danger" onclick="resetData()">Ripristina dati iniziali</button></section>`
}
function exportData(){const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="DVS_backup_"+isoToday()+".json";a.click()}
function importData(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.rooms||!d.computers)throw 0;data=d;normalize();render();alert("Backup importato.")}catch{alert("File di backup non valido.")}};r.readAsText(file)}
function resetData(){if(confirm("Ripristinare tutti i dati iniziali?")){data=structuredClone(DEFAULT_DATA);normalize();render()}}
document.querySelectorAll(".tabbar button").forEach(b=>b.onclick=()=>{view=b.dataset.view;query="";filter="all";render()});
document.getElementById("addBtn").onclick=openAddMenu;
document.getElementById("bellBtn").onclick=openNotifications;
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");
render();
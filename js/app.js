import { supabase } from './supabase.js';
import { loadAll, saveRow, removeRow, archiveRow, assignResource, assignPlugin, addAudit } from './api.js';
import { esc, fmtDate, numSort, licenseStatus, cycleLabel, todayISO } from './utils.js';

const VAPID_PUBLIC_KEY='BLidTsO_r-SgpMHvPD0KC3jv39ZHLcdOfoTAR0IHDemM1dTQrLUM7WoUCA8FwfxXlCmA_KV4rnEXdBqlCXixNJc';

const splash=document.getElementById('splash'),login=document.getElementById('login'),shell=document.getElementById('shell'),app=document.getElementById('app'),title=document.getElementById('title'),greeting=document.getElementById('greeting'),modal=document.getElementById('modal'),modalBody=document.getElementById('modal-body'),sheet=document.getElementById('sheet'),sheetBody=document.getElementById('sheet-body'),toast=document.getElementById('toast');
const views=[['dashboard','dashboard','Dashboard'],['rooms','chair','Sale'],['computers','computer','Computer'],['hardware','rec','Hardware'],['licenses','key','Licenze'],['summary','summary','Sintesi EXP'],['settings','settings','Settings']];
const state={view:'dashboard',data:null,filter:'all',session:null};
const labels={dashboard:'Dashboard',rooms:'Sale',computers:'Computer',hardware:'Hardware',licenses:'Licenze',summary:'Sintesi · Experimental',settings:'Settings'};

function navIcon(name){const icons={dashboard:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>`,chair:`<svg viewBox="0 0 24 24"><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M5 11h14v5H5z"/><path d="M8 16v5M16 16v5M4 11V8M20 11V8"/></svg>`,computer:`<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,key:`<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/></svg>`,summary:`<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,settings:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.12-1.3l2-1.55-2-3.46-2.45 1A7 7 0 0 0 14.2 5.4L13.8 3h-4l-.4 2.4a7 7 0 0 0-2.23 1.29l-2.45-1-2 3.46 2 1.55A7 7 0 0 0 4.6 12c0 .44.04.87.12 1.3l-2 1.55 2 3.46 2.45-1a7 7 0 0 0 2.23 1.29l.4 2.4h4l.4-2.4a7 7 0 0 0 2.23-1.29l2.45 1 2-3.46-2-1.55c.08-.43.12-.86.12-1.3z"/></svg>`};return icons[name]||''}
function navHTML(){return views.map(([id,icon,label])=>`<button class="nav-btn ${state.view===id?'active':''}" data-view="${id}">${icon==='rec'?`<span class="rec-nav-icon"><i></i></span>`:`<span class="nav-svg">${navIcon(icon)}</span>`}<small>${label}</small></button>`).join('')}
function bindNav(){document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view))}
function setView(v){state.view=v;state.filter='all';title.textContent=labels[v];document.getElementById('desktop-nav').innerHTML=navHTML();document.getElementById('mobile-nav').innerHTML=navHTML();bindNav();render()}
function showToast(t){toast.textContent=t;toast.classList.remove('hidden');setTimeout(()=>toast.classList.add('hidden'),2200)}
function openModal(html){modalBody.innerHTML=html;modal.showModal();modalBody.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal.close())}
function openSheet(html){sheetBody.innerHTML=html;sheet.showModal();sheetBody.querySelectorAll('[data-close-sheet]').forEach(b=>b.onclick=()=>sheet.close())}
function uuid(){return crypto.randomUUID()}
function stationLabel(station){const room=state.data.rooms.find(r=>r.id===station.room_id);const count=state.data.stations.filter(s=>s.room_id===station.room_id).length;const idx=state.data.stations.filter(s=>s.room_id===station.room_id).sort((a,b)=>a.position-b.position).findIndex(s=>s.id===station.id);return `${room?.name||'Sala'}${count>1?` · ${idx+1}`:''}`}
function stationOf(kind,id){return state.data.stations.find(s=>kind==='computer'?s.computer_id===id:kind==='hardware'?s.hardware_id===id:s.avid_license_id===id)}
function pluginStation(id){const rel=state.data.station_plugins.find(x=>x.license_id===id);return rel?state.data.stations.find(s=>s.id===rel.station_id):null}
function currentLocation(kind,id){const s=kind==='plugin'?pluginStation(id):stationOf(kind,id);return s?stationLabel(s):'Non assegnato'}
async function refresh(){state.data=await loadAll();render()}

function dashboard(){const d=state.data,c=d.computers.filter(x=>!x.archived_at),h=d.hardware.filter(x=>!x.archived_at),l=d.licenses.filter(x=>!x.archived_at);const warnings=l.map(x=>({x,s:licenseStatus(x)})).filter(v=>v.s.level!=='ok');return `<div class="grid dashboard-grid">${metric('Computer',c.length,`${c.filter(x=>stationOf('computer',x.id)).length} in sala · ${c.filter(x=>!stationOf('computer',x.id)).length} magazzino`)}${metric('Hardware',h.length,`${h.filter(x=>!stationOf('hardware',x.id)).length} in magazzino`)}${metric('Licenze Avid',l.filter(x=>x.category==='avid').length,`${l.filter(x=>x.category==='avid'&&!stationOf('license',x.id)).length} in magazzino`)}${metric('Plugin',l.filter(x=>x.category==='plugin').length,`${l.filter(x=>x.category==='plugin'&&!pluginStation(x.id)).length} in magazzino`)}</div><section class="attention"><div class="section-title"><h2>Attenzione</h2></div>${warnings.length?`<div class="list">${warnings.map(v=>`<button class="list-card" data-open-license="${v.x.id}"><div><h3>${esc(v.x.code)}</h3><p>${esc(v.x.category==='avid'?v.x.avid_type:v.x.plugin_type)}</p><span class="status ${v.s.level}">${esc(v.s.text)}</span></div><span>›</span></button>`).join('')}</div>`:`<div class="empty">Nessuna licenza richiede attenzione.</div>`}</section>`}
function metric(name,n,sub){return `<div class="metric glass"><span>${name}</span><strong>${n}</strong><small class="subtle">${sub}</small></div>`}


const officeGroups=[
  {title:'Ufficio 1 • Chinotto',start:1,end:5},
  {title:'Ufficio 2 • Chinotto',start:6,end:10},
  {title:'Ufficio 3 • Carso',start:11,end:15}
];
function roomsForOffice(rooms,group){
  return rooms.filter(room=>room.position>=group.start&&room.position<=group.end);
}

function rooms(){
  const allRooms=[...state.data.rooms].sort((a,b)=>a.position-b.position);
  return `<div class="office-groups">${officeGroups.map(group=>{
    const grouped=roomsForOffice(allRooms,group);
    return `<section class="office-group">
      <div class="office-label"><span>${group.title}</span></div>
      <div class="grid room-grid">${grouped.map(room=>{
        const sts=state.data.stations.filter(s=>s.room_id===room.id).sort((a,b)=>a.position-b.position);
        const levels=sts.flatMap(s=>[s.avid_license_id,...state.data.station_plugins.filter(x=>x.station_id===s.id).map(x=>x.license_id)])
          .filter(Boolean)
          .map(id=>licenseStatus(state.data.licenses.find(l=>l.id===id)).level);
        const level=levels.includes('expired')?'expired':levels.includes('warning')?'warning':'';
        return `<article class="room-card ${level}" data-room="${room.id}">
          <h3>${esc(room.name)}</h3>
          ${sts.map(stationCard).join('')}
        </article>`;
      }).join('')}</div>
    </section>`;
  }).join('')}</div>`;
}
function stationCard(s){const c=state.data.computers.find(x=>x.id===s.computer_id),a=state.data.licenses.find(x=>x.id===s.avid_license_id),plugins=state.data.station_plugins.filter(x=>x.station_id===s.id).map(x=>state.data.licenses.find(l=>l.id===x.license_id)).filter(Boolean);return `<div class="station-row"><div class="resource-row"><div><strong>${c?esc(c.code):'Nessun computer'}</strong>${c?`<small>${esc([c.model,c.variant].filter(Boolean).join(' · '))}</small>`:''}</div>${c?.os_name?`<span class="badge os os-${esc(c.os_name.toLowerCase())}">${esc(c.os_name.toUpperCase())}</span>`:''}</div><div class="resource-row"><strong>${a?esc(a.code):'Nessuna Avid'}</strong>${a?`<div class="badges"><span class="badge ${a.avid_type==='Ultimate'?'ultimate':'singolo'}">${esc(a.avid_type.toUpperCase())}</span><span class="badge ${a.billing_cycle}">${cycleLabel(a.billing_cycle)}</span>${a.is_trial?'<span class="badge trial">TRIAL</span>':''}</div>`:''}</div>${plugins.map(p=>`<div class="resource-row"><strong>${esc(p.plugin_type.toUpperCase())}</strong><div class="badges"><span class="badge ${p.billing_cycle}">${cycleLabel(p.billing_cycle)}</span>${p.is_trial?'<span class="badge trial">TRIAL</span>':''}</div></div>`).join('')}${[a,...plugins].filter(Boolean).map(x=>licenseStatus(x)).filter(x=>x.level!=='ok').map(x=>`<div class="status ${x.level}">${esc(x.text)}</div>`).join('')}</div>`}

function inventory(type){
  const source=state.data[type].filter(x=>!x.archived_at);
  const mapped=source.map(x=>({
    x,
    loc:type==='computers'
      ?stationOf('computer',x.id)
      :type==='hardware'
        ?stationOf('hardware',x.id)
        :x.category==='plugin'
          ?pluginStation(x.id)
          :stationOf('license',x.id)
  }));

  const filtered=mapped.filter(({x,loc})=>
    state.filter==='all'
    ||state.filter==='assigned'&&loc
    ||state.filter==='warehouse'&&!loc
    ||type==='licenses'&&state.filter===x.category
  );

  if(type!=='licenses'){
    const ordered=filtered.sort((a,b)=>{
      const au=a.loc?0:1,bu=b.loc?0:1;
      if(au!==bu)return au-bu;
      return numSort(a.x,b.x);
    });
    return `${filters(type)}<div class="list">${ordered.length?ordered.map(({x})=>inventoryCard(type,x)).join(''):'<div class="empty">Nessun elemento.</div>'}</div>`;
  }

  const orderGroup=rows=>rows.sort((a,b)=>{
    const ac=a.x.category==='avid'?0:1;
    const bc=b.x.category==='avid'?0:1;
    if(ac!==bc)return ac-bc;
    return numSort(a.x,b.x);
  });

  const assigned=orderGroup(filtered.filter(row=>row.loc));
  const unassigned=orderGroup(filtered.filter(row=>!row.loc));

  const group=(label,rows)=>`<section class="license-inventory-group">
    <div class="office-label license-group-label"><span>${label}</span></div>
    <div class="list">${rows.length?rows.map(({x})=>inventoryCard(type,x)).join(''):'<div class="empty">Nessun elemento.</div>'}</div>
  </section>`;

  return `${filters(type)}<div class="license-inventory-groups">${group('Assegnati',assigned)}${group('Non assegnati',unassigned)}</div>`;
}
function filters(type){const fs=type==='licenses'?[['all','Tutte'],['avid','Avid'],['plugin','Plugin'],['assigned','Assegnate'],['warehouse','Magazzino']]:[['all','Tutti'],['assigned','Assegnati'],['warehouse','Magazzino']];return `<div class="filters">${fs.map(([id,l])=>`<button class="filter ${state.filter===id?'active':''}" data-filter="${id}">${l}</button>`).join('')}</div>`}
function locationMarkup(text){return text==='Non assegnato'?'<span class="unassigned-text">Non assegnato</span>':esc(text)}
function inventoryCard(type,x){
  if(type==='computers')return `<button class="list-card" data-item="computers:${x.id}"><div><h3>${esc(x.code)} · ${esc([x.model,x.variant].filter(Boolean).join(' · '))}</h3><div class="badges">${x.os_name?`<span class="badge os os-${esc(x.os_name.toLowerCase())}">${esc(x.os_name.toUpperCase())}</span>`:''}</div><p>${locationMarkup(currentLocation('computer',x.id))} · Formattazione ${fmtDate(x.formatted_at)}</p></div><span>›</span></button>`;
  if(type==='hardware')return `<button class="list-card" data-item="hardware:${x.id}"><div><h3>${esc(x.code)} · ${esc(x.model||'')}</h3><p>${locationMarkup(currentLocation('hardware',x.id))}</p></div><span>›</span></button>`;

  const st=licenseStatus(x);
  const kind=x.category==='avid'?x.avid_type:x.plugin_type;
  const loc=currentLocation(x.category==='plugin'?'plugin':'license',x.id);
  const sid=x.category==='avid'&&x.system_id?`System ID ${esc(x.system_id)}`:'';

  return `<button class="list-card license-card ${st.level==='warning'?'license-warning':st.level==='expired'?'license-expired':''}" data-item="licenses:${x.id}">
    <div class="license-card-content">
      <div class="license-card-top">
        <h3>${esc(x.code)}</h3>
        <span class="license-sid">${sid}</span>
      </div>
      <div class="badges">
        <span class="badge ${x.category==='avid'?(x.avid_type==='Ultimate'?'ultimate':'singolo'):'plugin'}">${esc((kind||'').toUpperCase())}</span>
        <span class="badge ${x.billing_cycle}">${cycleLabel(x.billing_cycle)}</span>
        ${x.is_trial?'<span class="badge trial">TRIAL</span>':''}
      </div>
      <div class="license-card-bottom">
        <span class="license-time">${esc(st.text)}</span>
        <span class="license-location">${locationMarkup(loc)}</span>
      </div>
    </div>
    <span class="card-chevron">›</span>
  </button>`;
}


function expiryLabel(license){
  if(!license)return '';
  const status=licenseStatus(license);
  if(!license.expiry_date)return status.text;
  const today=new Date();today.setHours(0,0,0,0);
  const exp=new Date(license.expiry_date+'T00:00:00');
  const days=Math.ceil((exp-today)/86400000);
  if(days>90)return `Scadenza ${fmtDate(license.expiry_date)}`;
  return status.text.replace(/^Attiva • /,'');
}
function productionLabel(room){
  return [room.client_type,room.production_name].filter(Boolean).join(' • ');
}

function trialInfo(station){
  const status=station?.avid_trial_status||'none';
  const expiry=station?.avid_trial_expiry||null;

  if(status==='pending'){
    return {status,level:'ok',text:'',badge:'TRIAL DA ATTIVARE'};
  }
  if(status!=='active'){
    return {status:'none',level:'ok',text:'',badge:''};
  }
  if(!expiry){
    return {status,level:'warning',text:'Scadenza non indicata',badge:'TRIAL ATTIVA'};
  }

  const today=new Date();today.setHours(0,0,0,0);
  const exp=new Date(expiry+'T00:00:00');
  const days=Math.ceil((exp-today)/86400000);

  if(days<0)return {status,level:'expired',text:`Scaduta da ${Math.abs(days)} ${Math.abs(days)===1?'giorno':'giorni'}`,badge:'TRIAL ATTIVA'};
  if(days===0)return {status,level:'expired',text:'Scade oggi',badge:'TRIAL ATTIVA'};
  if(days>90)return {status,level:'ok',text:`Scadenza ${fmtDate(expiry)}`,badge:'TRIAL ATTIVA'};
  return {status,level:days<=10?'warning':'ok',text:`Scade tra ${days} ${days===1?'giorno':'giorni'}`,badge:'TRIAL ATTIVA'};
}

async function clearStationTrial(stationId){
  const station=state.data.stations.find(s=>s.id===stationId);
  if(!station)return;
  await saveRow('stations',{
    ...station,
    avid_trial_status:'none',
    avid_trial_expiry:null
  });
}

async function applyStationTrial(stationId,status,expiry=null){
  const station=state.data.stations.find(s=>s.id===stationId);
  if(!station)throw new Error('Postazione non trovata');

  await assignResource('license',null,stationId);
  await saveRow('stations',{
    ...station,
    avid_license_id:null,
    avid_trial_status:status,
    avid_trial_expiry:status==='active'?expiry:null
  });
  await addAudit('update','stations',stationId,{
    avid_trial_status:status,
    avid_trial_expiry:status==='active'?expiry:null
  });
}

function openTrialExpiryEditor(stationId){
  openModal(`<div class="modal-head"><h2>Trial attiva</h2><button class="close" data-close>×</button></div>
    <div class="fields">
      ${field('trial-expiry','Data scadenza Trial','','date')}
    </div>
    <div class="actions">
      <button class="secondary" data-close>Annulla</button>
      <button class="primary" id="save-trial">Salva</button>
    </div>`);

  document.getElementById('save-trial').onclick=async()=>{
    const expiry=val('trial-expiry');
    if(!expiry){
      alert('Inserisci la data di scadenza della Trial.');
      return;
    }
    try{
      await applyStationTrial(stationId,'active',expiry);
      modal.close();
      showToast('Trial attiva salvata');
      await refresh();
    }catch(error){
      alert(error.message);
    }
  };
}


function worstLevel(levels){
  return levels.includes('expired')?'expired':levels.includes('warning')?'warning':'ok';
}
function stationAvidStatus(station){
  const avid=state.data.licenses.find(x=>x.id===station.avid_license_id);
  if(avid)return {kind:'license',item:avid,status:licenseStatus(avid)};
  const trial=trialInfo(station);
  if(trial.status==='active')return {kind:'trial',item:null,status:trial};
  if(trial.status==='pending')return {kind:'trial-pending',item:null,status:trial};
  return {kind:'none',item:null,status:{level:'ok',text:''}};
}
function stationPluginItems(stationId){
  return state.data.station_plugins
    .filter(x=>x.station_id===stationId)
    .map(x=>state.data.licenses.find(l=>l.id===x.license_id))
    .filter(Boolean);
}
function roomStatusDetails(room){
  const stations=state.data.stations.filter(s=>s.room_id===room.id);
  const levels=[];
  stations.forEach(station=>{
    const avidState=stationAvidStatus(station);
    if(avidState.status?.level)levels.push(avidState.status.level);
    stationPluginItems(station.id).forEach(plugin=>levels.push(licenseStatus(plugin).level));
  });
  return worstLevel(levels);
}

function summaryLevel(room){
  return roomStatusDetails(room);
}

function summary(){
  const allRooms=[...state.data.rooms].sort((a,b)=>a.position-b.position);
  const counts=allRooms.reduce((acc,room)=>{acc[summaryLevel(room)]++;return acc},{ok:0,warning:0,expired:0});

  const unassignedComputers=state.data.computers.filter(x=>!x.archived_at&&!stationOf('computer',x.id)).sort(numSort);
  const unassignedHardware=state.data.hardware.filter(x=>!x.archived_at&&!stationOf('hardware',x.id)).sort(numSort);
  const unassignedAvid=state.data.licenses.filter(x=>!x.archived_at&&x.category==='avid'&&!stationOf('license',x.id)).sort(numSort);
  const unassignedPlugins=state.data.licenses.filter(x=>!x.archived_at&&x.category==='plugin'&&!pluginStation(x.id)).sort(numSort);

  const freeCard=(type,item)=>{
    if(type==='computers'){
      return `<button type="button" class="unassigned-asset-card" data-item="computers:${item.id}">
        <strong>${esc(item.code)}</strong>
        <span>${esc([item.model,item.variant].filter(Boolean).join(' · ')||'Disponibile')}</span>
      </button>`;
    }
    if(type==='hardware'){
      return `<button type="button" class="unassigned-asset-card" data-item="hardware:${item.id}">
        <strong>${esc(item.code)}</strong>
        <span>${esc(item.model||'Disponibile')}</span>
      </button>`;
    }

    const status=licenseStatus(item);
    const detail=item.category==='avid'
      ? `System ID ${esc(item.system_id||'—')}`
      : `Seriale ${esc(item.plugin_serial||'—')}`;
    return `<button type="button" class="unassigned-asset-card license-free-card ${status.level} ${status.level!=='ok'?'pulse-critical':''}" data-item="licenses:${item.id}">
      <div class="free-card-head"><strong>${esc(item.code)}</strong><span class="free-expiry">${esc(expiryLabel(item))}</span></div>
      <span>${esc(item.category==='avid'?item.avid_type:item.plugin_type)} · ${cycleLabel(item.billing_cycle)}</span>
      <small>${detail}</small>
    </button>`;
  };

  return `<div class="summary-toolbar">
      <div>
        <h2>Sintesi interattiva</h2>
        <p>Clicca sui riquadri per modificare le assegnazioni oppure sull’intestazione della Sala per produzione e postazioni.</p>
      </div>
      <button type="button" class="secondary" id="print-summary">Stampa</button>
    </div>

    <div class="summary-final summary-interactive">
      ${officeGroups.map((group,groupIndex)=>{
        const grouped=roomsForOffice(allRooms,group);
        return `<section class="summary-office ${groupIndex<officeGroups.length-1?'print-page-break':''}">
          <div class="office-label summary-office-label"><span>${group.title}</span></div>
          <div class="summary-office-rooms">
            ${grouped.map(room=>{
              const stations=state.data.stations.filter(s=>s.room_id===room.id).sort((a,b)=>a.position-b.position);
              const level=summaryLevel(room);
              const production=productionLabel(room);

              return `<article class="summary-production-card ${level}">
                <button type="button" class="summary-production-head summary-room-action" data-summary-room="${room.id}">
                  <div><h3>${esc(room.name)}</h3></div>
                  <span class="summary-production-name">${production?esc(production):'Produzione non indicata'}</span>
                </button>

                <div class="summary-stations">
                  ${stations.map((station,index)=>{
                    const computer=state.data.computers.find(x=>x.id===station.computer_id);
                    const hardware=state.data.hardware.find(x=>x.id===station.hardware_id);
                    const avidState=stationAvidStatus(station);
                    const avid=avidState.item;
                    const plugins=stationPluginItems(station.id);
                    const avidLevel=avidState.status?.level||'ok';
                    const pluginLevel=worstLevel(plugins.map(plugin=>licenseStatus(plugin).level));

                    return `<div class="summary-station">
                      ${stations.length>1?`<div class="summary-station-label">POSTAZIONE ${index+1}</div>`:''}

                      <button type="button" class="summary-resource summary-computer summary-assignable" data-summary-assign="computer" data-station="${station.id}">
                        <small>COMPUTER</small>
                        <strong>${computer?esc(computer.code):'—'}</strong>
                        <span>${computer?esc([computer.model,computer.variant].filter(Boolean).join(' · ')):'Non assegnato'}</span>
                        ${computer?.os_name?`<span class="badge os os-${esc(computer.os_name.toLowerCase())}">${esc(computer.os_name.toUpperCase())}</span>`:''}
                        <i class="summary-edit-hint">Modifica</i>
                      </button>

                      <button type="button" class="summary-resource summary-hardware summary-assignable" data-summary-assign="hardware" data-station="${station.id}">
                        <small>HARDWARE</small>
                        <strong>${hardware?esc(hardware.code):'—'}</strong>
                        <span>${hardware?esc(hardware.model||''):'Non assegnato'}</span>
                        <i class="summary-edit-hint">Modifica</i>
                      </button>

                      <button type="button" class="summary-resource summary-avid summary-assignable ${avidLevel} ${avidLevel!=='ok'?'pulse-critical':''}" data-summary-assign="license" data-station="${station.id}">
                        <div class="resource-title-row"><small>AVID</small><span class="resource-expiry ${avidLevel}">${avidState.kind==='license'?esc(expiryLabel(avid)):avidState.kind==='trial'?esc(avidState.status.text):''}</span></div>
                        <strong>${avidState.kind==='license'?esc(avid.code):avidState.kind.startsWith('trial')?'TRIAL':'—'}</strong>
                        ${avidState.kind==='license'
                          ? `<div class="badges"><span class="badge ${avid.avid_type==='Ultimate'?'ultimate':'singolo'}">${esc(avid.avid_type.toUpperCase())}</span><span class="badge ${avid.billing_cycle}">${cycleLabel(avid.billing_cycle)}</span></div><span class="resource-id">System ID ${esc(avid.system_id||'—')}</span>`
                          : avidState.kind==='trial-pending'
                            ? '<div class="badges"><span class="badge trial-pending">TRIAL DA ATTIVARE</span></div>'
                            : avidState.kind==='trial'
                              ? '<div class="badges"><span class="badge trial-active">TRIAL ATTIVA</span></div>'
                              : '<span>Non assegnata</span>'}
                        <i class="summary-edit-hint">Modifica</i>
                      </button>

                      <button type="button" class="summary-resource summary-plugins summary-assignable ${pluginLevel} ${pluginLevel!=='ok'?'pulse-critical':''}" data-summary-assign="plugin" data-station="${station.id}">
                        <div class="resource-title-row"><small>PLUGIN</small><span></span></div>
                        ${plugins.length?plugins.map(plugin=>{
                          const status=licenseStatus(plugin);
                          return `<div class="summary-plugin ${status.level}">
                            <div class="plugin-head"><strong>${esc(plugin.plugin_type)}</strong><span class="resource-expiry ${status.level}">${esc(expiryLabel(plugin))}</span></div>
                            <div class="badges"><span class="badge ${plugin.billing_cycle}">${cycleLabel(plugin.billing_cycle)}</span></div>
                            <span class="resource-id">Seriale ${esc(plugin.plugin_serial||'—')}</span>
                          </div>`;
                        }).join(''):'<span>Non assegnato</span>'}
                        <i class="summary-edit-hint">Modifica</i>
                      </button>
                    </div>`;
                  }).join('')}
                </div>
              </article>`;
            }).join('')}
          </div>
        </section>`;
      }).join('')}

      <section class="unassigned-section">
        <div class="office-label"><span>Non assegnati</span></div>
        <div class="unassigned-grid">
          <div class="unassigned-column computer">
            <header><span>COMPUTER</span><strong>${unassignedComputers.length}</strong></header>
            <div class="unassigned-list">${unassignedComputers.length?unassignedComputers.map(x=>freeCard('computers',x)).join(''):'<div class="unassigned-empty">Nessun Computer libero</div>'}</div>
          </div>
          <div class="unassigned-column hardware">
            <header><span>HARDWARE</span><strong>${unassignedHardware.length}</strong></header>
            <div class="unassigned-list">${unassignedHardware.length?unassignedHardware.map(x=>freeCard('hardware',x)).join(''):'<div class="unassigned-empty">Nessun Hardware libero</div>'}</div>
          </div>
          <div class="unassigned-column avid">
            <header><span>AVID</span><strong>${unassignedAvid.length}</strong></header>
            <div class="unassigned-list">${unassignedAvid.length?unassignedAvid.map(x=>freeCard('licenses',x)).join(''):'<div class="unassigned-empty">Nessuna Avid libera</div>'}</div>
          </div>
          <div class="unassigned-column plugins">
            <header><span>PLUGIN</span><strong>${unassignedPlugins.length}</strong></header>
            <div class="unassigned-list">${unassignedPlugins.length?unassignedPlugins.map(x=>freeCard('licenses',x)).join(''):'<div class="unassigned-empty">Nessun Plugin libero</div>'}</div>
          </div>
        </div>
      </section>

      <footer class="summary-footer glass">
        <div><strong>${allRooms.length}</strong><span>Sale</span></div>
        <div class="ok"><strong>${counts.ok}</strong><span>OK</span></div>
        <div class="warning"><strong>${counts.warning}</strong><span>In scadenza</span></div>
        <div class="expired"><strong>${counts.expired}</strong><span>Scadute</span></div>
        <small>Aggiornato ${new Date().toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}</small>
      </footer>
    </div>`;
}

function settings(){
  return `<div class="list">
    <button class="list-card" data-setting="audit"><div><h3>Registro modifiche</h3><p>Storico automatico delle operazioni.</p></div><span>›</span></button>
    <button class="list-card" data-setting="archive"><div><h3>Archivio</h3><p>Elementi archiviati e ripristino.</p></div><span>›</span></button>
    <button class="list-card" data-setting="notifications"><div><h3>Notifiche</h3><p>Avvisi automatici per le licenze in scadenza.</p></div><span>›</span></button>
    <button class="list-card" data-setting="backup"><div><h3>Backup ed esportazione</h3><p>Disponibile in una versione successiva.</p></div><span>›</span></button>
    <button class="list-card" data-setting="about"><div><h3>Informazioni</h3><p>Versione, società e note della release.</p></div><span>›</span></button>
    <button class="list-card" id="logout"><div><h3>Logout</h3><p>${esc(state.session?.user?.email||'')}</p></div><span>›</span></button>
  </div>`;
}

function render(){
  if(!state.data)return;
  const add=document.getElementById('add-btn');
  if(add)add.hidden=state.view==='dashboard'||state.view==='summary'||state.view==='settings';
  app.innerHTML=state.view==='dashboard'
    ?dashboard()
    :state.view==='rooms'
      ?rooms()
      :state.view==='computers'
        ?inventory('computers')
        :state.view==='hardware'
          ?inventory('hardware')
          :state.view==='licenses'
            ?inventory('licenses')
            :state.view==='summary'
              ?summary()
              :settings();
  bindContent();
}
function bindContent(){
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
  document.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const [t,id]=b.dataset.item.split(':');openDetail(t,id)});
  document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>openRoom(b.dataset.room));
  document.querySelectorAll('[data-open-license]').forEach(b=>b.onclick=()=>openDetail('licenses',b.dataset.openLicense));
  document.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>openSetting(b.dataset.setting));
  document.querySelectorAll('[data-summary-assign]').forEach(b=>b.onclick=()=>assignmentSheet(b.dataset.summaryAssign,b.dataset.station));
  document.querySelectorAll('[data-summary-room]').forEach(b=>b.onclick=()=>openSummaryRoomActions(b.dataset.summaryRoom));
  document.getElementById('logout')?.addEventListener('click',async()=>supabase.auth.signOut());
  document.getElementById('print-summary')?.addEventListener('click',()=>window.print());
}


function openSummaryRoomActions(roomId){
  const room=state.data.rooms.find(r=>r.id===roomId);
  const stations=state.data.stations.filter(s=>s.room_id===roomId).sort((a,b)=>a.position-b.position);

  openSheet(`<div class="modal-head"><h2>${esc(room.name)}</h2><button class="close" data-close-sheet>×</button></div>
    <button class="choice" id="summary-production-action"><strong>Produzione</strong><br><small>${esc(productionLabel(room)||'Non indicata')}</small></button>
    <button class="choice" id="summary-add-station"><strong>Aggiungi postazione</strong><br><small>Crea quattro riquadri vuoti nella Sala</small></button>
    <button class="choice" data-close-sheet><strong>Chiudi</strong></button>`);

  document.getElementById('summary-production-action').onclick=()=>{
    sheet.close();
    openProductionEditor(room);
  };

  document.getElementById('summary-add-station').onclick=async()=>{
    try{
      await saveRow('stations',{id:uuid(),room_id:room.id,position:stations.length+1});
      await addAudit('create','stations',room.id,{room:room.name});
      sheet.close();
      showToast('Postazione aggiunta');
      await refresh();
    }catch(error){alert(error.message)}
  };
}

function openDetail(type,id){const x=state.data[type].find(v=>v.id===id);const rows=type==='computers'?[['ID',x.code],['Modello',x.model],['Anno',x.variant],['Processore',x.cpu],['RAM',x.ram],['GPU',x.gpu],['Seriale',x.serial],['macOS',`${x.os_name||''} ${x.os_version||''}`],['Formattazione',fmtDate(x.formatted_at)],['Assegnazione',currentLocation('computer',x.id)],['Allegati',String(x.attachments_count||0)]]:type==='hardware'?[['ID',x.code],['Modello',x.model],['Seriale',x.serial],['Driver',x.driver_version],['Assegnazione',currentLocation('hardware',x.id)],['Allegati',String(x.attachments_count||0)]]:[['ID',x.code],['Categoria',x.category==='avid'?'Avid':'Plugin'],['Tipo',x.category==='avid'?x.avid_type:x.plugin_type],['System ID',x.system_id],['Codice / Seriale',x.activation_code||x.plugin_serial],['Versione',x.version],['Durata',cycleLabel(x.billing_cycle)],['Scadenza',fmtDate(x.expiry_date)],['Sospensione richiesta',x.deactivation_requested?'Sì':'No'],['Assegnazione',currentLocation(x.category==='plugin'?'plugin':'license',x.id)],['Allegati',String(x.attachments_count||0)]];openModal(`<div class="modal-head"><h2>${esc(x.code)}</h2><button class="close" data-close>×</button></div><div class="fields">${rows.map(([a,b])=>`<div class="resource-row"><span class="subtle">${esc(a)}</span><strong>${esc(b||'—')}</strong></div>`).join('')}</div><div class="actions"><button class="secondary" id="archive-item">Archivia</button><button class="primary" id="edit-item">Modifica</button></div>`);document.getElementById('edit-item').onclick=()=>editItem(type,x);document.getElementById('archive-item').onclick=async()=>{if(confirm(`Archiviare ${x.code}?`)){await archiveRow(type,x.id);await addAudit('archive',type,x.id,{code:x.code});modal.close();await refresh()}}}

function field(id,label,value='',type='text'){return `<label class="field">${label}<input id="${id}" type="${type}" value="${esc(value??'')}"></label>`}
function select(id,label,options,value=''){return `<label class="field">${label}<select id="${id}">${options.map(v=>`<option value="${esc(v[0])}" ${v[0]===value?'selected':''}>${esc(v[1])}</option>`).join('')}</select></label>`}


function calculateExpiry(start,cycle){
  if(!start)return '';
  const [y,m,d]=start.split('-').map(Number);
  if(!y||!m||!d)return '';
  const result=new Date(y,m-1,d);
  if(cycle==='monthly')result.setMonth(result.getMonth()+1);
  else result.setFullYear(result.getFullYear()+1);
  const yy=result.getFullYear();
  const mm=String(result.getMonth()+1).padStart(2,'0');
  const dd=String(result.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}
function segmented(id,label,options,value=''){
  const current=value||options[0]?.[0]||'';
  return `<div class="field"><span>${esc(label)}</span><div class="segmented" data-segment="${id}">${options.map(([v,l])=>`<button type="button" class="${v===current?'active':''}" data-segment-value="${esc(v)}">${esc(l)}</button>`).join('')}</div><input type="hidden" id="${id}" value="${esc(current)}"></div>`;
}
function bindSegments(root=document){
  root.querySelectorAll('[data-segment]').forEach(group=>{
    group.querySelectorAll('[data-segment-value]').forEach(button=>{
      button.onclick=()=>{
        group.querySelectorAll('[data-segment-value]').forEach(peer=>peer.classList.remove('active'));
        button.classList.add('active');
        const input=document.getElementById(group.dataset.segment);
        if(input){
          input.value=button.dataset.segmentValue;
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
      };
    });
  });
}
function val(id){return document.getElementById(id)?.value?.trim()||''}
function checked(id){return document.getElementById(id)?.checked||false}
function editItem(type,x={_new:true,id:uuid()}){const isNew=x._new;if(type==='computers')openModal(`<div class="modal-head"><h2>${isNew?'Nuovo computer':esc(x.code)}</h2><button class="close" data-close>×</button></div><div class="fields">${field('code','ID',x.code)}${field('model','Modello',x.model)}${field('variant','Anno / Variante',x.variant)}${field('cpu','Processore / Chip',x.cpu)}${field('ram','RAM',x.ram)}${field('gpu','Scheda grafica',x.gpu)}${field('storage','Archiviazione',x.storage)}${field('serial','Numero seriale',x.serial)}${segmented('os','Sistema operativo',[['Mojave','MOJAVE'],['Monterey','MONTEREY'],['Ventura','VENTURA'],['Sonoma','SONOMA'],['Sequoia','SEQUOIA'],['Tahoe','TAHOE']],x.os_name||'Monterey')}${field('osv','Versione macOS',x.os_version)}${field('formatted','Data formattazione',x.formatted_at,'date')}${stationSelectHTML('assignment','Assegnazione',stationOf('computer',x.id)?.id||'')}${field('notes','Note',x.notes)}</div><div class="actions"><button class="secondary" data-close>Annulla</button><button class="primary" id="save">Salva</button></div>`);else if(type==='hardware')openModal(`<div class="modal-head"><h2>${isNew?'Nuovo hardware':esc(x.code)}</h2><button class="close" data-close>×</button></div><div class="fields">${field('code','ID',x.code)}${field('category','Categoria / Tipo',x.category)}${field('model','Modello',x.model)}${field('serial','Numero seriale',x.serial)}${field('driver','Driver / Firmware',x.driver_version)}${stationSelectHTML('assignment','Assegnazione',stationOf('hardware',x.id)?.id||'')}${field('notes','Note',x.notes)}</div><div class="actions"><button class="secondary" data-close>Annulla</button><button class="primary" id="save">Salva</button></div>`);else licenseEditor(x,isNew);bindSegments(modalBody);document.getElementById('save')?.addEventListener('click',()=>saveEditor(type,x,isNew))}
function stationSelectHTML(id,label,value){
  const stations=[...state.data.stations].sort((a,b)=>{
    const roomA=state.data.rooms.find(r=>r.id===a.room_id);
    const roomB=state.data.rooms.find(r=>r.id===b.room_id);
    return (roomA?.position||0)-(roomB?.position||0)||a.position-b.position;
  });
  return select(id,label,[['','Non assegnato'],...stations.map(s=>[s.id,stationLabel(s)])],value);
}
function licenseEditor(x,isNew){
  const activation=x.activation_date||todayISO();
  const cycle=x.billing_cycle||'annual';
  const expiry=x.expiry_date||calculateExpiry(activation,cycle);

  openModal(`<div class="modal-head"><h2>${isNew?'Nuova licenza':esc(x.code)}</h2><button class="close" data-close>×</button></div>
  <div class="fields">
    ${segmented('category','Categoria',[['avid','AVID'],['plugin','PLUGIN']],x.category||'avid')}
    ${field('code','ID',x.code)}
    <div id="license-fields"></div>


    ${segmented('cycle','Durata',[['monthly','MENSILE'],['annual','ANNUALE']],cycle)}
    ${field('activation','Data attivazione',activation,'date')}
    ${field('expiry','Scadenza',expiry,'date')}

    <label class="option-check">
      <input id="deactivation" type="checkbox" ${x.deactivation_requested?'checked':''}>
      <span>Disattivazione richiesta</span>
    </label>

    ${stationSelectHTML('assignment','Assegnazione',(x.category==='plugin'?pluginStation(x.id):stationOf('license',x.id))?.id||'')}
    ${field('notes','Note',x.notes)}
  </div>
  <div class="actions"><button class="secondary" data-close>Annulla</button><button class="primary" id="save">Salva</button></div>`);

  const draw=()=>{
    const cat=val('category');
    document.getElementById('license-fields').innerHTML=cat==='avid'
      ? `${segmented('avid-type','Tipo Avid',[['Singolo','SINGOLO'],['Ultimate','ULTIMATE']],x.avid_type||'Ultimate')}
         ${field('system','System ID',x.system_id)}
         ${field('activation-code','Codice attivazione',x.activation_code)}
         ${field('version','Versione',x.version)}`
      : `${segmented('plugin-type','Tipo Plugin',[['Continuum','CONTINUUM'],['Sapphire','SAPPHIRE']],x.plugin_type||'Continuum')}
         ${field('plugin-serial','Seriale Plugin',x.plugin_serial)}`;
    bindSegments(document.getElementById('license-fields'));
  };

  const refreshExpiry=()=>{
    const expiryInput=document.getElementById('expiry');
    if(expiryInput)expiryInput.value=calculateExpiry(val('activation'),val('cycle'));
  };

  bindSegments(modalBody);
  draw();
  document.getElementById('category').onchange=draw;
  document.getElementById('cycle').onchange=refreshExpiry;
  document.getElementById('activation').onchange=refreshExpiry;
}

async function confirmAssignment(kind,item,newStationId){
  if(!newStationId)return true;
  const old=kind==='plugin'?pluginStation(item.id):stationOf(kind,item.id);
  const target=state.data.stations.find(s=>s.id===newStationId);
  if(old&&old.id!==newStationId&&!confirm(`${item.code} è già assegnato a ${stationLabel(old)}.\n\nVuoi spostarlo a ${stationLabel(target)}?`))return false;
  if(kind!=='plugin'){
    const occupiedId=kind==='computer'?target.computer_id:kind==='hardware'?target.hardware_id:target.avid_license_id;
    const list=kind==='computer'?state.data.computers:kind==='hardware'?state.data.hardware:state.data.licenses;
    const occupied=list.find(x=>x.id===occupiedId);
    if(occupied&&occupied.id!==item.id&&!confirm(`${stationLabel(target)} utilizza già ${occupied.code}.\n\nVuoi sostituirlo? ${occupied.code} tornerà Non assegnato.`))return false;
  }
  return true;
}

async function saveEditor(type,x,isNew){try{let row={id:x.id};let assignment=val('assignment');if(type==='computers')Object.assign(row,{code:val('code'),model:val('model'),variant:val('variant'),cpu:val('cpu'),ram:val('ram'),gpu:val('gpu'),storage:val('storage'),serial:val('serial'),os_name:val('os'),os_version:val('osv'),formatted_at:val('formatted')||null,notes:val('notes'),attachments_count:x.attachments_count||0});else if(type==='hardware')Object.assign(row,{code:val('code'),category:val('category'),model:val('model'),serial:val('serial'),driver_version:val('driver'),notes:val('notes'),attachments_count:x.attachments_count||0});else Object.assign(row,{code:val('code'),category:val('category'),avid_type:val('category')==='avid'?val('avid-type'):null,plugin_type:val('category')==='plugin'?val('plugin-type'):null,system_id:val('system')||null,activation_code:val('activation-code')||null,plugin_serial:val('plugin-serial')||null,version:val('version')||null,billing_cycle:val('cycle'),is_trial:false,activation_date:val('activation')||null,expiry_date:val('expiry')||null,deactivation_requested:checked('deactivation'),notes:val('notes'),attachments_count:x.attachments_count||0});const kind=type==='computers'?'computer':type==='hardware'?'hardware':row.category==='plugin'?'plugin':'license';if(!(await confirmAssignment(kind,{...x,...row},assignment)))return;const saved=await saveRow(type,row);if(type==='computers')await assignResource('computer',saved.id,assignment||null);if(type==='hardware')await assignResource('hardware',saved.id,assignment||null);if(type==='licenses'){
  if(saved.category==='plugin'){
    await assignPlugin(saved.id,assignment||null);
  }else{
    if(assignment)await clearStationTrial(assignment);
    await assignResource('license',saved.id,assignment||null);
  }
}await addAudit(isNew?'create':'update',type,saved.id,{code:saved.code});modal.close();showToast('Salvato');await refresh()}catch(e){alert(e.message)}}

function openRoom(id){
  const room=state.data.rooms.find(r=>r.id===id);
  const sts=state.data.stations.filter(s=>s.room_id===id).sort((a,b)=>a.position-b.position);

  openModal(`<div class="modal-head"><h2>${esc(room.name)}</h2><button class="close" data-close>×</button></div>
    <div class="fields">
      ${sts.map((s,i)=>`<section class="card"><div class="resource-row"><strong>${sts.length>1?`Postazione ${i+1}`:'Configurazione sala'}</strong>${i>0?`<button class="danger" data-delete-station="${s.id}">Elimina</button>`:''}</div>${assignmentButton('computer',s)}${assignmentButton('hardware',s)}${assignmentButton('license',s)}${pluginButton(s)}</section>`).join('')}
    </div>
    <div class="actions room-actions">
      <button class="secondary" id="edit-production">Produzione</button>
      <button class="secondary" id="add-station">＋ Aggiungi postazione</button>
      <button class="primary" data-close>Chiudi</button>
    </div>`);

  document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>assignmentSheet(b.dataset.assign,b.dataset.station));
  document.getElementById('edit-production').onclick=()=>openProductionEditor(room);
  document.getElementById('add-station').onclick=async()=>{
    await saveRow('stations',{id:uuid(),room_id:room.id,position:sts.length+1});
    await addAudit('create','stations',room.id,{room:room.name});
    modal.close();await refresh();openRoom(id);
  };
  document.querySelectorAll('[data-delete-station]').forEach(b=>b.onclick=async()=>{
    if(confirm('Eliminare questa postazione? Gli elementi assegnati torneranno Non assegnati.')){
      await removeRow('stations',b.dataset.deleteStation);
      modal.close();await refresh();openRoom(id);
    }
  });
}

function openProductionEditor(room){
  openModal(`<div class="modal-head"><h2>Produzione · ${esc(room.name)}</h2><button class="close" data-close>×</button></div>
    <div class="fields">
      ${segmented('client-type','Committente',[['RAI','RAI'],['PRIVATO','PRIVATO'],['ALTRO','ALTRO']],room.client_type||'RAI')}
      ${field('production-name','Produzione',room.production_name||'')}
    </div>
    <p class="production-help">Questa informazione sarà visibile soltanto nella Sintesi e nella relativa stampa.</p>
    <div class="actions"><button class="secondary" data-close>Annulla</button><button class="primary" id="save-production">Salva</button></div>`);
  bindSegments(modalBody);
  document.getElementById('save-production').onclick=async()=>{
    try{
      await saveRow('rooms',{...room,client_type:val('client-type'),production_name:val('production-name')});
      await addAudit('update','rooms',room.id,{production:val('production-name')});
      modal.close();showToast('Produzione salvata');await refresh();openRoom(room.id);
    }catch(error){alert(error.message)}
  };
}
function assignmentButton(kind,s){const id=kind==='computer'?s.computer_id:kind==='hardware'?s.hardware_id:s.avid_license_id;const table=kind==='computer'?'computers':kind==='hardware'?'hardware':'licenses';const x=state.data[table].find(v=>v.id===id);return `<button class="list-card" data-assign="${kind}" data-station="${s.id}"><div><h3>${kind==='computer'?'Computer':kind==='hardware'?'Hardware':'Licenza Avid'}</h3><p>${x?`${esc(x.code)} · ${esc(x.model||x.avid_type||'')}`:'Non assegnato'}</p></div><span>›</span></button>`}
function pluginButton(s){const ps=state.data.station_plugins.filter(x=>x.station_id===s.id).map(x=>state.data.licenses.find(l=>l.id===x.license_id)).filter(Boolean);return `<button class="list-card" data-assign="plugin" data-station="${s.id}"><div><h3>Plugin</h3><p>${ps.length?ps.map(p=>p.plugin_type).join(', '):'Nessun plugin'}</p></div><span>›</span></button>`}
function assignmentSheet(kind,stationId){
  let items;
  if(kind==='computer')items=state.data.computers.filter(x=>!x.archived_at);
  else if(kind==='hardware')items=state.data.hardware.filter(x=>!x.archived_at);
  else items=state.data.licenses.filter(x=>!x.archived_at&&x.category===(kind==='plugin'?'plugin':'avid'));

  const station=state.data.stations.find(s=>s.id===stationId);
  const current=kind==='plugin'
    ? state.data.station_plugins.filter(x=>x.station_id===stationId).map(x=>x.license_id)
    : [kind==='computer'?station.computer_id:kind==='hardware'?station.hardware_id:station.avid_license_id].filter(Boolean);

  openSheet(`<div class="modal-head"><h2>Seleziona ${kind==='computer'?'Computer':kind==='hardware'?'Hardware':kind==='plugin'?'Plugin':'Avid'}</h2><button class="close" data-close-sheet>×</button></div>
    <button class="choice" data-choice="">Non assegnato</button>
    ${kind==='license'?'<div class="choice-section-label">LICENZE AVID</div>':''}
    ${items.sort(numSort).map(x=>{
      const used=kind==='plugin'?pluginStation(x.id):stationOf(kind==='license'?'license':kind,x.id);
      return `<button class="choice ${used&&used.id!==stationId?'used':'free'} ${current.includes(x.id)?'selected':''}" data-choice="${x.id}">
        <strong>${esc(x.code)} · ${esc(x.model||x.avid_type||x.plugin_type||'')}</strong><br>
        <small>${used?esc(stationLabel(used)):'Disponibile'}</small>
      </button>`;
    }).join('')}
    ${kind==='license'?`
      <div class="choice-section-label">TRIAL</div>
      <button class="choice trial-choice trial-choice-pending ${station.avid_trial_status==='pending'?'selected':''}" data-trial="pending">
        <strong>Trial da attivare</strong><br><small>Disponibile, ma non ancora avviata</small>
      </button>
      <button class="choice trial-choice trial-choice-active ${station.avid_trial_status==='active'?'selected':''}" data-trial="active">
        <strong>Trial attiva</strong><br><small>${station.avid_trial_expiry?`Scadenza ${fmtDate(station.avid_trial_expiry)}`:'Inserisci la data di scadenza'}</small>
      </button>`:''}`);

  sheetBody.querySelectorAll('[data-choice]').forEach(button=>{
    button.onclick=async()=>{
      const id=button.dataset.choice||null;
      try{
        if(kind==='plugin'){
          if(!id){
            for(const pluginId of current)await assignPlugin(pluginId,null);
          }else{
            const selected=current.includes(id);
            const item=state.data.licenses.find(x=>x.id===id);
            if(!selected&&!(await confirmAssignment('plugin',item,stationId)))return;
            await assignPlugin(id,selected?null:stationId);
          }
        }else{
          if(id){
            const list=kind==='computer'?state.data.computers:kind==='hardware'?state.data.hardware:state.data.licenses;
            const item=list.find(x=>x.id===id);
            if(!(await confirmAssignment(kind==='license'?'license':kind,item,stationId)))return;
          }
          if(kind==='license')await clearStationTrial(stationId);
          await assignResource(kind,id,stationId);
        }

        sheet.close();
        if(modal.open)modal.close();
        await refresh();
        if(state.view==='rooms')openRoom(station.room_id);
      }catch(error){alert(error.message)}
    };
  });

  sheetBody.querySelectorAll('[data-trial]').forEach(button=>{
    button.onclick=async()=>{
      const status=button.dataset.trial;
      try{
        sheet.close();
        if(status==='pending'){
          await applyStationTrial(stationId,'pending',null);
          showToast('Trial da attivare impostata');
          await refresh();
        }else{
          openTrialExpiryEditor(stationId);
        }
      }catch(error){alert(error.message)}
    };
  });
}


function buildSearchIndex(){
  const results=[];

  [...state.data.rooms].sort((a,b)=>a.position-b.position).forEach(room=>{
    const stations=state.data.stations.filter(s=>s.room_id===room.id);
    const terms=[room.name,room.client_type,room.production_name];
    stations.forEach(station=>{
      const computer=state.data.computers.find(x=>x.id===station.computer_id);
      const hardware=state.data.hardware.find(x=>x.id===station.hardware_id);
      const avid=state.data.licenses.find(x=>x.id===station.avid_license_id);
      const plugins=state.data.station_plugins
        .filter(x=>x.station_id===station.id)
        .map(x=>state.data.licenses.find(l=>l.id===x.license_id))
        .filter(Boolean);
      if(computer)terms.push(computer.code,computer.model,computer.variant,computer.os_name,computer.os_version);
      if(hardware)terms.push(hardware.code,hardware.model,hardware.serial);
      if(avid)terms.push(avid.code,avid.avid_type,avid.billing_cycle);
      plugins.forEach(p=>terms.push(p.code,p.plugin_type,p.billing_cycle));
    });
    results.push({
      kind:'room',
      id:room.id,
      title:room.name,
      subtitle:[productionLabel(room),`${stations.length} ${stations.length===1?'postazione':'postazioni'}`].filter(Boolean).join(' · '),
      terms:terms.filter(Boolean).join(' ').toLowerCase()
    });
  });

  state.data.computers.filter(x=>!x.archived_at).forEach(x=>{
    results.push({
      kind:'computers',id:x.id,
      title:x.code,
      subtitle:[x.model,x.variant,x.os_name].filter(Boolean).join(' · '),
      terms:[x.code,x.model,x.variant,x.cpu,x.ram,x.gpu,x.serial,x.os_name,x.os_version,currentLocation('computer',x.id)].filter(Boolean).join(' ').toLowerCase()
    });
  });

  state.data.hardware.filter(x=>!x.archived_at).forEach(x=>{
    results.push({
      kind:'hardware',id:x.id,
      title:x.code,
      subtitle:[x.model,currentLocation('hardware',x.id)].filter(Boolean).join(' · '),
      terms:[x.code,x.model,x.serial,x.driver_version,currentLocation('hardware',x.id)].filter(Boolean).join(' ').toLowerCase()
    });
  });

  state.data.licenses.filter(x=>!x.archived_at).forEach(x=>{
    const type=x.category==='avid'?x.avid_type:x.plugin_type;
    const location=currentLocation(x.category==='plugin'?'plugin':'license',x.id);
    results.push({
      kind:'licenses',id:x.id,
      title:x.code,
      subtitle:[type,cycleLabel(x.billing_cycle),location].filter(Boolean).join(' · '),
      terms:[x.code,x.category,type,x.system_id,x.activation_code,x.plugin_serial,x.version,x.billing_cycle,location].filter(Boolean).join(' ').toLowerCase()
    });
  });

  return results;
}

function openGlobalSearch(){
  const index=buildSearchIndex();
  openModal(`<div class="modal-head"><h2>Ricerca globale</h2><button class="close" data-close>×</button></div>
    <label class="search-field">
      <span>Trova sale, computer, hardware o licenze</span>
      <input id="global-search-input" type="search" placeholder="Es. MAC 04, Monterey, Ultimate…" autocomplete="off">
    </label>
    <div id="global-search-results" class="search-results">
      <div class="search-hint">Scrivi almeno un carattere per iniziare.</div>
    </div>`);

  const input=document.getElementById('global-search-input');
  const container=document.getElementById('global-search-results');

  const draw=()=>{
    const query=input.value.trim().toLowerCase();
    if(!query){
      container.innerHTML='<div class="search-hint">Scrivi almeno un carattere per iniziare.</div>';
      return;
    }

    const words=query.split(/\s+/).filter(Boolean);
    const matches=index.filter(item=>words.every(word=>item.terms.includes(word))).slice(0,50);

    container.innerHTML=matches.length
      ? matches.map(item=>`<button type="button" class="search-result" data-search-kind="${item.kind}" data-search-id="${item.id}">
          <div><strong>${esc(item.title)}</strong><small>${esc(item.subtitle||'')}</small></div><span>›</span>
        </button>`).join('')
      : '<div class="search-hint">Nessun risultato trovato.</div>';

    container.querySelectorAll('[data-search-kind]').forEach(button=>{
      button.onclick=()=>{
        const kind=button.dataset.searchKind;
        const id=button.dataset.searchId;
        modal.close();
        if(kind==='room')openRoom(id);
        else openDetail(kind,id);
      };
    });
  };

  input.addEventListener('input',draw);
  requestAnimationFrame(()=>input.focus());
}


function base64UrlToUint8Array(value){
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
}
function pushSupported(){
  return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
}
function isStandaloneApp(){
  return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
}
async function rawPushSubscription(){
  if(!pushSupported())return null;
  const registration=await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
function bytesEqual(left,right){
  if(!left||!right||left.byteLength!==right.byteLength)return false;
  const a=new Uint8Array(left),b=new Uint8Array(right);
  return a.every((value,index)=>value===b[index]);
}
function subscriptionUsesCurrentKey(subscription){
  const current=subscription?.options?.applicationServerKey;
  return !!current&&bytesEqual(current,base64UrlToUint8Array(VAPID_PUBLIC_KEY));
}
async function currentPushSubscription(){
  const subscription=await rawPushSubscription();
  return subscriptionUsesCurrentKey(subscription)?subscription:null;
}
async function savePushSubscription(subscription){
  const json=subscription.toJSON();
  const {error}=await supabase.from('push_subscriptions').upsert({
    user_id:state.session.user.id,
    endpoint:subscription.endpoint,
    p256dh:json.keys?.p256dh||'',
    auth:json.keys?.auth||'',
    user_agent:navigator.userAgent,
    device_label:[navigator.platform||'',isStandaloneApp()?'App installata':'Browser'].filter(Boolean).join(' · '),
    enabled:true,
    updated_at:new Date().toISOString()
  },{onConflict:'endpoint'});
  if(error)throw error;
}
async function enablePushNotifications(){
  if(!pushSupported())throw new Error('Le notifiche push non sono supportate su questo dispositivo o browser.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Autorizzazione alle notifiche non concessa.');
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();

  if(subscription&&!subscriptionUsesCurrentKey(subscription)){
    const oldEndpoint=subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint',oldEndpoint);
    subscription=null;
  }

  if(!subscription){
    subscription=await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToUint8Array(VAPID_PUBLIC_KEY)
    });
  }
  await savePushSubscription(subscription);
  return subscription;
}
async function disablePushNotifications(){
  const subscription=await rawPushSubscription();
  if(!subscription)return;
  const endpoint=subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint',endpoint);
}
async function showLocalPushTest(){
  if(Notification.permission!=='granted')throw new Error('Prima attiva le notifiche.');
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification('DVS Gestionale',{
    body:'Notifiche attive su questo dispositivo.',
    icon:'./assets/logo-dvs.png',
    badge:'./assets/logo-dvs.png',
    tag:'dvs-local-test'
  });
}
async function openNotificationsSetting(){
  const supported=pushSupported();
  const rawSubscription=supported?await rawPushSubscription():null;
  const subscription=rawSubscription&&subscriptionUsesCurrentKey(rawSubscription)?rawSubscription:null;
  const needsUpdate=!!rawSubscription&&!subscription;
  const installed=isStandaloneApp();
  const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);

  openModal(`<div class="modal-head"><h2>Notifiche</h2><button class="close" data-close>×</button></div>
    <section class="notification-settings">
      <div class="notification-state ${subscription?'enabled':'disabled'}">
        <strong>${subscription?'Notifiche attive':needsUpdate?'Aggiornamento notifiche richiesto':'Notifiche non attive'}</strong>
        <span>${supported?(needsUpdate?'Premi Aggiorna notifiche per registrare la nuova chiave di sicurezza.':'Questo dispositivo può ricevere gli avvisi delle scadenze.'):'Questo browser non supporta le notifiche push.'}</span>
      </div>

      ${isiOS&&!installed?`<div class="notification-notice"><strong>Su iPhone e iPad</strong><span>Apri il gestionale da Safari, scegli Condividi → Aggiungi alla schermata Home, poi riaprilo dall’icona.</span></div>`:''}

      <div class="notification-schedule">
        <h3>Avvisi previsti</h3>
        <div><span>10 giorni prima</span><strong>✓</strong></div>
        <div><span>5 giorni prima</span><strong>✓</strong></div>
        <div><span>3 giorni prima</span><strong>✓</strong></div>
        <div><span>1 giorno prima</span><strong>✓</strong></div>
        <div><span>Giorno della scadenza</span><strong>✓</strong></div>
        <div><span>Dopo la scadenza</span><strong>Una volta al giorno</strong></div>
      </div>

      <div class="actions">
        ${subscription
          ? '<button class="secondary" id="test-notifications">Prova notifica</button><button class="danger" id="disable-notifications">Disattiva</button>'
          : '<button class="primary" id="enable-notifications" '+(!supported?'disabled':'')+'>'+(needsUpdate?'Aggiorna notifiche':'Attiva notifiche')+'</button>'}
      </div>
    </section>`);

  document.getElementById('enable-notifications')?.addEventListener('click',async()=>{
    try{
      await enablePushNotifications();
      showToast('Notifiche attivate');
      modal.close();
      await openNotificationsSetting();
    }catch(error){alert(error.message)}
  });
  document.getElementById('disable-notifications')?.addEventListener('click',async()=>{
    if(!confirm('Disattivare le notifiche su questo dispositivo?'))return;
    try{
      await disablePushNotifications();
      showToast('Notifiche disattivate');
      modal.close();
      await openNotificationsSetting();
    }catch(error){alert(error.message)}
  });
  document.getElementById('test-notifications')?.addEventListener('click',async()=>{
    try{await showLocalPushTest()}catch(error){alert(error.message)}
  });
}

function openSetting(k){
  if(k==='audit'){
    openModal(`<div class="modal-head"><h2>Registro modifiche</h2><button class="close" data-close>×</button></div><div class="list">${state.data.audit_log.length?state.data.audit_log.slice(0,100).map(x=>`<div class="card"><strong>${esc(x.action)} · ${esc(x.entity_type)}</strong><p>${new Date(x.created_at).toLocaleString('it-IT')}</p></div>`).join(''):'<div class="empty">Registro vuoto.</div>'}</div>`);
  }else if(k==='archive'){
    const all=[...state.data.computers.map(x=>({...x,_table:'computers'})),...state.data.hardware.map(x=>({...x,_table:'hardware'})),...state.data.licenses.map(x=>({...x,_table:'licenses'}))].filter(x=>x.archived_at);
    openModal(`<div class="modal-head"><h2>Archivio</h2><button class="close" data-close>×</button></div>${all.length?all.map(x=>`<div class="list-card"><div><h3>${esc(x.code)}</h3><p>${esc(x._table)}</p></div></div>`).join(''):'<div class="empty">Nessun elemento archiviato.</div>'}`);
  }else if(k==='notifications'){
    openNotificationsSetting();
  }else if(k==='about'){
    const activeComputers=state.data.computers.filter(x=>!x.archived_at).length;
    const activeHardware=state.data.hardware.filter(x=>!x.archived_at).length;
    const activeAvid=state.data.licenses.filter(x=>!x.archived_at&&x.category==='avid').length;
    const activePlugins=state.data.licenses.filter(x=>!x.archived_at&&x.category==='plugin').length;
    const systemInfo=`DVS Gestionale
Versione: 4.4 Experimental Build 1
Database: Schema 4.3.1
Sale: ${state.data.rooms.length}
Computer: ${activeComputers}
Hardware: ${activeHardware}
Licenze Avid: ${activeAvid}
Plugin: ${activePlugins}`;

    openModal(`<div class="modal-head"><h2>Informazioni</h2><button class="close" data-close>×</button></div>
      <section class="about-card about-v44">
        <img src="./assets/logo-dvs.png" alt="Digital Video Service">
        <h3>DVS Gestionale</h3>
        <p>Gestione Sale, Computer, Hardware e Licenze</p>

        <dl>
          <div><dt>Versione</dt><dd>4.4 Experimental Build 1</dd></div>
          <div><dt>Build</dt><dd>2026.07.14</dd></div>
          <div><dt>Database</dt><dd>Supabase · Schema 4.3.1</dd></div>
        </dl>

        <div class="about-section">
          <h4>Novità di questa versione</h4>
          <ul class="changelog-list">
            <li>Scadenze spostate nei riquadri Avid e Plugin</li>
            <li>Criticità evidenziate con colore e pulsazione lenta</li>
            <li>System ID e seriali visibili nella Sintesi</li>
            <li>Non assegnati con scadenze e identificativi</li>
            <li>Licenze ordinate per assegnazione e categoria</li>
            <li>Produzione e nuova postazione dalla Sintesi</li>
            <li>Rimozione diretta dei Plugin dalla postazione</li>
          </ul>
        </div>

        <div class="about-section">
          <h4>Statistiche</h4>
          <div class="about-stats">
            <div><strong>${state.data.rooms.length}</strong><span>Sale</span></div>
            <div><strong>${activeComputers}</strong><span>Computer</span></div>
            <div><strong>${activeHardware}</strong><span>Hardware</span></div>
            <div><strong>${activeAvid}</strong><span>Avid</span></div>
            <div><strong>${activePlugins}</strong><span>Plugin</span></div>
          </div>
        </div>

        <div class="developer-credit">
          <span>Sviluppato da</span>
          <strong>Marco D'Agostino</strong>
          <small>Progettazione, sviluppo e gestione del sistema</small>
          <small>Responsabile Tecnico · Digital Video Service</small>
        </div>

        <button type="button" class="secondary copy-system-info" id="copy-system-info">Copia informazioni sistema</button>
        <p class="copyright">© 2026 Marco D'Agostino per Digital Video Service S.r.l.</p>
      </section>`);

    document.getElementById('copy-system-info').onclick=async()=>{
      try{
        await navigator.clipboard.writeText(systemInfo);
        showToast('Informazioni copiate');
      }catch{
        alert(systemInfo);
      }
    };
  }else{
    showToast('Funzione prevista in una versione successiva');
  }
}

function addAction(){if(state.view==='computers')editItem('computers');else if(state.view==='hardware')editItem('hardware');else if(state.view==='licenses')editItem('licenses',{_new:true,id:uuid(),category:'avid'});else if(state.view==='rooms')openSheet(`<div class="modal-head"><h2>Aggiungi</h2><button class="close" data-close-sheet>×</button></div><button class="choice" id="a-comp">Nuovo computer</button><button class="choice" id="a-hw">Nuovo hardware</button><button class="choice" id="a-license">Nuova licenza</button>`),setTimeout(()=>{document.getElementById('a-comp').onclick=()=>{sheet.close();editItem('computers')};document.getElementById('a-hw').onclick=()=>{sheet.close();editItem('hardware')};document.getElementById('a-license').onclick=()=>{sheet.close();editItem('licenses',{_new:true,id:uuid(),category:'avid'})}},0);else showToast('Apri Computer, Hardware, Licenze o Sale')}

async function boot(){
  document.getElementById('desktop-nav').innerHTML=navHTML();
  document.getElementById('mobile-nav').innerHTML=navHTML();
  bindNav();
  document.getElementById('remember-login').checked=localStorage.getItem('dvs_remember_login')!=='0';
  setTimeout(()=>{splash.classList.add('hidden')},800);

  let {data:{session}}=await supabase.auth.getSession();
  const remember=localStorage.getItem('dvs_remember_login')!=='0';
  const active=sessionStorage.getItem('dvs_session_active')==='1';

  if(session&&!remember&&!active){
    await supabase.auth.signOut();
    session=null;
  }
  if(session)sessionStorage.setItem('dvs_session_active','1');

  handleSession(session);
  supabase.auth.onAuthStateChange((_event,s)=>{
    if(s)sessionStorage.setItem('dvs_session_active','1');
    handleSession(s);
  });
}
async function handleSession(session){state.session=session;if(!session){shell.classList.add('hidden');login.classList.remove('hidden');return}login.classList.add('hidden');shell.classList.remove('hidden');greeting.textContent=`Digital Video Service · ${session.user.email}`;try{await refresh()}catch(e){app.innerHTML=`<div class="empty"><strong>Database non ancora configurato.</strong><br><br>Esegui il file <code>sql/setup.sql</code> nel SQL Editor di Supabase e ricarica.<br><br>${esc(e.message)}</div>`}}
document.getElementById('login-form').onsubmit=async e=>{
  e.preventDefault();
  document.getElementById('login-error').textContent='';
  const remember=document.getElementById('remember-login').checked;
  localStorage.setItem('dvs_remember_login',remember?'1':'0');
  sessionStorage.setItem('dvs_session_active','1');
  const {error}=await supabase.auth.signInWithPassword({
    email:document.getElementById('email').value,
    password:document.getElementById('password').value
  });
  if(error)document.getElementById('login-error').textContent='Email o password non corrette.';
};document.getElementById('add-btn').onclick=addAction;document.getElementById('search-btn').onclick=openGlobalSearch;document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
    e.preventDefault();
    if(state.data)openGlobalSearch();
  }
  if(e.key==='Escape'){
    if(sheet.open)sheet.close();
    else if(modal.open)modal.close();
  }
});
modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=4.4.exp.b1');boot();

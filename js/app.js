import { supabase } from './supabase.js';
import { loadAll, saveRow, removeRow, archiveRow, assignResource, assignPlugin, addAudit } from './api.js';
import { esc, fmtDate, numSort, licenseStatus, cycleLabel, todayISO } from './utils.js';

const splash=document.getElementById('splash'),login=document.getElementById('login'),shell=document.getElementById('shell'),app=document.getElementById('app'),title=document.getElementById('title'),greeting=document.getElementById('greeting'),modal=document.getElementById('modal'),modalBody=document.getElementById('modal-body'),sheet=document.getElementById('sheet'),sheetBody=document.getElementById('sheet-body'),toast=document.getElementById('toast');
const state={view:'dashboard',data:null,filter:'all',session:null};
const labels={dashboard:'Dashboard',rooms:'Sale',computers:'Computer',hardware:'Hardware',licenses:'Licenze',summary:'Sintesi',settings:'Settings'};


function navIcon(name){
  const icons={
    dashboard:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>`,
    chair:`<svg viewBox="0 0 24 24"><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M5 11h14v5H5z"/><path d="M8 16v5M16 16v5M4 11V8M20 11V8"/></svg>`,
    computer:`<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    key:`<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/></svg>`,
    summary:`<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
    settings:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.12-1.3l2-1.55-2-3.46-2.45 1A7 7 0 0 0 14.2 5.4L13.8 3h-4l-.4 2.4a7 7 0 0 0-2.23 1.29l-2.45-1-2 3.46 2 1.55A7 7 0 0 0 4.6 12c0 .44.04.87.12 1.3l-2 1.55 2 3.46 2.45-1a7 7 0 0 0 2.23 1.29l.4 2.4h4l.4-2.4a7 7 0 0 0 2.23-1.29l2.45 1 2-3.46-2-1.55c.08-.43.12-.86.12-1.3z"/></svg>`
  };
  return icons[name]||'';
}
function navHTML(){
  const items=[
    ['dashboard','dashboard','Dashboard'],
    ['rooms','chair','Sale'],
    ['computers','computer','Computer'],
    ['hardware','rec','Hardware'],
    ['licenses','key','Licenze'],
    ['summary','summary','Sintesi'],
    ['settings','settings','Settings']
  ];
  return items.map(([v,i,l])=>`<button class="${state.view===v?'active':''}" data-view="${v}">
    ${i==='rec'?`<span class="rec-nav-icon"><i></i><b>REC</b></span>`:`<span class="nav-svg">${navIcon(i)}</span>`}
    <small>${l}</small>
  </button>`).join('');
}

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

function rooms(){const rooms=[...state.data.rooms].sort((a,b)=>a.position-b.position);return `<div class="grid room-grid">${rooms.map(room=>{const sts=state.data.stations.filter(s=>s.room_id===room.id).sort((a,b)=>a.position-b.position);const levels=sts.flatMap(s=>[s.avid_license_id,...state.data.station_plugins.filter(x=>x.station_id===s.id).map(x=>x.license_id)]).filter(Boolean).map(id=>licenseStatus(state.data.licenses.find(l=>l.id===id)).level);const level=levels.includes('expired')?'expired':levels.includes('warning')?'warning':'';return `<article class="room-card ${level}" data-room="${room.id}"><h3>${esc(room.name)}</h3>${sts.map(stationCard).join('')}</article>`}).join('')}</div>`}
function stationCard(s){const c=state.data.computers.find(x=>x.id===s.computer_id),a=state.data.licenses.find(x=>x.id===s.avid_license_id),plugins=state.data.station_plugins.filter(x=>x.station_id===s.id).map(x=>state.data.licenses.find(l=>l.id===x.license_id)).filter(Boolean);return `<div class="station-row"><div class="resource-row"><div><strong>${c?esc(c.code):'Nessun computer'}</strong>${c?`<small>${esc([c.model,c.variant].filter(Boolean).join(' · '))}</small>`:''}</div>${c?.os_name?`<span class="badge os">${esc(c.os_name.toUpperCase())}</span>`:''}</div><div class="resource-row"><strong>${a?esc(a.code):'Nessuna Avid'}</strong>${a?`<div class="badges">${a.is_trial?'<span class="badge trial">TRIAL</span>':''}<span class="badge ${a.avid_type==='Ultimate'?'ultimate':'singolo'}">${esc(a.avid_type.toUpperCase())}</span></div>`:''}</div>${plugins.map(p=>`<div class="resource-row"><strong>${esc(p.plugin_type.toUpperCase())}</strong><div class="badges">${p.is_trial?'<span class="badge trial">TRIAL</span>':''}<span class="badge ${p.billing_cycle}">${cycleLabel(p.billing_cycle)}</span></div></div>`).join('')}${[a,...plugins].filter(Boolean).map(x=>licenseStatus(x)).filter(x=>x.level!=='ok').map(x=>`<div class="status ${x.level}">${esc(x.text)}</div>`).join('')}</div>`}


function inventory(type){
  const source=state.data[type].filter(x=>!x.archived_at);
  const mapped=source.map(x=>({
    x,
    loc:type==='computers'?stationOf('computer',x.id):type==='hardware'?stationOf('hardware',x.id):x.category==='plugin'?pluginStation(x.id):stationOf('license',x.id)
  })).sort((a,b)=>{
    if(type==='licenses'){
      const aUn=a.loc?0:1,bUn=b.loc?0:1;
      if(aUn!==bUn)return aUn-bUn;
      if(!aUn){
        const aCat=a.x.category==='avid'?0:1,bCat=b.x.category==='avid'?0:1;
        if(aCat!==bCat)return aCat-bCat;
      }
      return numSort(a.x,b.x);
    }
    return (a.loc?0:1)-(b.loc?0:1)||numSort(a.x,b.x);
  });
  const filtered=mapped.filter(({x,loc})=>state.filter==='all'||state.filter==='assigned'&&loc||state.filter==='warehouse'&&!loc||type==='licenses'&&state.filter===x.category);
  return `${filters(type)}<div class="list">${filtered.length?filtered.map(({x})=>inventoryCard(type,x)).join(''):`<div class="empty">Nessun elemento.</div>`}</div>`;
}

function filters(type){const fs=type==='licenses'?[['all','Tutte'],['avid','Avid'],['plugin','Plugin'],['assigned','Assegnate'],['warehouse','Magazzino']]:[['all','Tutti'],['assigned','Assegnati'],['warehouse','Magazzino']];return `<div class="filters">${fs.map(([id,l])=>`<button class="filter ${state.filter===id?'active':''}" data-filter="${id}">${l}</button>`).join('')}</div>`}

function locationMarkup(text){
  return text==='Non assegnato'
    ? '<span class="unassigned-text">Non assegnato</span>'
    : esc(text);
}
function inventoryCard(type,x){
  if(type==='computers'){
    const loc=currentLocation('computer',x.id);
    return `<button class="list-card" data-item="computers:${x.id}"><div><h3>${esc(x.code)} · ${esc(x.model||'')}</h3><div class="badges">${x.os_name?`<span class="badge os">${esc(x.os_name.toUpperCase())}</span>`:''}</div><p>${locationMarkup(loc)} · Formattazione ${fmtDate(x.formatted_at)}</p></div><span>›</span></button>`;
  }
  if(type==='hardware'){
    const loc=currentLocation('hardware',x.id);
    return `<button class="list-card" data-item="hardware:${x.id}"><div><h3>${esc(x.code)} · ${esc(x.model||'')}</h3><p>${locationMarkup(loc)}</p></div><span>›</span></button>`;
  }
  const st=licenseStatus(x);
  const kind=x.category==='avid'?x.avid_type:x.plugin_type;
  const loc=currentLocation(x.category==='plugin'?'plugin':'license',x.id);
  return `<button class="list-card" data-item="licenses:${x.id}"><div><h3>${esc(x.code)} <span class="badge ${x.category==='avid'?(x.avid_type==='Ultimate'?'ultimate':'singolo'):'annual'}">${esc((kind||'').toUpperCase())}</span> ${x.is_trial?'<span class="badge trial">TRIAL</span>':''} <span class="badge ${x.billing_cycle}">${cycleLabel(x.billing_cycle)}</span></h3><p>Scadenza ${fmtDate(x.expiry_date)}</p><span class="status ${st.level}">${esc(st.text)} · ${locationMarkup(loc)}</span></div><span>›</span></button>`;
}


function summary(){
  return `<div class="summary-toolbar"><button type="button" class="secondary print-summary" id="print-summary">Stampa</button></div>
  <div class="summary-wrap">${state.data.rooms.sort((a,b)=>a.position-b.position).map(r=>`<section class="summary-room glass"><h3>${esc(r.name)}</h3>${state.data.stations.filter(s=>s.room_id===r.id).sort((a,b)=>a.position-b.position).map(s=>{const c=state.data.computers.find(x=>x.id===s.computer_id),h=state.data.hardware.find(x=>x.id===s.hardware_id),a=state.data.licenses.find(x=>x.id===s.avid_license_id),ps=state.data.station_plugins.filter(x=>x.station_id===s.id).map(x=>state.data.licenses.find(l=>l.id===x.license_id)).filter(Boolean);return `<div class="summary-row"><div class="summary-cell"><small>COMPUTER</small><strong>${c?esc(c.code):'—'}</strong><span>${c?esc([c.model,c.variant].filter(Boolean).join(' · ')):'Non assegnato'}</span>${c?.os_name?`<span class="badge os">${esc(c.os_name.toUpperCase())}</span>`:''}</div><div class="summary-cell"><small>HARDWARE</small><strong>${h?esc(h.code):'—'}</strong><span>${h?esc(h.model||''):'Non assegnato'}</span></div><div class="summary-cell ${a?.avid_type?.toLowerCase()||''}"><small>AVID</small><strong>${a?esc(a.code):'—'}</strong><span>${a?`${a.is_trial?'TRIAL · ':''}${esc(a.avid_type)}`:'Non assegnata'}</span></div><div class="summary-cell"><small>PLUGIN</small>${ps.length?ps.map(p=>`<strong>${esc(p.plugin_type)}</strong><span>${p.is_trial?'TRIAL · ':''}${cycleLabel(p.billing_cycle)}</span>`).join(''):'<span>Nessun plugin</span>'}</div></div>`}).join('')}</section>`).join('')}</div>`;
}

function settings(){return `<div class="list"><button class="list-card" data-setting="audit"><div><h3>Registro modifiche</h3><p>Storico automatico delle operazioni.</p></div><span>›</span></button><button class="list-card" data-setting="archive"><div><h3>Archivio</h3><p>Elementi archiviati e ripristino.</p></div><span>›</span></button><button class="list-card" data-setting="backup"><div><h3>Backup ed esportazione</h3><p>Disponibile in una versione successiva.</p></div><span>›</span></button><button class="list-card" id="logout"><div><h3>Logout</h3><p>${esc(state.session?.user?.email||'')}</p></div><span>›</span></button></div>`}

function render(){const add=document.getElementById('add-btn');if(add)add.hidden=state.view==='dashboard';if(!state.data)return;app.innerHTML=state.view==='dashboard'?dashboard():state.view==='rooms'?rooms():state.view==='computers'?inventory('computers'):state.view==='hardware'?inventory('hardware'):state.view==='licenses'?inventory('licenses'):state.view==='summary'?summary():settings();bindContent()}
function bindContent(){document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});document.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const [t,id]=b.dataset.item.split(':');openDetail(t,id)});document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>openRoom(b.dataset.room));document.querySelectorAll('[data-open-license]').forEach(b=>b.onclick=()=>openDetail('licenses',b.dataset.openLicense));document.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>openSetting(b.dataset.setting));document.getElementById('logout')?.addEventListener('click',async()=>supabase.auth.signOut());document.getElementById('print-summary')?.addEventListener('click',()=>window.print())}

function openDetail(type,id){const x=state.data[type].find(v=>v.id===id);const rows=type==='computers'?[['ID',x.code],['Modello',x.model],['Anno',x.variant],['Processore',x.cpu],['RAM',x.ram],['GPU',x.gpu],['Seriale',x.serial],['macOS',`${x.os_name||''} ${x.os_version||''}`],['Formattazione',fmtDate(x.formatted_at)],['Assegnazione',currentLocation('computer',x.id)],['Allegati',String(x.attachments_count||0)]]:type==='hardware'?[['ID',x.code],['Modello',x.model],['Seriale',x.serial],['Driver',x.driver_version],['Assegnazione',currentLocation('hardware',x.id)],['Allegati',String(x.attachments_count||0)]]:[['ID',x.code],['Categoria',x.category==='avid'?'Avid':'Plugin'],['Tipo',x.category==='avid'?x.avid_type:x.plugin_type],['System ID',x.system_id],['Codice / Seriale',x.activation_code||x.plugin_serial],['Versione',x.version],['Trial',x.is_trial?'Sì':'No'],['Durata',cycleLabel(x.billing_cycle)],['Scadenza',fmtDate(x.expiry_date)],['Sospensione richiesta',x.deactivation_requested?'Sì':'No'],['Assegnazione',currentLocation(x.category==='plugin'?'plugin':'license',x.id)],['Allegati',String(x.attachments_count||0)]];openModal(`<div class="modal-head"><h2>${esc(x.code)}</h2><button class="close" data-close>×</button></div><div class="fields">${rows.map(([a,b])=>`<div class="resource-row"><span class="subtle">${esc(a)}</span><strong>${esc(b||'—')}</strong></div>`).join('')}</div><div class="actions"><button class="secondary" id="archive-item">Archivia</button><button class="primary" id="edit-item">Modifica</button></div>`);document.getElementById('edit-item').onclick=()=>editItem(type,x);document.getElementById('archive-item').onclick=async()=>{if(confirm(`Archiviare ${x.code}?`)){await archiveRow(type,x.id);await addAudit('archive',type,x.id,{code:x.code});modal.close();await refresh()}}}

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

    <label class="option-check">
      <input id="trial" type="checkbox" ${x.is_trial?'checked':''}>
      <span>TRIAL</span>
    </label>

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

async function confirmEditorAssignment(type,item,newStationId){
  if(!newStationId)return true;
  const kind=type==='computers'?'computer':type==='hardware'?'hardware':item.category==='plugin'?'plugin':'license';
  const old=kind==='plugin'?pluginStation(item.id):stationOf(kind,item.id);
  const target=state.data.stations.find(s=>s.id===newStationId);
  if(old&&old.id!==newStationId){
    if(!confirm(`${item.code||'Questo elemento'} è già assegnato a ${stationLabel(old)}.\n\nVuoi spostarlo a ${stationLabel(target)}?`))return false;
  }
  let occupied=null;
  if(kind==='computer')occupied=state.data.computers.find(x=>x.id===target?.computer_id);
  if(kind==='hardware')occupied=state.data.hardware.find(x=>x.id===target?.hardware_id);
  if(kind==='license')occupied=state.data.licenses.find(x=>x.id===target?.avid_license_id);
  if(occupied&&occupied.id!==item.id){
    return confirm(`${stationLabel(target)} utilizza già ${occupied.code}.\n\nVuoi sostituirlo? ${occupied.code} tornerà Non assegnato.`);
  }
  return true;
}
async function confirmSheetAssignment(kind,id,stationId){
  if(!id)return true;
  const selected=(kind==='computer'?state.data.computers:kind==='hardware'?state.data.hardware:state.data.licenses).find(x=>x.id===id);
  const old=kind==='plugin'?pluginStation(id):stationOf(kind==='license'?'license':kind,id);
  const target=state.data.stations.find(s=>s.id===stationId);
  if(old&&old.id!==stationId){
    if(!confirm(`${selected?.code||'Questo elemento'} è già assegnato a ${stationLabel(old)}.\n\nVuoi spostarlo a ${stationLabel(target)}?`))return false;
  }
  if(kind!=='plugin'){
    const occupiedId=kind==='computer'?target.computer_id:kind==='hardware'?target.hardware_id:target.avid_license_id;
    const occupied=(kind==='computer'?state.data.computers:kind==='hardware'?state.data.hardware:state.data.licenses).find(x=>x.id===occupiedId);
    if(occupied&&occupied.id!==id){
      return confirm(`${stationLabel(target)} utilizza già ${occupied.code}.\n\nVuoi sostituirlo? ${occupied.code} tornerà Non assegnato.`);
    }
  }
  return true;
}

async function saveEditor(type,x,isNew){try{let row={id:x.id};let assignment=val('assignment');if(type==='computers')Object.assign(row,{code:val('code'),model:val('model'),variant:val('variant'),cpu:val('cpu'),ram:val('ram'),gpu:val('gpu'),storage:val('storage'),serial:val('serial'),os_name:val('os'),os_version:val('osv'),formatted_at:val('formatted')||null,notes:val('notes'),attachments_count:x.attachments_count||0});else if(type==='hardware')Object.assign(row,{code:val('code'),category:val('category'),model:val('model'),serial:val('serial'),driver_version:val('driver'),notes:val('notes'),attachments_count:x.attachments_count||0});else Object.assign(row,{code:val('code'),category:val('category'),avid_type:val('category')==='avid'?val('avid-type'):null,plugin_type:val('category')==='plugin'?val('plugin-type'):null,system_id:val('system')||null,activation_code:val('activation-code')||null,plugin_serial:val('plugin-serial')||null,version:val('version')||null,billing_cycle:val('cycle'),is_trial:checked('trial'),activation_date:val('activation')||null,expiry_date:val('expiry')||null,deactivation_requested:checked('deactivation'),notes:val('notes'),attachments_count:x.attachments_count||0});if(!(await confirmEditorAssignment(type,{...x,...row},assignment)))return;const saved=await saveRow(type,row);if(type==='computers')await assignResource('computer',saved.id,assignment||null);if(type==='hardware')await assignResource('hardware',saved.id,assignment||null);if(type==='licenses'){if(saved.category==='plugin')await assignPlugin(saved.id,assignment||null);else await assignResource('license',saved.id,assignment||null)}await addAudit(isNew?'create':'update',type,saved.id,{code:saved.code});modal.close();showToast('Salvato');await refresh()}catch(e){alert(e.message)}}

function openRoom(id){const room=state.data.rooms.find(r=>r.id===id),sts=state.data.stations.filter(s=>s.room_id===id).sort((a,b)=>a.position-b.position);openModal(`<div class="modal-head"><h2>${esc(room.name)}</h2><button class="close" data-close>×</button></div><div class="fields">${sts.map((s,i)=>`<section class="card"><div class="resource-row"><strong>${sts.length>1?`Postazione ${i+1}`:'Configurazione sala'}</strong>${i>0?`<button class="danger" data-delete-station="${s.id}">Elimina</button>`:''}</div>${assignmentButton('computer',s)}${assignmentButton('hardware',s)}${assignmentButton('license',s)}${pluginButton(s)}</section>`).join('')}</div><div class="actions"><button class="secondary" id="add-station">＋ Aggiungi postazione</button><button class="primary" data-close>Chiudi</button></div>`);document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>assignmentSheet(b.dataset.assign,b.dataset.station));document.getElementById('add-station').onclick=async()=>{await saveRow('stations',{id:uuid(),room_id:room.id,position:sts.length+1});await addAudit('create','stations',room.id,{room:room.name});modal.close();await refresh();openRoom(id)};document.querySelectorAll('[data-delete-station]').forEach(b=>b.onclick=async()=>{if(confirm('Eliminare questa postazione? Gli elementi assegnati torneranno in Magazzino.')){await removeRow('stations',b.dataset.deleteStation);modal.close();await refresh();openRoom(id)}})}
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

  openSheet(`<div class="modal-head"><h2>Seleziona ${kind==='computer'?'Computer':kind==='hardware'?'Hardware':kind==='plugin'?'Plugin':'Avid'}</h2><button class="close" data-close-sheet>×</button></div>${kind!=='plugin'?`<button class="choice" data-choice="">Non assegnato</button>`:''}${items.sort(numSort).map(x=>{const used=kind==='plugin'?pluginStation(x.id):stationOf(kind==='license'?'license':kind,x.id);return `<button class="choice ${used&&used.id!==stationId?'used':'free'} ${current.includes(x.id)?'selected':''}" data-choice="${x.id}"><strong>${esc(x.code)} · ${esc(x.model||x.avid_type||x.plugin_type||'')}</strong><br><small>${used?esc(stationLabel(used)):'Disponibile'}</small></button>`}).join('')}`);

  sheetBody.querySelectorAll('[data-choice]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.choice||null;
    try{
      if(kind==='plugin'){
        const selected=current.includes(id);
        if(!selected&&!(await confirmSheetAssignment(kind,id,stationId)))return;
        await assignPlugin(id,selected?null:stationId);
      }else{
        if(id&&!(await confirmSheetAssignment(kind,id,stationId)))return;
        await assignResource(kind,id,stationId);
      }
      sheet.close();
      modal.close();
      await refresh();
      openRoom(station.room_id);
    }catch(e){alert(e.message)}
  });
}

function openSetting(k){if(k==='audit')openModal(`<div class="modal-head"><h2>Registro modifiche</h2><button class="close" data-close>×</button></div><div class="list">${state.data.audit_log.length?state.data.audit_log.slice(0,100).map(x=>`<div class="card"><strong>${esc(x.action)} · ${esc(x.entity_type)}</strong><p>${new Date(x.created_at).toLocaleString('it-IT')}</p></div>`).join(''):'<div class="empty">Registro vuoto.</div>'}</div>`);else if(k==='archive'){const all=[...state.data.computers.map(x=>({...x,_table:'computers'})),...state.data.hardware.map(x=>({...x,_table:'hardware'})),...state.data.licenses.map(x=>({...x,_table:'licenses'}))].filter(x=>x.archived_at);openModal(`<div class="modal-head"><h2>Archivio</h2><button class="close" data-close>×</button></div>${all.length?all.map(x=>`<div class="list-card"><div><h3>${esc(x.code)}</h3><p>${esc(x._table)}</p></div></div>`).join(''):'<div class="empty">Nessun elemento archiviato.</div>'}`)}else showToast('Funzione prevista in una versione successiva')}


function addAction(){
  if(state.view==='computers')editItem('computers');
  else if(state.view==='hardware')editItem('hardware');
  else if(state.view==='licenses')editItem('licenses',{_new:true,id:uuid(),category:'avid'});
  else if(state.view==='rooms')openSheet(`<div class="modal-head"><h2>Aggiungi</h2><button class="close" data-close-sheet>×</button></div><button class="choice" id="a-comp">Nuovo computer</button><button class="choice" id="a-hw">Nuovo hardware</button><button class="choice" id="a-license">Nuova licenza</button>`),setTimeout(()=>{document.getElementById('a-comp').onclick=()=>{sheet.close();editItem('computers')};document.getElementById('a-hw').onclick=()=>{sheet.close();editItem('hardware')};document.getElementById('a-license').onclick=()=>{sheet.close();editItem('licenses',{_new:true,id:uuid(),category:'avid'})}},0);
}

import { supabase } from './supabase.js';
import { loadAll, saveRow, removeRow, archiveRow, assignResource, assignPlugin, addAudit } from './api.js';
import { esc, fmtDate, numSort, licenseStatus, cycleLabel, todayISO } from './utils.js';

const APP_NAME='DVS Workspace';
const APP_VERSION='11.0';
const APP_RELEASE='Workspace v11.0 · 07/2026';
const DATABASE_SCHEMA='4.3.1';

const VAPID_PUBLIC_KEY='BLidTsO_r-SgpMHvPD0KC3jv39ZHLcdOfoTAR0IHDemM1dTQrLUM7WoUCA8FwfxXlCmA_KV4rnEXdBqlCXixNJc';

const splash=document.getElementById('splash'),login=document.getElementById('login'),shell=document.getElementById('shell'),app=document.getElementById('app'),title=document.getElementById('title'),greeting=document.getElementById('greeting'),modal=document.getElementById('modal'),modalBody=document.getElementById('modal-body'),sheet=document.getElementById('sheet'),sheetBody=document.getElementById('sheet-body'),toast=document.getElementById('toast');
const views=[['dashboard','dashboard','Dashboard'],['rooms','chair','Sale'],['computers','computer','Computer'],['hardware','rec','Hardware'],['licenses','key','Licenze'],['settings','settings','Settings']];
const state={view:'dashboard',data:null,filter:'all',session:null};
const labels={dashboard:'Dashboard',rooms:'Sale',computers:'Computer',hardware:'Hardware',licenses:'Licenze',settings:'Settings'};

function navIcon(name){
  const icons={
    dashboard:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>`,
    chair:`<svg viewBox="0 0 24 24"><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M5 11h14v5H5z"/><path d="M8 16v5M16 16v5M4 11V8M20 11V8"/></svg>`,
    computer:`<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    key:`<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/></svg>`,
    summary:`<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
    settings:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.12-1.3l2-1.55-2-3.46-2.45 1A7 7 0 0 0 14.2 5.4L13.8 3h-4l-.4 2.4a7 7 0 0 0-2.23 1.29l-2.45-1-2 3.46 2 1.55A7 7 0 0 0 4.6 12c0 .44.04.87.12 1.3l-2 1.55 2 3.46 2.45-1a7 7 0 0 0 2.23 1.29l.4 2.4h4l.4-2.4a7 7 0 0 0 2.23-1.29l2.45 1 2-3.46-2-1.55c.08-.43.12-.86.12-1.3z"/></svg>`,
    bell:`<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>`,
    audit:`<svg viewBox="0 0 24 24"><path d="M9 5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M3 3v14a2 2 0 0 0 2 2M11 10h6M11 14h6"/></svg>`,
    logout:`<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>`
  };return icons[name]||''
}
function navHTML(){return views.map(([id,icon,label])=>`<button class="nav-btn ${state.view===id?'active':''}" data-view="${id}">${icon==='rec'?`<span class="rec-nav-icon"><i></i></span>`:`<span class="nav-svg">${navIcon(icon)}</span>`}<small>${label}</small></button>`).join('')}
function bindNav(){document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view))}
function setView(v){state.view=v;state.filter='all';title.textContent=labels[v];document.getElementById('desktop-nav').innerHTML=navHTML();document.getElementById('mobile-nav').innerHTML=navHTML();bindNav();render()}
function showToast(t){toast.textContent=t;toast.classList.remove('hidden');setTimeout(()=>toast.classList.add('hidden'),2200)}
function openModal(html){modalBody.innerHTML=html;modal.showModal();modalBody.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal.close())}
function openSheet(html){sheetBody.innerHTML=html;sheet.showModal();sheetBody.querySelectorAll('[data-close-sheet]').forEach(b=>b.onclick=()=>sheet.close())}
function uuid(){return crypto.randomUUID()}
function labelRoomNumber(room){
  const match=String(room?.name||'').match(/\d+/);
  const number=match?Number(match[0]):Number(room?.position||0);
  return String(Number.isFinite(number)?number:0).padStart(2,'0');
}

let labelTemplateImagesPromise=null;
function labelTemplateImages(){
  if(labelTemplateImagesPromise)return labelTemplateImagesPromise;
  const load=src=>new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=reject;
    image.src=src;
  });
  labelTemplateImagesPromise=Promise.all([
    load('./assets/etichetta-sala-background.png'),
    load('./assets/etichetta-sala-logo.png')
  ]);
  return labelTemplateImagesPromise;
}

function labelRoundedRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function labelFitText(ctx,text,maxWidth,startSize,minSize){
  let size=startSize;
  do{
    ctx.font=`700 ${size}px Futura, "Arial Black", Arial, sans-serif`;
    if(ctx.measureText(text).width<=maxWidth)return size;
    size-=2;
  }while(size>minSize);
  return minSize;
}

async function renderRoomLabelCanvas(room,values){
  const [background,logo]=await labelTemplateImages();
  const canvas=document.createElement('canvas');
  canvas.width=1600;
  canvas.height=1131;
  const ctx=canvas.getContext('2d');
  const sx=background.width*.10072;
  const sw=background.width-sx*2;

  ctx.drawImage(background,sx,0,sw,background.height,0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(9,11,13,.46667)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(logo,79,62,436,132);

  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillStyle='#fff';
  const roomText=`SALA ${labelRoomNumber(room)}`;
  labelFitText(ctx,roomText,580,100,66);
  ctx.fillText(roomText,1228,126);

  const rows=[
    {label:'PROGETTO',value:values.project,y:272,labelY:382,valueY:444,start:64},
    {label:'REGIA',value:values.direction,y:540,labelY:650,valueY:712,start:60},
    {label:'PRODUZIONE',value:values.production,y:807,labelY:917,valueY:979,start:67}
  ];

  rows.forEach(row=>{
    labelRoundedRect(ctx,205,row.y,1190,198,19);
    ctx.fillStyle='rgba(18,21,24,.86667)';
    ctx.fill();
    ctx.lineWidth=2;
    ctx.strokeStyle='#a90016';
    ctx.stroke();
    ctx.fillStyle='#b00018';
    ctx.fillRect(205,row.y+24,7,149);

    ctx.fillStyle='#ff2848';
    ctx.font='700 32px Futura, "Arial Black", Arial, sans-serif';
    ctx.fillText(row.label,800,row.labelY);

    const text=String(row.value||'').trim().toUpperCase();
    if(text){
      ctx.fillStyle='#fff';
      labelFitText(ctx,text,1050,row.start,32);
      ctx.fillText(text,800,row.valueY);
    }
  });

  return canvas;
}

async function createRoomLabelPdf(room,values){
  if(!window.PDFLib)throw new Error('Motore PDF non disponibile');
  const canvas=await renderRoomLabelCanvas(room,values);
  const pdf=await PDFLib.PDFDocument.create();
  const page=pdf.addPage([841.8898,595.2756]);
  const image=await pdf.embedPng(canvas.toDataURL('image/png'));
  page.drawImage(image,{x:0,y:0,width:841.8898,height:595.2756});
  return pdf.save({useObjectStreams:true});
}

async function saveRoomLabelPdf(room,values){
  const bytes=await createRoomLabelPdf(room,values);
  const filename=`Sala ${labelRoomNumber(room)}.pdf`;
  const blob=new Blob([bytes],{type:'application/pdf'});
  if('showSaveFilePicker' in window){
    const handle=await window.showSaveFilePicker({
      suggestedName:filename,
      types:[{description:'Documento PDF',accept:{'application/pdf':['.pdf']}}]
    });
    const writable=await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),2000);
}

function openRoomLabel(room){
  const values={project:'',direction:'',production:''};
  let previewUrl='';
  let previewGeneration=0;
  let previewTimer=null;

  openModal(`<div class="modal-head"><div><h2>🏷️ Etichetta · ${esc(room.name)}</h2><p class="label-modal-subtitle">A4 orizzontale · stampa A5</p></div><button class="close" data-close>×</button></div>
    <div class="room-label-layout">
      <div class="room-label-form">
        <div class="fields">
          ${field('label-project','Progetto','')}
          ${field('label-direction','Regia','')}
          ${field('label-production','Produzione','')}
        </div>
        <p class="room-label-help">Tutti i campi sono facoltativi. Il numero della sala viene inserito automaticamente.</p>
        <div class="actions room-label-actions">
          <button class="secondary" data-close>Annulla</button>
          <button class="primary" id="export-room-label">Esporta PDF</button>
        </div>
      </div>
      <div class="room-label-preview-wrap">
        <span>Anteprima PDF</span>
        <iframe id="room-label-preview" class="room-label-preview" title="Anteprima Etichetta Sala"></iframe>
        <div id="room-label-preview-status" class="room-label-preview-status">Preparazione anteprima…</div>
      </div>
    </div>`);

  const preview=document.getElementById('room-label-preview');
  const status=document.getElementById('room-label-preview-status');
  const readValues=()=>{
    values.project=val('label-project');
    values.direction=val('label-direction');
    values.production=val('label-production');
  };
  const updatePreview=async()=>{
    const generation=++previewGeneration;
    readValues();
    status.textContent='Aggiornamento anteprima…';
    status.classList.remove('hidden');
    try{
      const bytes=await createRoomLabelPdf(room,{...values});
      if(generation!==previewGeneration)return;
      if(previewUrl)URL.revokeObjectURL(previewUrl);
      previewUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      preview.src=previewUrl;
      status.classList.add('hidden');
    }catch(error){
      status.textContent='Anteprima non disponibile';
      console.error(error);
    }
  };
  ['label-project','label-direction','label-production'].forEach(id=>{
    document.getElementById(id).addEventListener('input',()=>{
      clearTimeout(previewTimer);
      previewTimer=setTimeout(updatePreview,120);
    });
  });
  document.getElementById('export-room-label').onclick=async event=>{
    const button=event.currentTarget;
    readValues();
    button.disabled=true;
    button.textContent='Generazione…';
    try{
      await saveRoomLabelPdf(room,{...values});
      showToast(`PDF pronto · Sala ${labelRoomNumber(room)}`);
    }catch(error){
      if(error?.name!=='AbortError'){
        console.error(error);
        showToast('Impossibile esportare il PDF');
      }
    }finally{
      button.disabled=false;
      button.textContent='Esporta PDF';
    }
  };
  modal.addEventListener('close',()=>{
    clearTimeout(previewTimer);
    if(previewUrl)URL.revokeObjectURL(previewUrl);
  },{once:true});
  updatePreview();
}

function stationLabel(station){const room=state.data.rooms.find(r=>r.id===station.room_id);const count=state.data.stations.filter(s=>s.room_id===station.room_id).length;const idx=state.data.stations.filter(s=>s.room_id===station.room_id).sort((a,b)=>a.position-b.position).findIndex(s=>s.id===station.id);return `${room?.name||'Sala'}${count>1?` · ${idx+1}`:''}`}
function stationOf(kind,id){return state.data.stations.find(s=>kind==='computer'?s.computer_id===id:kind==='hardware'?s.hardware_id===id:s.avid_license_id===id)}
function pluginStation(id){const rel=state.data.station_plugins.find(x=>x.license_id===id);return rel?state.data.stations.find(s=>s.id===rel.station_id):null}
function currentLocation(kind,id){const s=kind==='plugin'?pluginStation(id):stationOf(kind,id);return s?stationLabel(s):'Non assegnato'}
async function refresh(){state.data=await loadAll();render()}


const REALTIME_TABLES=[
  'rooms',
  'stations',
  'computers',
  'hardware',
  'licenses',
  'station_plugins',
  'reminders',
  'audit_log'
];

let realtimeChannel=null;
let realtimeTimer=null;
let realtimeLoading=false;
let realtimePending=false;
let realtimeGeneration=0;

function realtimeUiIsEditing(){
  return modal?.open||sheet?.open;
}

async function applyRealtimeChanges(){
  if(!state.session)return;

  if(realtimeLoading){
    realtimePending=true;
    return;
  }

  realtimeLoading=true;
  const generation=++realtimeGeneration;

  try{
    const data=await loadAll();
    if(generation!==realtimeGeneration)return;

    state.data=data;

    // render() aggiorna soltanto il contenuto dell'app.
    // I dialog aperti vivono fuori da #app e rimangono quindi intatti.
    render();
  }catch(error){
    console.warn('DVS Realtime: aggiornamento non riuscito',error);
  }finally{
    realtimeLoading=false;

    if(realtimePending){
      realtimePending=false;
      scheduleRealtimeRefresh();
    }
  }
}

function scheduleRealtimeRefresh(){
  if(!state.session)return;

  clearTimeout(realtimeTimer);
  realtimeTimer=setTimeout(()=>{
    realtimeTimer=null;
    applyRealtimeChanges();
  },1000);
}

function stopRealtime(){
  clearTimeout(realtimeTimer);
  realtimeTimer=null;
  realtimePending=false;
  realtimeGeneration++;

  if(realtimeChannel){
    supabase.removeChannel(realtimeChannel);
    realtimeChannel=null;
  }
}

function startRealtime(){
  stopRealtime();
  if(!state.session)return;

  let channel=supabase.channel(`dvs-live-${state.session.user.id}`,{
    config:{
      broadcast:{self:false},
      presence:{key:state.session.user.id}
    }
  });

  REALTIME_TABLES.forEach(table=>{
    channel=channel.on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table
      },
      scheduleRealtimeRefresh
    );
  });

  realtimeChannel=channel.subscribe(status=>{
    if(status==='SUBSCRIBED'){
      // Allinea il dispositivo anche dopo una riconnessione.
      scheduleRealtimeRefresh();
    }

    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
      console.warn(`DVS Realtime: ${status}`);
    }
  });
}



function dashboardNavigate(view,filter='all'){
  state.view=view;
  state.filter=filter;
  title.textContent=labels[view];
  document.getElementById('desktop-nav').innerHTML=navHTML();
  document.getElementById('mobile-nav').innerHTML=navHTML();
  bindNav();
  render();
}

function reminderSort(a,b){
  if(!!a.completed!==!!b.completed)return a.completed?1:-1;
  return new Date(a.created_at)-new Date(b.created_at);
}

async function saveReminder(reminder,text,completed=reminder.completed||false){
  const clean=String(text||'').trim();
  if(!clean){
    if(reminder.id)await removeRow('reminders',reminder.id);
    return;
  }
  await saveRow('reminders',{
    id:reminder.id||uuid(),
    text:clean,
    completed:!!completed,
    created_at:reminder.created_at||new Date().toISOString(),
    updated_at:new Date().toISOString()
  });
}

function dashboardAttentionItems(){
  const items=[];

  state.data.licenses
    .filter(license=>!license.archived_at)
    .forEach(license=>{
      const status=licenseStatus(license);
      if(status.level==='ok')return;

      const station=license.category==='plugin'
        ?pluginStation(license.id)
        :stationOf('license',license.id);

      items.push({
        level:status.level,
        title:license.code,
        text:`${station?stationLabel(station):'Non assegnata'} · ${status.text}`,
        action:`license:${license.id}`
      });
    });

  state.data.stations.forEach(station=>{
    const trial=trialInfo(station);
    if(trial.status!=='active')return;

    const room=state.data.rooms.find(r=>r.id===station.room_id);
    items.push({
      level:trial.level==='ok'?'trial':trial.level,
      title:room?.name||'Sala',
      text:trial.text||'Trial attiva',
      action:`room:${station.room_id}`
    });
  });

  const rank={expired:0,warning:1,trial:2};
  return items.sort((a,b)=>(rank[a.level]??9)-(rank[b.level]??9));
}

function reminderRow(reminder){
  return `<div class="reminder-swipe" data-reminder-row="${reminder.id}">
    <button type="button" class="reminder-delete" data-reminder-delete="${reminder.id}">Elimina</button>
    <div class="reminder-content ${reminder.completed?'completed':''}">
      <button type="button" class="reminder-check" data-reminder-check="${reminder.id}" aria-label="${reminder.completed?'Segna come da fare':'Completa promemoria'}">
        <span>${reminder.completed?'✓':''}</span>
      </button>
      <input class="reminder-input" data-reminder-input="${reminder.id}" value="${esc(reminder.text)}" autocomplete="off">
    </div>
  </div>`;
}

function newReminderDraft(){
  if(document.querySelector('[data-reminder-draft]'))return;
  const list=document.getElementById('reminders-list');
  if(!list)return;

  const row=document.createElement('div');
  row.className='reminder-swipe reminder-draft-row';
  row.dataset.reminderDraft='1';
  row.innerHTML=`<div class="reminder-content">
    <button type="button" class="reminder-check" tabindex="-1"><span></span></button>
    <input class="reminder-input" data-reminder-draft-input autocomplete="off" placeholder="">
  </div>`;
  list.appendChild(row);

  const input=row.querySelector('input');
  let saving=false;
  let finished=false;

  const commit=async()=>{
    if(saving||finished)return;
    saving=true;
    const text=input.value.trim();

    if(!text){
      finished=true;
      row.remove();
      return;
    }

    input.disabled=true;
    try{
      await saveReminder({},text,false);
      finished=true;
      await refresh();
    }catch(error){
      saving=false;
      input.disabled=false;
      input.focus();
      alert(error.message);
    }
  };

  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      input.blur();
    }else if(event.key==='Escape'){
      finished=true;
      row.remove();
    }
  });

  input.addEventListener('blur',commit,{once:true});
  input.focus();
}


function dashboardActionTarget(action){
  const [kind,id]=String(action||'').split(':');
  if(kind==='license'&&id){
    const license=state.data.licenses.find(x=>x.id===id);
    const station=license?.category==='plugin'?pluginStation(id):stationOf('license',id);
    return {kind,id,license,station};
  }
  if(kind==='room'&&id){
    return {kind,id,room:state.data.rooms.find(x=>x.id===id)};
  }
  return {kind,id};
}

function navigateDashboardAction(action){
  const target=dashboardActionTarget(action);

  if(target.kind==='room'&&target.id){
    state.view='rooms';
    state.filter='all';
    title.textContent=labels.rooms;
    render();
    setTimeout(()=>{
      const room=document.querySelector(`[data-summary-room="${target.id}"]`);
      room?.scrollIntoView({behavior:'smooth',block:'center'});
      room?.closest('.summary-production-card')?.classList.add('dashboard-focus');
      setTimeout(()=>room?.closest('.summary-production-card')?.classList.remove('dashboard-focus'),1800);
    },80);
    return;
  }

  if(target.kind==='license'&&target.license){
    state.view='rooms';
    state.filter='all';
    title.textContent=labels.rooms;
    render();
    setTimeout(()=>{
      if(target.station){
        const room=document.querySelector(`[data-summary-room="${target.station.room_id}"]`);
        room?.scrollIntoView({behavior:'smooth',block:'center'});
        room?.closest('.summary-production-card')?.classList.add('dashboard-focus');
        setTimeout(()=>room?.closest('.summary-production-card')?.classList.remove('dashboard-focus'),1800);
      }else{
        const card=document.querySelector(`[data-free-item="licenses:${target.id}"],[data-item="licenses:${target.id}"]`);
        card?.scrollIntoView({behavior:'smooth',block:'center'});
        card?.classList.add('dashboard-focus');
        setTimeout(()=>card?.classList.remove('dashboard-focus'),1800);
      }
    },80);
  }
}

function openDashboardActionDetail(action){
  const target=dashboardActionTarget(action);
  if(target.kind==='license'&&target.id)openDetail('licenses',target.id);
  else if(target.kind==='room'&&target.id)openSummaryRoomActions(target.id);
}

function bindDashboardAttentionInteractions(){
  document.querySelectorAll('[data-dashboard-action]').forEach(button=>{
    const action=button.dataset.dashboardAction;
    let longTimer=null;
    let singleTimer=null;
    let longPressed=false;
    let startX=0,startY=0;

    button.addEventListener('contextmenu',event=>event.preventDefault());

    button.addEventListener('dblclick',event=>{
      event.preventDefault();
      event.stopPropagation();
      if(singleTimer){
        clearTimeout(singleTimer);
        singleTimer=null;
      }
      openDashboardActionDetail(action);
    });

    button.addEventListener('click',event=>{
      if(event.pointerType==='touch')return;
      if(event.detail>1)return;

      event.preventDefault();
      if(singleTimer)clearTimeout(singleTimer);
      singleTimer=setTimeout(()=>{
        singleTimer=null;
        navigateDashboardAction(action);
      },280);
    });

    button.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse')return;
      longPressed=false;
      startX=event.clientX;
      startY=event.clientY;

      longTimer=setTimeout(()=>{
        longPressed=true;
        openDashboardActionDetail(action);
      },560);
    });

    button.addEventListener('pointermove',event=>{
      if(!longTimer)return;
      if(Math.hypot(event.clientX-startX,event.clientY-startY)>10){
        clearTimeout(longTimer);
        longTimer=null;
      }
    });

    const cancelLong=()=>{
      if(longTimer){
        clearTimeout(longTimer);
        longTimer=null;
      }
    };

    button.addEventListener('pointerup',event=>{
      const wasLong=longPressed;
      cancelLong();

      if(event.pointerType!=='mouse'&&!wasLong){
        event.preventDefault();
        navigateDashboardAction(action);
      }
    });

    button.addEventListener('pointercancel',cancelLong);
  });
}

function bindReminderInteractions(){
  const box=document.getElementById('reminders-box');

  box?.addEventListener('click',event=>{
    if(event.target.closest('[data-reminder-delete],input,button'))return;
    newReminderDraft();
  });

  document.querySelectorAll('[data-reminder-input]').forEach(input=>{
    const reminder=state.data.reminders.find(x=>x.id===input.dataset.reminderInput);
    const original=reminder?.text||'';
    let saving=false;

    const commit=async()=>{
      if(saving)return;
      const next=input.value.trim();
      if(next===original)return;
      saving=true;
      try{
        await saveReminder(reminder,next,reminder.completed);
        await refresh();
      }catch(error){
        saving=false;
        input.value=original;
        alert(error.message);
      }
    };

    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        input.blur();
      }else if(event.key==='Escape'){
        input.value=original;
        input.blur();
      }
    });
    input.addEventListener('blur',commit,{once:true});
  });

  document.querySelectorAll('[data-reminder-check]').forEach(button=>{
    button.onclick=async event=>{
      event.stopPropagation();
      const reminder=state.data.reminders.find(x=>x.id===button.dataset.reminderCheck);
      try{
        await saveReminder(reminder,reminder.text,!reminder.completed);
        await refresh();
      }catch(error){alert(error.message)}
    };
  });

  document.querySelectorAll('[data-reminder-delete]').forEach(button=>{
    button.onclick=async event=>{
      event.stopPropagation();
      try{
        await removeRow('reminders',button.dataset.reminderDelete);
        await refresh();
      }catch(error){alert(error.message)}
    };
  });
}

function dashboard(){
  const d=state.data;
  const rooms=[...d.rooms].sort((a,b)=>a.position-b.position);
  const computers=d.computers.filter(x=>!x.archived_at);
  const licenses=d.licenses.filter(x=>!x.archived_at);
  const avid=licenses.filter(x=>x.category==='avid');
  const plugins=licenses.filter(x=>x.category==='plugin');

  const computersAssigned=computers.filter(x=>stationOf('computer',x.id)).length;
  const avidAssigned=avid.filter(x=>stationOf('license',x.id)).length;
  const pluginsAssigned=plugins.filter(x=>pluginStation(x.id)).length;

  const attention=dashboardAttentionItems();
  const reminders=[...(d.reminders||[])].sort(reminderSort);
  const last=lastBackupInfo();
  const backupAge=last?Math.floor((Date.now()-new Date(last.date).getTime())/86400000):null;
  const backupLevel=last&&backupAge<=7?'ok':'warning';

  return `<div class="dashboard-v7">
    <section class="dashboard-metrics">
      <button class="dashboard-metric glass" data-dashboard-nav="rooms" data-dashboard-filter="all">
        <span>Sale</span>
        <strong>${rooms.length}</strong>
        <em>${computersAssigned} Computer nelle Sale</em>
      </button>

      <button class="dashboard-metric glass" data-dashboard-nav="computers" data-dashboard-filter="warehouse">
        <span>Computer</span>
        <strong>${computers.length}</strong>
        <em>${computersAssigned} nelle Sale · ${computers.length-computersAssigned} liberi</em>
      </button>

      <button class="dashboard-metric glass" data-dashboard-nav="licenses" data-dashboard-filter="avid">
        <span>Licenze Avid</span>
        <strong>${avid.length}</strong>
        <em>${avidAssigned} nelle Sale · ${avid.length-avidAssigned} libere</em>
      </button>

      <button class="dashboard-metric glass" data-dashboard-nav="licenses" data-dashboard-filter="plugin">
        <span>Plugin</span>
        <strong>${plugins.length}</strong>
        <em>${pluginsAssigned} nelle Sale · ${plugins.length-pluginsAssigned} in magazzino</em>
      </button>
    </section>

    <section class="dashboard-panel dashboard-attention glass">
      <div class="dashboard-panel-head">
        <div><small>CONTROLLO AUTOMATICO</small><h2>Attenzione richiesta</h2></div>
        <span class="dashboard-count">${attention.length}</span>
      </div>
      ${attention.length?`<div class="dashboard-attention-list">
        ${attention.map(item=>`<button type="button" class="dashboard-alert ${item.level} ${item.level==='warning'||item.level==='expired'?'pulse-critical':''}" data-dashboard-action="${item.action}">
          <span class="dashboard-alert-dot"></span>
          <div><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small></div>
          <b>›</b>
        </button>`).join('')}
      </div>`:'<div class="dashboard-empty-good"><strong>Tutto sotto controllo</strong><span>Nessuna scadenza o Trial attiva richiede attenzione.</span></div>'}
    </section>

    <section class="dashboard-lower-grid">
      <div class="dashboard-panel reminders-panel glass" id="reminders-box">
        <div class="dashboard-panel-head">
          <div><small>PERSONALI</small><h2>Promemoria</h2></div>
          <span class="dashboard-count">${reminders.filter(x=>!x.completed).length}</span>
        </div>
        <div class="reminders-list" id="reminders-list">
          ${reminders.map(reminderRow).join('')}
        </div>
        <div class="reminder-empty-line">Tocca uno spazio libero per scrivere</div>
      </div>

      <div class="dashboard-panel backup-dashboard glass">
        <div class="dashboard-panel-head">
          <div><small>SICUREZZA DATI</small><h2>Ultimo backup</h2></div>
          <span class="backup-state ${backupLevel}"></span>
        </div>
        <div class="backup-dashboard-main">
          <strong>${last?esc(last.fileName):'Mai eseguito'}</strong>
          <span>${last?new Date(last.date).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'Non è ancora stato esportato alcun backup.'}</span>
          ${last&&backupAge>7?`<em>Backup non eseguito da ${backupAge} giorni</em>`:''}
        </div>
        <button type="button" class="secondary" id="dashboard-backup">Apri Backup</button>
      </div>
    </section>
  </div>`;
}
function metric(name,n,sub){return `<div class="metric glass"><span>${name}</span><strong>${n}</strong><small class="subtle">${sub}</small></div>`}


const officeGroups=[
  {title:'Ufficio 1 • Chinotto',start:1,end:5},
  {title:'Ufficio 2 • Chinotto',start:6,end:10},
  {title:'Ufficio 3 • Carso',start:11,end:15}
];
function roomsForOffice(rooms,group){
  return rooms.filter(room=>room.position>=group.start&&room.position<=group.end);
}


function stationCard(s){const c=state.data.computers.find(x=>x.id===s.computer_id),a=state.data.licenses.find(x=>x.id===s.avid_license_id),plugins=state.data.station_plugins.filter(x=>x.station_id===s.id).map(x=>state.data.licenses.find(l=>l.id===x.license_id)).filter(Boolean);return `<div class="station-row"><div class="resource-row"><div><strong>${c?esc(c.code):'Nessun computer'}</strong>${c?`<small>${esc([c.model,c.variant].filter(Boolean).join(' · '))}</small>`:''}</div>${c?.os_name?`<span class="badge os os-${esc(c.os_name.toLowerCase())}">${esc(c.os_name.toUpperCase())}</span>`:''}</div><div class="resource-row"><strong>${a?esc(a.code):'Nessuna Avid'}</strong>${a?`<div class="badges"><span class="badge ${a.avid_type==='Ultimate'?'ultimate':'singolo'}">${esc(a.avid_type.toUpperCase())}</span><span class="badge ${a.billing_cycle}">${cycleLabel(a.billing_cycle)}</span>${a.is_trial?'<span class="badge trial">TRIAL</span>':''}</div>`:''}</div>${plugins.map(p=>`<div class="resource-row"><strong>${esc(p.plugin_type.toUpperCase())}</strong><div class="badges"><span class="badge ${p.billing_cycle}">${cycleLabel(p.billing_cycle)}</span>${p.is_trial?'<span class="badge trial">TRIAL</span>':''}</div></div>`).join('')}${[a,...plugins].filter(Boolean).map(x=>licenseStatus(x)).filter(x=>x.level!=='ok').map(x=>`<div class="status ${x.level}">${esc(x.text)}</div>`).join('')}</div>`}


function parseAssetNumber(code){
  const match=String(code||'').match(/(\d+)\s*$/);
  return match?Number(match[1]):null;
}
function formatAssetCode(prefix,number){
  return `${prefix} ${String(number).padStart(2,'0')}`;
}
function nextFreeNumber(type,{start=1,end=999,skip=[]}={}){
  const used=new Set(
    state.data[type]
      .filter(item=>!item.archived_at)
      .map(item=>parseAssetNumber(item.code))
      .filter(Number.isInteger)
  );
  for(let n=start;n<=end;n++){
    if(skip.includes(n))continue;
    if(!used.has(n))return n;
  }
  return null;
}
function nextComputerCode(){
  const n=nextFreeNumber('computers',{skip:[17]});
  return n?formatAssetCode('MAC',n):'';
}
function nextHardwareCode(){
  const n=nextFreeNumber('hardware');
  return n?formatAssetCode('HW',n):'';
}
function nextAvidCode(avidType='Ultimate'){
  const ultimate=avidType==='Ultimate';
  const n=nextFreeNumber('licenses',{start:ultimate?1:20,end:ultimate?19:39});
  return n?formatAssetCode('AVID',n):'';
}
function validateAssetCode(type,code,currentId=null,licenseData={}){
  const normalized=String(code||'').trim().toUpperCase();
  if(!normalized)throw new Error('Il codice è obbligatorio.');
  if(type==='computers'&&parseAssetNumber(normalized)===17){
    throw new Error('Il codice MAC 17 non può essere utilizzato.');
  }
  if(type==='licenses'&&licenseData.category==='avid'){
    const number=parseAssetNumber(normalized);
    const ultimate=licenseData.avid_type==='Ultimate';
    if(!Number.isInteger(number))throw new Error('Il codice Avid deve terminare con un numero.');
    if(ultimate&&(number<1||number>19))throw new Error('Le Avid Ultimate devono usare numeri da 01 a 19.');
    if(!ultimate&&(number<20||number>39))throw new Error('Le Avid Singolo devono usare numeri da 20 a 39.');
  }
  const duplicate=state.data[type].some(item=>
    !item.archived_at&&item.id!==currentId&&String(item.code||'').trim().toUpperCase()===normalized
  );
  if(duplicate)throw new Error(`Il codice ${normalized} è già utilizzato da un elemento operativo.`);
  return normalized;
}
function dismissalReasons(type){
  return type==='licenses'
    ? ['Non rinnovata','Scaduta definitivamente','Ceduta','Sostituita','Altro']
    : ['Venduto','Rottamato','Guasto irreparabile','Restituito','Sostituito','Altro'];
}
async function detachAsset(type,item){
  if(type==='computers'){
    const station=stationOf('computer',item.id);
    if(station)await assignResource('computer',null,station.id);
  }else if(type==='hardware'){
    const station=stationOf('hardware',item.id);
    if(station)await assignResource('hardware',null,station.id);
  }else if(item.category==='plugin'){
    if(pluginStation(item.id))await assignPlugin(item.id,null);
  }else{
    const station=stationOf('license',item.id);
    if(station)await assignResource('license',null,station.id);
  }
}
function openDismissEditor(type,item){
  openModal(`<div class="modal-head"><h2>Dismetti ${esc(item.code)}</h2><button class="close" data-close>×</button></div>
    <div class="warning-box"><strong>Operazione definitiva</strong><p>L’elemento passerà nello Storico e non potrà essere riattivato o assegnato.</p></div>
    <div class="fields">
      <label>Motivo<select id="dismiss-reason">${dismissalReasons(type).map(reason=>`<option value="${esc(reason)}">${esc(reason)}</option>`).join('')}</select></label>
      ${field('dismiss-note','Nota','')}
    </div>
    <div class="actions"><button class="secondary" data-close>Annulla</button><button class="danger" id="confirm-dismiss">Dismetti definitivamente</button></div>`);
  document.getElementById('confirm-dismiss').onclick=async()=>{
    if(!confirm(`Confermi la dismissione definitiva di ${item.code}?`))return;
    try{
      await detachAsset(type,item);
      const now=new Date().toISOString();
      await saveRow(type,{
        ...item,
        archived_at:now,
        dismissed_at:now,
        dismissal_reason:val('dismiss-reason'),
        dismissal_note:val('dismiss-note')||null
      });
      await addAudit('dismiss',type,item.id,{code:item.code,reason:val('dismiss-reason')});
      modal.close();showToast(`${item.code} spostato nello Storico`);await refresh();
    }catch(error){alert(error.message)}
  };
}

function inventory(type){
  const historic=state.filter==='history';
  const source=state.data[type].filter(x=>historic?!!x.archived_at:!x.archived_at);
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
    historic||state.filter==='all'||state.filter==='assigned'&&loc||state.filter==='warehouse'&&!loc||type==='licenses'&&state.filter===x.category
  );
  if(historic){
    const rows=filtered.sort((a,b)=>new Date(b.x.dismissed_at||b.x.archived_at)-new Date(a.x.dismissed_at||a.x.archived_at));
    return `${filters(type)}<div class="list history-list">${rows.length?rows.map(({x})=>inventoryCard(type,x)).join(''):'<div class="empty">Nessun elemento nello Storico.</div>'}</div>`;
  }
  if(type!=='licenses'){
    const ordered=filtered.sort((a,b)=>{
      const au=a.loc?0:1,bu=b.loc?0:1;
      if(au!==bu)return au-bu;
      return numSort(a.x,b.x);
    });
    return `${filters(type)}<div class="list">${ordered.length?ordered.map(({x})=>inventoryCard(type,x)).join(''):'<div class="empty">Nessun elemento.</div>'}</div>`;
  }
  const orderGroup=rows=>rows.sort((a,b)=>{
    const ac=a.x.category==='avid'?0:1,bc=b.x.category==='avid'?0:1;
    return ac!==bc?ac-bc:numSort(a.x,b.x);
  });
  const assigned=orderGroup(filtered.filter(row=>row.loc));
  const unassigned=orderGroup(filtered.filter(row=>!row.loc));
  const group=(label,rows)=>`<section class="license-inventory-group"><div class="office-label license-group-label"><span>${label}</span></div><div class="list">${rows.length?rows.map(({x})=>inventoryCard(type,x)).join(''):'<div class="empty">Nessun elemento.</div>'}</div></section>`;
  return `${filters(type)}<div class="license-inventory-groups">${group('Assegnati',assigned)}${group('Non assegnati',unassigned)}</div>`;
}
function filters(type){
  const fs=type==='licenses'
    ? [['all','Tutte'],['avid','Avid'],['plugin','Plugin'],['assigned','Assegnate'],['warehouse','Magazzino'],['history','Storico']]
    : [['all','Tutti'],['assigned','Assegnati'],['warehouse','Magazzino'],['history','Storico']];
  return `<div class="filters">${fs.map(([id,label])=>`<button class="filter ${state.filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('')}</div>`;
}
function locationMarkup(text){return text==='Non assegnato'?'<span class="unassigned-text">Non assegnato</span>':esc(text)}

function smartNote(text){
  const clean=String(text||'').trim();
  return clean?`<div class="smart-note"><span>NOTA</span><p>${esc(clean)}</p></div>`:'';
}

function inventoryCard(type,x){
  if(x.archived_at){
    return `<button class="list-card historic-item" data-item="${type}:${x.id}">
      <div>
        <h3>${esc(x.code)}</h3>
        <div class="history-meta"><span class="badge history">STORICO</span><strong>${esc(x.dismissal_reason||'Dismesso')}</strong></div>
        <p>${fmtDate((x.dismissed_at||x.archived_at).slice(0,10))}${x.dismissal_note?` · ${esc(x.dismissal_note)}`:''}</p>
      </div><span>›</span>
    </button>`;
  }
  if(type==='computers')return `<button class="list-card" data-item="computers:${x.id}"><div><h3>${esc(x.code)} · ${esc([x.model,x.variant].filter(Boolean).join(' · '))}</h3><div class="badges">${x.os_name?`<span class="badge os os-${esc(x.os_name.toLowerCase())}">${esc(x.os_name.toUpperCase())}</span>`:''}</div><p>${locationMarkup(currentLocation('computer',x.id))} · Formattazione ${fmtDate(x.formatted_at)}</p>${smartNote(x.notes)}</div><span>›</span></button>`;
  if(type==='hardware')return `<button class="list-card" data-item="hardware:${x.id}"><div><h3>${esc(x.code)} · ${esc(x.model||'')}</h3><p>${locationMarkup(currentLocation('hardware',x.id))}</p></div><span>›</span></button>`;
  const st=licenseStatus(x),kind=x.category==='avid'?x.avid_type:x.plugin_type;
  const loc=currentLocation(x.category==='plugin'?'plugin':'license',x.id);
  const sid=x.category==='avid'&&x.system_id?`System ID ${esc(x.system_id)}`:'';
  return `<button class="list-card license-card ${st.level==='warning'?'license-warning':st.level==='expired'?'license-expired':''}" data-item="licenses:${x.id}">
    <div class="license-card-content"><div class="license-card-top"><h3>${esc(x.code)}</h3><span class="license-sid">${sid}</span></div>
    <div class="badges"><span class="badge ${x.category==='avid'?(x.avid_type==='Ultimate'?'ultimate':'singolo'):'plugin'}">${esc((kind||'').toUpperCase())}</span><span class="badge ${x.billing_cycle}">${cycleLabel(x.billing_cycle)}</span></div>
    <div class="license-card-bottom"><span class="license-time">${esc(st.text)}</span><span class="license-location">${locationMarkup(loc)}</span></div>${smartNote(x.notes)}</div><span class="card-chevron">›</span>
  </button>`;
}


function expiryLabel(license){
  if(!license)return '';
  if(!license.expiry_date)return licenseStatus(license).text.replace(/^Attiva • /,'');
  const today=new Date();today.setHours(0,0,0,0);
  const exp=new Date(license.expiry_date+'T00:00:00');
  const days=Math.ceil((exp-today)/86400000);
  if(days<0)return `Scaduta da ${Math.abs(days)} ${Math.abs(days)===1?'giorno':'giorni'}`;
  if(days===0)return 'Scade oggi';
  return `Scade tra ${days} ${days===1?'giorno':'giorni'}`;
}

function productionClass(room){
  const type=(room?.client_type||'').toUpperCase();
  if(type==='RAI')return 'production-rai';
  if(type==='PRIVATO')return 'production-private';
  if(type==='ALTRO')return 'production-other';
  return 'production-none';
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

function rooms(){
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
        ${smartNote(item.notes)}
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
      ? `<small>SYSTEM ID</small><strong>${esc(item.system_id||'—')}</strong>`
      : `<small>SERIALE</small><strong>${esc(item.plugin_serial||'—')}</strong>`;
    return `<button type="button" class="unassigned-asset-card license-free-card ${status.level} ${status.level!=='ok'?'pulse-critical':''}" data-item="licenses:${item.id}">
      <div class="free-card-head"><strong>${esc(item.code)}</strong><span class="free-expiry">${esc(expiryLabel(item))}</span></div>
      <span>${esc(item.category==='avid'?item.avid_type:item.plugin_type)} · ${cycleLabel(item.billing_cycle)}</span>
      <div class="free-id">${detail}</div>
      ${smartNote(item.notes)}
    </button>`;
  };

  return `<div class="summary-toolbar">
      <div>
        <h2>Sale</h2>
        <p>Clicca sui riquadri per modificare le assegnazioni oppure sull’intestazione della Sala per produzione, configurazione e postazioni.</p>
      </div>

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
                <div class="summary-production-head summary-room-action" data-summary-room="${room.id}" role="button" tabindex="0">
                  <div class="summary-room-title-line">
                    <h3>${esc(room.name)}</h3>
                    ${room.server_config?`<button type="button" class="summary-server-config" data-summary-server="${room.id}" title="${esc(room.server_config)}">· ${esc(room.server_config)}</button>`:''}
                    <button type="button" class="room-label-button" data-room-label="${room.id}" title="Genera Etichetta Sala">🏷️ Etichetta</button>
                  </div>
                  <span class="summary-production-name ${productionClass(room)}">${production?esc(production):'Produzione non indicata'}</span>
                </div>
                ${smartNote(room.notes)}

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

                      <button type="button" class="summary-resource summary-computer summary-assignable" data-room-action="computer" data-summary-assign="computer" data-station="${station.id}" data-resource-type="computers" data-resource-id="${computer?.id||''}">
                        <small>COMPUTER</small>
                        <strong>${computer?esc(computer.code):'—'}</strong>
                        <span>${computer?esc([computer.model,computer.variant].filter(Boolean).join(' · ')):'Non assegnato'}</span>
                        ${computer?.os_name?`<span class="badge os os-${esc(computer.os_name.toLowerCase())}">${esc(computer.os_name.toUpperCase())}</span>`:''}
                        ${computer?smartNote(computer.notes):''}
                        <i class="summary-edit-hint">Modifica</i>
                      </button>

                      <button type="button" class="summary-resource summary-hardware summary-assignable" data-room-action="hardware" data-summary-assign="hardware" data-station="${station.id}" data-resource-type="hardware" data-resource-id="${hardware?.id||''}">
                        <small>HARDWARE</small>
                        <strong>${hardware?esc(hardware.code):'—'}</strong>
                        <span>${hardware?esc(hardware.model||''):'Non assegnato'}</span>
                        <i class="summary-edit-hint">Modifica</i>
                      </button>

                      <button type="button" class="summary-resource summary-avid summary-assignable ${avidLevel} ${avidLevel!=='ok'?'pulse-critical':''}" data-room-action="license" data-summary-assign="license" data-station="${station.id}" data-resource-type="licenses" data-resource-id="${avid?.id||''}">
                        <div class="resource-title-row"><small>AVID</small><span class="resource-expiry ${avidLevel}">${avidState.kind==='license'?esc(expiryLabel(avid)):avidState.kind==='trial'?esc(avidState.status.text):''}</span></div>
                        <strong>${avidState.kind==='license'?esc(avid.code):avidState.kind.startsWith('trial')?'TRIAL':'—'}</strong>
                        ${avidState.kind==='license'
                          ? `<div class="badges"><span class="badge ${avid.avid_type==='Ultimate'?'ultimate':'singolo'}">${esc(avid.avid_type.toUpperCase())}</span><span class="badge ${avid.billing_cycle}">${cycleLabel(avid.billing_cycle)}</span></div><span class="resource-id"><small>SYSTEM ID</small><strong>${esc(avid.system_id||'—')}</strong></span>${smartNote(avid.notes)}`
                          : avidState.kind==='trial-pending'
                            ? '<div class="badges"><span class="badge trial-pending">TRIAL DA ATTIVARE</span></div>'
                            : avidState.kind==='trial'
                              ? '<div class="badges"><span class="badge trial-active">TRIAL ATTIVA</span></div>'
                              : '<span>Non assegnata</span>'}
                        <i class="summary-edit-hint">Modifica</i>
                      </button>

                      <button type="button" class="summary-resource summary-plugins summary-assignable ${pluginLevel} ${pluginLevel!=='ok'?'pulse-critical':''}" data-room-action="plugin" data-summary-assign="plugin" data-station="${station.id}" data-resource-type="licenses" data-resource-id="${plugins.length===1?plugins[0].id:''}" data-plugin-ids="${plugins.map(p=>p.id).join(',')}">
                        <div class="resource-title-row"><small>PLUGIN</small><span></span></div>
                        ${plugins.length?plugins.map(plugin=>{
                          const status=licenseStatus(plugin);
                          return `<div class="summary-plugin ${status.level}">
                            <div class="plugin-head"><strong>${esc(plugin.plugin_type)}</strong><span class="resource-expiry ${status.level}">${esc(expiryLabel(plugin))}</span></div>
                            <div class="badges"><span class="badge ${plugin.billing_cycle}">${cycleLabel(plugin.billing_cycle)}</span></div>
                            <span class="resource-id"><small>SERIALE</small><strong>${esc(plugin.plugin_serial||'—')}</strong></span>
                            ${smartNote(plugin.notes)}
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


const BACKUP_TABLES=[
  'rooms','stations','computers','hardware','licenses',
  'station_plugins','reminders','audit_log'
];

function backupFileName(){
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return `DVS_Backup_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
}

async function collectBackupData(){
  const tables={};
  for(const table of BACKUP_TABLES){
    const {data,error}=await supabase.from(table).select('*');
    if(error)throw error;
    tables[table]=data||[];
  }
  return {
    app:APP_NAME,
    version:APP_VERSION,
    exported_at:new Date().toISOString(),
    tables
  };
}

function downloadJSON(data,fileName){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function exportFullBackup(){
  const payload=await collectBackupData();
  const fileName=backupFileName();
  downloadJSON(payload,fileName);
  const stamp={fileName,date:new Date().toISOString()};
  localStorage.setItem('dvs_last_backup',JSON.stringify(stamp));
  return stamp;
}

async function restoreBackupPayload(payload){
  if(!payload?.tables)throw new Error('File di backup non valido.');

  const order=['audit_log','reminders','station_plugins','stations','licenses','hardware','computers','rooms'];
  for(const table of order){
    const {error}=await supabase.from(table).delete().neq('id','00000000-0000-0000-0000-000000000000');
    if(error)throw error;
  }

  const insertOrder=['rooms','computers','hardware','licenses','stations','station_plugins','reminders','audit_log'];
  for(const table of insertOrder){
    const rows=payload.tables[table]||[];
    if(rows.length){
      const {error}=await supabase.from(table).insert(rows);
      if(error)throw error;
    }
  }
}

function openBackupImportPicker(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='application/json,.json';
  input.onchange=async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      await restoreBackupPayload(payload);
      showToast('Backup ripristinato');
      await refresh();
    }catch(error){
      alert(`Importazione non riuscita: ${error.message}`);
    }
  };
  input.click();
}

function lastBackupInfo(){
  try{
    return JSON.parse(localStorage.getItem('dvs_last_backup')||'null');
  }catch{return null}
}


function printHeader(title){
  const now=new Date().toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});
  return `<header class="print-doc-header">
    <img src="./assets/logo-dvs.png" alt="Digital Video Service">
    <div>
      <strong>Digital Video Service</strong>
      <h1>${esc(title)}</h1>
      <p>${APP_NAME} · Versione ${APP_VERSION} · ${esc(now)}</p>
    </div>
  </header>`;
}

function printFooter(){
  return `<footer class="print-doc-footer">
    <span>© 2026 Digital Video Service S.r.l.</span>
    <span>DVS Workspace</span>
    <span class="print-page-number">Pagina</span>
  </footer>`;
}

function printDocument(title,body,orientation='portrait'){
  return `<article class="print-document print-${orientation}">${printHeader(title)}<main class="print-document-body">${body}</main>${printFooter()}</article>`;
}

function printAssigned(kind,item){
  if(kind==='computers')return !!stationOf('computer',item.id);
  if(kind==='hardware')return !!stationOf('hardware',item.id);
  if(kind==='plugins')return !!pluginStation(item.id);
  return !!stationOf('license',item.id);
}

function printLocation(kind,item){
  const station=kind==='computers'?stationOf('computer',item.id):kind==='hardware'?stationOf('hardware',item.id):kind==='plugins'?pluginStation(item.id):stationOf('license',item.id);
  return station?stationLabel(station):'Non assegnato';
}

function printItems(kind,excludeUnassigned=false){
  let items;
  if(kind==='plugins')items=state.data.licenses.filter(x=>!x.archived_at&&x.category==='plugin');
  else if(kind==='licenses')items=state.data.licenses.filter(x=>!x.archived_at&&x.category==='avid');
  else items=state.data[kind].filter(x=>!x.archived_at);
  if(excludeUnassigned)items=items.filter(x=>printAssigned(kind,x));
  return items.sort(numSort);
}

function printSummaryDocument(excludeUnassigned=false){
  const rooms=[...state.data.rooms].sort((a,b)=>a.position-b.position);
  const roomHtml=rooms.map(room=>{
    const stations=state.data.stations.filter(s=>s.room_id===room.id).sort((a,b)=>a.position-b.position);
    const stationHtml=stations.map((station,index)=>{
      const computer=state.data.computers.find(x=>x.id===station.computer_id);
      const hardware=state.data.hardware.find(x=>x.id===station.hardware_id);
      const avid=state.data.licenses.find(x=>x.id===station.avid_license_id);
      const plugins=stationPluginItems(station.id);
      return `<div class="print-room-station">
        <div class="print-station-name">${stations.length>1?`Postazione ${index+1}`:'Postazione'}</div>
        <div class="print-layout-cell"><b>Computer</b><span>${computer?esc(`${computer.code} · ${computer.model||''}`):'Non assegnato'}</span></div>
        <div class="print-layout-cell"><b>Hardware</b><span>${hardware?esc(`${hardware.code} · ${hardware.model||''}`):'Non assegnato'}</span></div>
        <div class="print-layout-cell"><b>Avid</b><span>${avid?esc(`${avid.code} · ${avid.avid_type||''}`):'Non assegnata'}</span></div>
        <div class="print-layout-cell"><b>Plugin</b><span>${plugins.length?plugins.map(p=>esc(`${p.code} · ${p.plugin_type||''}`)).join('<br>'):'Non assegnato'}</span></div>
      </div>`;
    }).join('');
    return `<section class="print-room-layout"><div class="print-room-head"><h2>${esc(room.name)}</h2><span>${esc(productionLabel(room)||'')}</span></div>${stationHtml}</section>`;
  }).join('');
  return printDocument('Sale',roomHtml+(excludeUnassigned?'':printUnassignedSection()),'landscape');
}

function printUnassignedSection(){
  const groups=[['Computer',printItems('computers').filter(x=>!printAssigned('computers',x)),x=>`${x.code} · ${x.model||''}`],['Hardware',printItems('hardware').filter(x=>!printAssigned('hardware',x)),x=>`${x.code} · ${x.model||''}`],['Avid',printItems('licenses').filter(x=>!printAssigned('licenses',x)),x=>`${x.code} · ${x.avid_type||''}`],['Plugin',printItems('plugins').filter(x=>!printAssigned('plugins',x)),x=>`${x.code} · ${x.plugin_type||''}`]];
  return `<section class="print-unassigned"><h2>Non assegnati</h2><div class="print-unassigned-grid">${groups.map(([title,items,label])=>`<div><h3>${title}</h3>${items.length?items.map(x=>`<p>${esc(label(x))}</p>`).join(''):'<p>Nessun elemento</p>'}</div>`).join('')}</div></section>`;
}

function printLayoutDocument(kind,excludeUnassigned=false){
  const items=printItems(kind,excludeUnassigned);
  const titles={computers:'Computer',hardware:'Hardware',licenses:'Licenze Avid',plugins:'Plugin'};
  const cards=items.map(x=>{
    let meta='';
    if(kind==='computers')meta=[x.model,x.os_name,x.os_version].filter(Boolean).join(' · ');
    if(kind==='hardware')meta=[x.model,x.serial].filter(Boolean).join(' · ');
    if(kind==='licenses')meta=[x.avid_type,x.system_id?`System ID ${x.system_id}`:'',expiryLabel(x)].filter(Boolean).join(' · ');
    if(kind==='plugins')meta=[x.plugin_type,x.plugin_serial,expiryLabel(x)].filter(Boolean).join(' · ');
    return `<section class="print-inventory-card"><div><h2>${esc(x.code||'—')}</h2><p>${esc(meta||'Nessun dettaglio sintetico')}</p></div><span>${esc(printLocation(kind,x))}</span></section>`;
  }).join('')||'<p class="print-empty">Nessun elemento da stampare.</p>';
  return printDocument(titles[kind],`<div class="print-card-list">${cards}</div>`,'portrait');
}

function detailPairs(kind,x){
  if(kind==='computers')return [['Codice',x.code],['Modello',x.model],['Variante',x.variant],['Processore',x.processor],['RAM',x.ram],['Scheda grafica',x.gpu],['Sistema operativo',[x.os_name,x.os_version].filter(Boolean).join(' ')],['Seriale',x.serial],['Data formattazione',fmtDate(x.format_date)],['Posizione',printLocation(kind,x)],['Note',x.notes]];
  if(kind==='hardware')return [['Codice',x.code],['Modello',x.model],['Tipologia',x.hardware_type],['Seriale',x.serial],['Posizione',printLocation(kind,x)],['Note',x.notes]];
  if(kind==='licenses')return [['Codice',x.code],['Tipologia Avid',x.avid_type],['System ID',x.system_id],['Codice licenza',x.license_code],['Ciclo',cycleLabel(x)],['Scadenza',expiryLabel(x)],['Posizione',printLocation(kind,x)],['Note',x.notes]];
  return [['Codice',x.code],['Plugin',x.plugin_type],['Seriale',x.plugin_serial],['Ciclo',cycleLabel(x)],['Scadenza',expiryLabel(x)],['Posizione',printLocation(kind,x)],['Note',x.notes]];
}

function printDetailedDocument(kind,excludeUnassigned=false){
  const items=printItems(kind,excludeUnassigned);
  const titles={computers:'Archivio Computer',hardware:'Archivio Hardware',licenses:'Archivio Licenze Avid',plugins:'Archivio Plugin'};
  const records=items.map(x=>`<section class="print-detail-record"><h2>${esc(x.code||'—')}</h2><dl>${detailPairs(kind,x).filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()!=='').map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl></section>`).join('')||'<p class="print-empty">Nessun elemento da stampare.</p>';
  return printDocument(titles[kind],records,'portrait');
}

function printArchiveDocument(excludeUnassigned=false){
  return ['computers','hardware','licenses','plugins'].map(kind=>printDetailedDocument(kind,excludeUnassigned)).join('');
}

function openPrintPreview(html,orientation='portrait'){
  document.getElementById('print-root')?.remove();
  const root=document.createElement('div');
  root.id='print-root';
  root.innerHTML=html;
  document.body.appendChild(root);
  document.body.classList.add('print-preview-open');
  document.body.classList.toggle('print-landscape-mode',orientation==='landscape');
}
function closePrintPreview(){document.getElementById('print-root')?.remove();document.body.classList.remove('print-preview-open','print-landscape-mode')}
function runSystemPrint(){window.print()}
function printOptionCheck(id,label,isChecked=false){return `<label class="option-check"><input id="${id}" type="checkbox" ${isChecked?'checked':''}><span>${label}</span></label>`}

function openPrintCenter(){
  openModal(`<div class="modal-head"><h2>Centro Stampa</h2><button class="close" data-close>×</button></div>
    <div class="print-center">
      <label>Categoria<select id="print-document"><option value="summary">Sale</option><option value="computers">Computer</option><option value="hardware">Hardware</option><option value="licenses">Licenze</option><option value="plugins">Plugin</option><option value="archive">Archivio completo</option></select></label>
      <div id="print-options">${printOptionCheck('print-complete','Stampa dettagli',false)}${printOptionCheck('print-exclude-unassigned','Escludi non assegnati',false)}</div>
      <p class="print-center-help" id="print-mode-help">Stampa il layout Sale come visualizzato nel gestionale.</p>
      <div class="actions print-actions"><button class="secondary" id="print-preview">Anteprima</button><button class="secondary" id="print-save-pdf">Salva come PDF</button><button class="primary" id="print-now">Stampa</button></div>
    </div>`);

  const docEl=document.getElementById('print-document');
  const detailEl=document.getElementById('print-complete');
  const help=document.getElementById('print-mode-help');
  const updateHelp=()=>{
    const doc=docEl.value,detail=detailEl.checked;
    detailEl.disabled=doc==='summary'||doc==='archive';
    if(doc==='summary')help.textContent='Stampa il layout delle Sale in orizzontale.';
    else if(doc==='archive')help.textContent='Stampa l’archivio dettagliato completo di tutte le categorie.';
    else help.textContent=detail?'Stampa l’archivio dettagliato della categoria.':'Stampa il layout sintetico della categoria, come nell’app.';
  };
  docEl.onchange=updateHelp; detailEl.onchange=updateHelp; updateHelp();
  const build=()=>{
    const doc=docEl.value,detail=detailEl.checked,exclude=checked('print-exclude-unassigned');
    if(doc==='summary')return {html:printSummaryDocument(exclude),orientation:'landscape'};
    if(doc==='archive')return {html:printArchiveDocument(exclude),orientation:'portrait'};
    return {html:detail?printDetailedDocument(doc,exclude):printLayoutDocument(doc,exclude),orientation:'portrait'};
  };
  const execute=(print=false,pdf=false)=>{const result=build();openPrintPreview(result.html,result.orientation);modal.close();if(pdf)showToast('Nella finestra di stampa scegli “Salva come PDF”');if(print||pdf)setTimeout(runSystemPrint,120)};
  document.getElementById('print-preview').onclick=()=>execute();
  document.getElementById('print-now').onclick=()=>execute(true);
  document.getElementById('print-save-pdf').onclick=()=>execute(false,true);
}

function settings(){
  const last=lastBackupInfo();
  const lastText=last
    ? `${last.fileName}<br><small>${new Date(last.date).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}</small>`
    : 'Mai eseguito';

  return `<div class="settings-grid">
    <button class="setting-card" data-setting="print">
      <span class="setting-icon">${navIcon('summary')}</span>
      <strong>Stampa ed esportazione</strong>
      <small>Sale, Computer, Hardware, Licenze e archivio completo</small>
    </button>

    <button class="setting-card" data-setting="backup">
      <span class="setting-icon">${navIcon('computer')}</span>
      <strong>Backup</strong>
      <small>Ultimo backup: ${lastText}</small>
    </button>

    <button class="setting-card" data-setting="notifications">
      <span class="setting-icon">${navIcon('bell')}</span>
      <strong>Notifiche</strong>
      <small>Gestisci gli avvisi delle scadenze.</small>
    </button>

    <button class="setting-card" data-setting="audit">
      <span class="setting-icon">${navIcon('audit')}</span>
      <strong>Registro modifiche</strong>
      <small>Consulta le operazioni effettuate.</small>
    </button>

    <button class="setting-card" data-setting="about">
      <span class="setting-icon">${navIcon('settings')}</span>
      <strong>Informazioni</strong>
      <small>Versione, changelog, statistiche e crediti.</small>
    </button>

    <button class="setting-card danger-setting" id="logout">
      <span class="setting-icon">${navIcon('logout')}</span>
      <strong>Esci</strong>
      <small>Termina la sessione corrente.</small>
    </button>
  </div>`;
}

function render(){
  if(!state.data)return;
  const add=document.getElementById('add-btn');
  if(add)add.hidden=state.view==='dashboard'||state.view==='rooms'||state.view==='settings';
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
            :settings();
  bindContent();
}

function bindCompactHeader(){
  const update=()=>document.body.classList.toggle('header-compact',window.scrollY>36);
  window.removeEventListener('scroll',update);
  window.addEventListener('scroll',update,{passive:true});
  update();
}


function bindRoomAssetInteractions(){
  document.querySelectorAll('[data-room-action]').forEach(button=>{
    const action=button.dataset.summaryAssign;
    const stationId=button.dataset.station;

    let clickTimer=null;
    let longTimer=null;
    let longPressed=false;
    let suppressClick=false;
    let startX=0;
    let startY=0;

    const mainAction=()=>assignmentSheet(action,stationId);

    const pluginIds=()=>{
      const relationIds=state.data.station_plugins
        .filter(link=>link.station_id===stationId)
        .map(link=>link.license_id);

      const datasetIds=String(button.dataset.pluginIds||'')
        .split(',')
        .map(value=>value.trim())
        .filter(Boolean);

      return [...new Set([...relationIds,...datasetIds])];
    };

    const detailAction=()=>{
      const station=state.data.stations.find(item=>item.id===stationId);

      if(action==='license'){
        const licenseId=station?.avid_license_id||button.dataset.resourceId;

        if(licenseId){
          openDetail('licenses',licenseId);
          return;
        }

        const trial=trialInfo(station);
        if(trial.status==='active'||trial.status==='pending'){
          openTrialExpiryEditor(stationId);
          return;
        }

        mainAction();
        return;
      }

      if(action==='plugin'){
        const ids=pluginIds();

        if(ids.length===1){
          openDetail('licenses',ids[0]);
          return;
        }

        if(ids.length>1){
          openModal(`<div class="modal-head">
              <h2>Plugin della postazione</h2>
              <button class="close" data-close>×</button>
            </div>
            <div class="choices">
              ${ids.map(id=>{
                const plugin=state.data.licenses.find(item=>item.id===id);
                return plugin?`<button type="button" class="choice" data-plugin-detail="${plugin.id}">
                  <strong>${esc(plugin.code)}</strong><br>
                  <small>${esc(plugin.plugin_type||'Plugin')}</small>
                </button>`:'';
              }).join('')}
            </div>`);

          document.querySelectorAll('[data-plugin-detail]').forEach(item=>{
            item.onclick=()=>{
              const pluginId=item.dataset.pluginDetail;
              modal.close();
              setTimeout(()=>openDetail('licenses',pluginId),0);
            };
          });
          return;
        }

        mainAction();
        return;
      }

      const resourceType=button.dataset.resourceType;
      const resourceId=button.dataset.resourceId;

      if(resourceType&&resourceId){
        openDetail(resourceType,resourceId);
        return;
      }

      mainAction();
    };

    button.addEventListener('contextmenu',event=>event.preventDefault());

    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();

      if(suppressClick){
        suppressClick=false;
        return;
      }

      if(event.detail>=2){
        if(clickTimer){
          clearTimeout(clickTimer);
          clickTimer=null;
        }
        detailAction();
        return;
      }

      if(event.pointerType==='touch')return;

      if(clickTimer)clearTimeout(clickTimer);
      clickTimer=setTimeout(()=>{
        clickTimer=null;
        mainAction();
      },340);
    });

    button.addEventListener('dblclick',event=>{
      event.preventDefault();
      event.stopPropagation();

      if(clickTimer){
        clearTimeout(clickTimer);
        clickTimer=null;
      }

      detailAction();
    });

    button.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse')return;

      event.stopPropagation();
      longPressed=false;
      startX=event.clientX;
      startY=event.clientY;

      longTimer=setTimeout(()=>{
        longTimer=null;
        longPressed=true;
        suppressClick=true;
        detailAction();
      },560);
    });

    button.addEventListener('pointermove',event=>{
      if(!longTimer)return;

      if(Math.hypot(event.clientX-startX,event.clientY-startY)>10){
        clearTimeout(longTimer);
        longTimer=null;
      }
    });

    const cancelLong=()=>{
      if(longTimer){
        clearTimeout(longTimer);
        longTimer=null;
      }
    };

    button.addEventListener('pointerup',event=>{
      const wasLong=longPressed;
      cancelLong();

      if(event.pointerType!=='mouse'&&!wasLong){
        suppressClick=true;
        event.preventDefault();
        event.stopPropagation();
        mainAction();
      }
    });

    button.addEventListener('pointercancel',cancelLong);
  });
}

function bindContent(){
  bindCompactHeader();
  if(state.view==='dashboard')bindReminderInteractions();

  document.querySelectorAll('[data-dashboard-nav]').forEach(button=>button.onclick=()=>{
    dashboardNavigate(button.dataset.dashboardNav,button.dataset.dashboardFilter||'all');
  });
  bindDashboardAttentionInteractions();
  document.getElementById('dashboard-backup')?.addEventListener('click',()=>openSetting('backup'));
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
  document.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const [t,id]=b.dataset.item.split(':');openDetail(t,id)});
  document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>openRoom(b.dataset.room));
  document.querySelectorAll('[data-open-license]').forEach(b=>b.onclick=()=>openDetail('licenses',b.dataset.openLicense));
  document.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>openSetting(b.dataset.setting));
  bindRoomAssetInteractions();
  document.querySelectorAll('[data-summary-room]').forEach(b=>{
    b.onclick=event=>{
      if(event.target.closest('[data-summary-server],[data-room-label]'))return;
      openSummaryRoomActions(b.dataset.summaryRoom);
    };
    b.onkeydown=event=>{
      if((event.key==='Enter'||event.key===' ')&&!event.target.closest('[data-summary-server],[data-room-label]')){
        event.preventDefault();
        openSummaryRoomActions(b.dataset.summaryRoom);
      }
    };
  });
  document.querySelectorAll('[data-summary-server]').forEach(b=>b.onclick=event=>{
    event.stopPropagation();
    const room=state.data.rooms.find(r=>r.id===b.dataset.summaryServer);
    if(room)openServerConfigEditor(room);
  });
  document.querySelectorAll('[data-room-label]').forEach(b=>b.onclick=event=>{
    event.stopPropagation();
    const room=state.data.rooms.find(r=>r.id===b.dataset.roomLabel);
    if(room)openRoomLabel(room);
  });
  document.getElementById('logout')?.addEventListener('click',async()=>supabase.auth.signOut());
}


function openSummaryRoomActions(roomId){
  const room=state.data.rooms.find(r=>r.id===roomId);
  const stations=state.data.stations.filter(s=>s.room_id===roomId).sort((a,b)=>a.position-b.position);

  openSheet(`<div class="modal-head"><h2>${esc(room.name)}</h2><button class="close" data-close-sheet>×</button></div>
    <button class="choice" id="summary-production-action"><strong>Produzione</strong><br><small>${esc(productionLabel(room)||'Non indicata')}</small></button>
    <button class="choice" id="summary-server-action"><strong>Configurazione Server</strong><br><small>${esc(room.server_config||'Non indicata')}</small></button>
    <button class="choice" id="summary-add-station"><strong>Aggiungi postazione</strong><br><small>Crea quattro riquadri vuoti nella Sala</small></button>
    ${stations.length>1?'<button class="choice danger-choice" id="summary-delete-station"><strong>Elimina postazione</strong><br><small>Rimuove l’ultima postazione aggiunta</small></button>':''}
    <button class="choice" data-close-sheet><strong>Chiudi</strong></button>`);

  document.getElementById('summary-production-action').onclick=()=>{
    sheet.close();
    openSummaryProductionEditor(room);
  };

  document.getElementById('summary-server-action').onclick=()=>{
    sheet.close();
    openServerConfigEditor(room);
  };

  document.getElementById('summary-add-station').onclick=async()=>{
    try{
      await saveRow('stations',{id:uuid(),room_id:room.id,position:stations.length+1});
      await addAudit('create','stations',room.id,{room:room.name});
      sheet.close();showToast('Postazione aggiunta');await refresh();
    }catch(error){alert(error.message)}
  };

  document.getElementById('summary-delete-station')?.addEventListener('click',async()=>{
    const station=stations[stations.length-1];
    if(!station||!confirm(`Eliminare la Postazione ${station.position} da ${room.name}?`))return;
    try{
      for(const link of state.data.station_plugins.filter(x=>x.station_id===station.id))await assignPlugin(link.license_id,null);
      if(station.computer_id)await assignResource('computer',null,station.id);
      if(station.hardware_id)await assignResource('hardware',null,station.id);
      if(station.avid_license_id)await assignResource('license',null,station.id);
      const {error}=await supabase.from('stations').delete().eq('id',station.id);
      if(error)throw error;
      await addAudit('delete','stations',station.id,{room:room.name,position:station.position});
      sheet.close();showToast('Postazione eliminata');await refresh();
    }catch(error){alert(error.message)}
  });
}


function openServerConfigEditor(room){
  openModal(`<div class="modal-head"><h2>Configurazione Server · ${esc(room.name)}</h2><button class="close" data-close>×</button></div>
    <div class="fields">
      ${field('server-config','Configurazione Server',room.server_config||'')}
      <small class="field-help">Esempio: 192.168.2.102 - 192.168.2.200</small>
    </div>
    <div class="production-actions">
      <button class="danger production-remove" id="remove-server-config" ${room.server_config?'':'disabled'}>Elimina</button>
      <div class="actions">
        <button class="secondary" data-close>Annulla</button>
        <button class="primary" id="save-server-config">Salva</button>
      </div>
    </div>`);

  document.getElementById('save-server-config').onclick=async()=>{
    const value=val('server-config').trim();
    if(!value){
      alert('Inserisci la configurazione oppure usa Elimina.');
      return;
    }
    try{
      await saveRow('rooms',{...room,server_config:value});
      await addAudit('update','rooms',room.id,{server_config:value});
      modal.close();
      showToast('Configurazione Server salvata');
      await refresh();
    }catch(error){alert(error.message)}
  };

  document.getElementById('remove-server-config').onclick=async()=>{
    if(!room.server_config||!confirm(`Eliminare la Configurazione Server da ${room.name}?`))return;
    try{
      await saveRow('rooms',{...room,server_config:null});
      await addAudit('update','rooms',room.id,{server_config:null});
      modal.close();
      showToast('Configurazione Server eliminata');
      await refresh();
    }catch(error){alert(error.message)}
  };
}

function openSummaryProductionEditor(room){
  openModal(`<div class="modal-head"><h2>Produzione · ${esc(room.name)}</h2><button class="close" data-close>×</button></div>
    <div class="fields">
      ${segmented('summary-production-type','Tipo produzione',[
        ['RAI','RAI'],
        ['PRIVATO','PRIVATO'],
        ['ALTRO','ALTRO']
      ],room.client_type||'RAI')}
      ${field('summary-production-name','Titolo produzione',room.production_name||'')}
    </div>
    <div class="production-actions">
      <button class="danger production-remove" id="remove-summary-production">Elimina produzione</button>
      <div class="actions">
        <button class="secondary" data-close>Annulla</button>
        <button class="primary" id="save-summary-production">Salva</button>
      </div>
    </div>`);

  bindSegments(modalBody);

  document.getElementById('save-summary-production').onclick=async()=>{
    const type=val('summary-production-type');
    const name=val('summary-production-name').trim();

    if(!name){
      alert('Inserisci il titolo della produzione oppure usa “Elimina produzione”.');
      return;
    }

    try{
      await saveRow('rooms',{
        ...room,
        client_type:type,
        production_name:name
      });
      await addAudit('update','rooms',room.id,{
        client_type:type,
        production_name:name
      });
      modal.close();
      showToast('Produzione salvata');
      await refresh();
    }catch(error){
      alert(error.message);
    }
  };

  document.getElementById('remove-summary-production').onclick=async()=>{
    if(!confirm(`Eliminare la produzione da ${room.name}?`))return;

    try{
      await saveRow('rooms',{
        ...room,
        client_type:null,
        production_name:null
      });
      await addAudit('update','rooms',room.id,{
        client_type:null,
        production_name:null
      });
      modal.close();
      showToast('Produzione eliminata');
      await refresh();
    }catch(error){
      alert(error.message);
    }
  };
}

function openDetail(type,id){
  const x=state.data[type].find(v=>v.id===id);
  const historic=!!x.archived_at;
  const rows=type==='computers'
    ? [['ID',x.code],['Modello',x.model],['Anno',x.variant],['Processore',x.cpu],['RAM',x.ram],['GPU',x.gpu],['Seriale',x.serial],['macOS',`${x.os_name||''} ${x.os_version||''}`],['Formattazione',fmtDate(x.formatted_at)],['Assegnazione',historic?'Storico':currentLocation('computer',x.id)],['Motivo dismissione',x.dismissal_reason],['Data dismissione',fmtDate((x.dismissed_at||'').slice(0,10))],['Nota dismissione',x.dismissal_note]]
    : type==='hardware'
      ? [['ID',x.code],['Modello',x.model],['Seriale',x.serial],['Driver',x.driver_version],['Assegnazione',historic?'Storico':currentLocation('hardware',x.id)],['Motivo dismissione',x.dismissal_reason],['Data dismissione',fmtDate((x.dismissed_at||'').slice(0,10))],['Nota dismissione',x.dismissal_note]]
      : [['ID',x.code],['Categoria',x.category==='avid'?'Avid':'Plugin'],['Tipo',x.category==='avid'?x.avid_type:x.plugin_type],['System ID',x.system_id],['Codice / Seriale',x.activation_code||x.plugin_serial],['Versione',x.version],['Durata',cycleLabel(x.billing_cycle)],['Scadenza',fmtDate(x.expiry_date)],['Assegnazione',historic?'Storico':currentLocation(x.category==='plugin'?'plugin':'license',x.id)],['Motivo dismissione',x.dismissal_reason],['Data dismissione',fmtDate((x.dismissed_at||'').slice(0,10))],['Nota dismissione',x.dismissal_note]];
  openModal(`<div class="modal-head"><h2>${esc(x.code)}</h2><button class="close" data-close>×</button></div>
    <div class="fields">${rows.filter(([,value])=>value).map(([label,value])=>`<div class="resource-row"><span class="subtle">${esc(label)}</span><strong>${esc(value||'—')}</strong></div>`).join('')}</div>
    <div class="actions">${historic?'<button class="primary" data-close>Chiudi</button>':'<button class="secondary" id="dismiss-item">Dismetti</button><button class="primary" id="edit-item">Modifica</button>'}</div>`);
  if(!historic){
    document.getElementById('edit-item').onclick=()=>editItem(type,x);
    document.getElementById('dismiss-item').onclick=()=>openDismissEditor(type,x);
  }
}

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
function editItem(type,x={_new:true,id:uuid()}){
  const isNew=x._new;
  if(isNew&&type==='computers')x.code=nextComputerCode();
  if(isNew&&type==='hardware')x.code=nextHardwareCode();
  if(isNew&&type==='licenses'&&!x.category){x.category='avid';x.avid_type='Ultimate';x.code=nextAvidCode('Ultimate');}
  if(type==='computers')openModal(`<div class="modal-head"><h2>${isNew?'Nuovo computer':esc(x.code)}</h2><button class="close" data-close>×</button></div><div class="fields">${field('code','ID',x.code)}${field('model','Modello',x.model)}${field('variant','Anno / Variante',x.variant)}${field('cpu','Processore / Chip',x.cpu)}${field('ram','RAM',x.ram)}${field('gpu','Scheda grafica',x.gpu)}${field('storage','Archiviazione',x.storage)}${field('serial','Numero seriale',x.serial)}${segmented('os','Sistema operativo',[['Mojave','MOJAVE'],['Monterey','MONTEREY'],['Ventura','VENTURA'],['Sonoma','SONOMA'],['Sequoia','SEQUOIA'],['Tahoe','TAHOE']],x.os_name||'Monterey')}${field('osv','Versione macOS',x.os_version)}${field('formatted','Data formattazione',x.formatted_at,'date')}${stationSelectHTML('assignment','Assegnazione',stationOf('computer',x.id)?.id||'')}${field('notes','Note',x.notes)}</div><div class="actions"><button class="secondary" data-close>Annulla</button><button class="primary" id="save">Salva</button></div>`);
  else if(type==='hardware')openModal(`<div class="modal-head"><h2>${isNew?'Nuovo hardware':esc(x.code)}</h2><button class="close" data-close>×</button></div><div class="fields">${field('code','ID',x.code)}${field('category','Categoria / Tipo',x.category)}${field('model','Modello',x.model)}${field('serial','Numero seriale',x.serial)}${field('driver','Driver / Firmware',x.driver_version)}${stationSelectHTML('assignment','Assegnazione',stationOf('hardware',x.id)?.id||'')}${field('notes','Note',x.notes)}</div><div class="actions"><button class="secondary" data-close>Annulla</button><button class="primary" id="save">Salva</button></div>`);
  else licenseEditor(x,isNew);
  bindSegments(modalBody);
  if(isNew&&type!=='licenses'){
    const code=document.getElementById('code');
    if(code)code.readOnly=false;
  }
  document.getElementById('save')?.addEventListener('click',()=>saveEditor(type,x,isNew));
}
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
    <label class="option-check"><input id="deactivation" type="checkbox" ${x.deactivation_requested?'checked':''}><span>Disattivazione richiesta</span></label>
    ${stationSelectHTML('assignment','Assegnazione',(x.category==='plugin'?pluginStation(x.id):stationOf('license',x.id))?.id||'')}
    ${field('notes','Note',x.notes)}
  </div><div class="actions"><button class="secondary" data-close>Annulla</button><button class="primary" id="save">Salva</button></div>`);
  const draw=()=>{
    const cat=val('category');
    document.getElementById('license-fields').innerHTML=cat==='avid'
      ? `${segmented('avid-type','Tipo Avid',[['Singolo','SINGOLO'],['Ultimate','ULTIMATE']],x.avid_type||'Ultimate')}${field('system','System ID',x.system_id)}${field('activation-code','Codice attivazione',x.activation_code)}${field('version','Versione',x.version)}`
      : `${segmented('plugin-type','Tipo Plugin',[['Continuum','CONTINUUM'],['Sapphire','SAPPHIRE']],x.plugin_type||'Continuum')}${field('plugin-serial','Seriale Plugin',x.plugin_serial)}`;
    bindSegments(document.getElementById('license-fields'));
    if(isNew&&cat==='avid'){
      const updateCode=()=>{document.getElementById('code').value=nextAvidCode(val('avid-type')||'Ultimate')};
      document.getElementById('avid-type').onchange=updateCode;
      document.querySelectorAll('[data-segment="avid-type"] button').forEach(button=>button.addEventListener('click',()=>setTimeout(updateCode,0)));
      updateCode();
      document.getElementById('code').readOnly=false;
    }else if(isNew){
      document.getElementById('code').readOnly=false;
    }
  };
  const refreshExpiry=()=>{const el=document.getElementById('expiry');if(el)el.value=calculateExpiry(val('activation'),val('cycle'))};
  bindSegments(modalBody);draw();
  document.getElementById('category').onchange=()=>{draw()};
  document.querySelectorAll('[data-segment="category"] button').forEach(button=>button.addEventListener('click',()=>setTimeout(draw,0)));
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

async function saveEditor(type,x,isNew){
  try{
    let row={id:x.id};let assignment=val('assignment');
    if(type==='computers'){
      Object.assign(row,{code:validateAssetCode(type,val('code'),x.id),model:val('model'),variant:val('variant'),cpu:val('cpu'),ram:val('ram'),gpu:val('gpu'),storage:val('storage'),serial:val('serial'),os_name:val('os'),os_version:val('osv'),formatted_at:val('formatted')||null,notes:val('notes'),attachments_count:x.attachments_count||0});
    }else if(type==='hardware'){
      Object.assign(row,{code:validateAssetCode(type,val('code'),x.id),category:val('category'),model:val('model'),serial:val('serial'),driver_version:val('driver'),notes:val('notes'),attachments_count:x.attachments_count||0});
    }else{
      const category=val('category'),avidType=category==='avid'?val('avid-type'):null;
      Object.assign(row,{code:validateAssetCode(type,val('code'),x.id,{category,avid_type:avidType}),category,avid_type:avidType,plugin_type:category==='plugin'?val('plugin-type'):null,system_id:val('system')||null,activation_code:val('activation-code')||null,plugin_serial:val('plugin-serial')||null,version:val('version')||null,billing_cycle:val('cycle'),is_trial:false,activation_date:val('activation')||null,expiry_date:val('expiry')||null,deactivation_requested:checked('deactivation'),notes:val('notes'),attachments_count:x.attachments_count||0});
    }
    const kind=type==='computers'?'computer':type==='hardware'?'hardware':row.category==='plugin'?'plugin':'license';
    if(!(await confirmAssignment(kind,{...x,...row},assignment)))return;
    const saved=await saveRow(type,row);
    if(type==='computers')await assignResource('computer',saved.id,assignment||null);
    if(type==='hardware')await assignResource('hardware',saved.id,assignment||null);
    if(type==='licenses'){
      if(saved.category==='plugin')await assignPlugin(saved.id,assignment||null);
      else{if(assignment)await clearStationTrial(assignment);await assignResource('license',saved.id,assignment||null);}
    }
    await addAudit(isNew?'create':'update',type,saved.id,{code:saved.code});
    modal.close();showToast('Salvato');await refresh();
  }catch(error){alert(error.message)}
}

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
const SERVICE_WORKER_URL='./sw.js?v=11-0';
let serviceWorkerRegistrationPromise=null;
async function ensureServiceWorkerRegistration(){
  if(!('serviceWorker' in navigator))throw new Error('Il Service Worker non è supportato da questo browser.');
  if(!serviceWorkerRegistrationPromise){
    serviceWorkerRegistrationPromise=(async()=>{
      const registration=await navigator.serviceWorker.register(SERVICE_WORKER_URL,{scope:'./',updateViaCache:'none'});
      try{await registration.update()}catch(error){console.warn('[DVS] Aggiornamento Service Worker non riuscito:',error)}
      if(registration.active)return registration;
      const worker=registration.installing||registration.waiting;
      if(worker){
        await new Promise((resolve,reject)=>{
          const timeout=setTimeout(()=>reject(new Error('Il Service Worker non si è attivato in tempo.')),12000);
          const verify=()=>{
            if(worker.state==='activated'){
              clearTimeout(timeout);resolve();
            }else if(worker.state==='redundant'){
              clearTimeout(timeout);reject(new Error('Installazione del Service Worker non riuscita.'));
            }
          };
          worker.addEventListener('statechange',verify);
          verify();
        });
      }
      const ready=await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Il Service Worker non risponde. Ricarica la pagina e riprova.')),12000))
      ]);
      return ready;
    })().catch(error=>{
      serviceWorkerRegistrationPromise=null;
      throw error;
    });
  }
  return serviceWorkerRegistrationPromise;
}
function isStandaloneApp(){
  return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
}
async function rawPushSubscription(){
  if(!pushSupported())return null;
  const registration=await ensureServiceWorkerRegistration();
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
  const registration=await ensureServiceWorkerRegistration();
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
  const registration=await ensureServiceWorkerRegistration();
  await registration.showNotification('DVS Workspace',{
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

      <div class="notification-version"><span>Versione</span><strong>${APP_VERSION}</strong></div>

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
  if(k==='print'){
    openPrintCenter();
    return;
  }
  if(k==='backup'){
    const last=lastBackupInfo();
    openModal(`<div class="modal-head"><h2>Backup</h2><button class="close" data-close>×</button></div>
      <section class="backup-card">
        <div class="backup-last">
          <span>Ultimo backup</span>
          <strong>${last?esc(last.fileName):'Mai eseguito'}</strong>
          ${last?`<small>${new Date(last.date).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}</small>`:''}
        </div>
        <button class="primary" id="export-backup">Esporta backup</button>
        <button class="secondary" id="import-backup">Importa backup</button>
      </section>`);

    document.getElementById('export-backup').onclick=async()=>{
      try{
        await exportFullBackup();
        modal.close();
        showToast('Backup esportato');
        render();
      }catch(error){alert(error.message)}
    };

    document.getElementById('import-backup').onclick=()=>{
      openModal(`<div class="modal-head"><h2>Importa backup</h2><button class="close" data-close>×</button></div>
        <div class="warning-box">
          <strong>Attenzione</strong>
          <p>L’importazione sostituirà tutti i dati presenti nel gestionale.</p>
          <p>Prima di continuare è consigliato esportare un backup dell’attuale situazione.</p>
        </div>
        <div class="actions import-actions">
          <button class="secondary" id="backup-before-import">Esporta backup</button>
          <button class="secondary" data-close>Annulla</button>
          <button class="danger" id="continue-import">Continua</button>
        </div>`);

      document.getElementById('backup-before-import').onclick=async()=>{
        try{
          await exportFullBackup();
          showToast('Backup esportato');
        }catch(error){alert(error.message)}
      };
      document.getElementById('continue-import').onclick=()=>{
        modal.close();
        openBackupImportPicker();
      };
    };
    return;
  }

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
    const systemInfo=`${APP_NAME}
Versione: ${APP_VERSION}
Release: ${APP_RELEASE}
Database: Schema ${DATABASE_SCHEMA}
Sale: ${state.data.rooms.length}
Computer: ${activeComputers}
Hardware: ${activeHardware}
Licenze Avid: ${activeAvid}
Plugin: ${activePlugins}`;

    openModal(`<div class="modal-head"><h2>Informazioni</h2><button class="close" data-close>×</button></div>
      <section class="about-card about-v44">
        <img src="./assets/logo-dvs.png" alt="Digital Video Service">
        <h3>${APP_NAME}</h3>
        <p>Workspace operativo di Digital Video Service</p>

        <dl>
          <div><dt>Versione</dt><dd>${APP_VERSION}</dd></div>
          <div><dt>Release</dt><dd>${APP_RELEASE}</dd></div>
          <div><dt>Database</dt><dd>Supabase · Schema ${DATABASE_SCHEMA}</dd></div>
        </dl>

        <div class="about-section">
          <h4>Novità di questa versione</h4>
          <ul class="changelog-list">
            <li>Generatore Etichetta Sala</li>
            <li>Anteprima PDF in tempo reale</li>
            <li>Esportazione PDF in formato A4 orizzontale</li>
            <li>Ottimizzazioni generali</li>
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
async function handleSession(session){
  state.session=session;

  if(!session){
    stopRealtime();
    shell.classList.add('hidden');
    login.classList.remove('hidden');
    return;
  }

  login.classList.add('hidden');
  shell.classList.remove('hidden');
  greeting.textContent=`Digital Video Service · ${session.user.email}`;

  try{
    await refresh();
    startRealtime();
  }catch(e){
    stopRealtime();
    app.innerHTML=`<div class="empty"><strong>Database non ancora configurato.</strong><br><br>Esegui il file <code>sql/setup.sql</code> nel SQL Editor di Supabase e ricarica.<br><br>${esc(e.message)}</div>`;
  }
}
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
modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});window.addEventListener('beforeunload',stopRealtime);if('serviceWorker'in navigator)ensureServiceWorkerRegistration().catch(error=>console.error('[DVS] Service Worker:',error));boot();

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('print-preview-open'))closePrintPreview();
});
document.addEventListener('click',event=>{
  if(event.target?.id==='print-root')closePrintPreview();
});

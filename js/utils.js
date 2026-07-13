export const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const fmtDate=v=>{if(!v)return '—';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('it-IT').format(d)};
export const numSort=(a,b)=>(Number(String(a.code||a.name||'').match(/\d+/)?.[0]||9999)-Number(String(b.code||b.name||'').match(/\d+/)?.[0]||9999));
export const licenseStatus=l=>{
  if(!l?.expiry_date)return {level:'ok',text:'Attiva'};
  const today=new Date();today.setHours(0,0,0,0);
  const exp=new Date(l.expiry_date+'T00:00:00');
  const days=Math.ceil((exp-today)/86400000);
  if(days<0)return {level:'expired',text:`Scaduta da ${Math.abs(days)} ${Math.abs(days)===1?'giorno':'giorni'}`};
  if(days===0)return {level:'expired',text:'Scade oggi'};
  const text=`Attiva • Scade tra ${days} ${days===1?'giorno':'giorni'}`;
  return {level:days<=10?'warning':'ok',text};
};
export const cycleLabel=v=>v==='monthly'?'MENSILE':'ANNUALE';
export const todayISO=()=>new Date().toISOString().slice(0,10);

export const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const fmtDate=v=>{if(!v)return '—';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('it-IT').format(d)};
export const numSort=(a,b)=>(Number(String(a.code||a.name||'').match(/\d+/)?.[0]||9999)-Number(String(b.code||b.name||'').match(/\d+/)?.[0]||9999));
// Calendar-day arithmetic: independent of daylight-saving time.
const dayNumber=value=>{
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');
  if(!match)return NaN;
  const date=new Date(Date.UTC(+match[1],+match[2]-1,+match[3]));
  return date.toISOString().slice(0,10)===value?date.getTime()/86400000:NaN;
};
export const renewalToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const autoRenews=l=>['avid','plugin'].includes(l?.category)&&!l.is_trial&&!l.archived_at&&!l.deactivation_requested&&['annual','monthly'].includes(l.billing_cycle);
export const effectiveExpiry=(l,today=renewalToday())=>{
  const expiry=dayNumber(l?.expiry_date),now=dayNumber(today);
  if(!autoRenews(l)||!Number.isFinite(expiry)||!Number.isFinite(now)||expiry>=now)return l?.expiry_date||null;
  // Keep "Si rinnova oggi" throughout the due date; catch up in 30-day steps.
  return new Date((expiry+Math.ceil((now-expiry)/30)*30)*86400000).toISOString().slice(0,10);
};
export const licenseStatus=(l,today=renewalToday())=>{
  const date=effectiveExpiry(l,today),days=dayNumber(date)-dayNumber(today);
  if(!Number.isFinite(days))return {level:'ok',text:'Attiva',days:null,date};
  const renewal=autoRenews(l);
  if(renewal){
    const text=days===0?'Si rinnova oggi':days===1?'Si rinnova domani':`Si rinnova tra ${days} giorni`;
    return {level:days<=10?'warning':'ok',text,days,date};
  }
  if(days<0)return {level:'expired',text:`Scaduta da ${Math.abs(days)} ${Math.abs(days)===1?'giorno':'giorni'}`,days,date};
  if(days===0)return {level:'expired',text:'Scade oggi',days,date};
  return {level:days<=10?'warning':'ok',text:`Attiva • Scade tra ${days} ${days===1?'giorno':'giorni'}`,days,date};
};
export const cycleLabel=v=>v==='monthly'?'MENSILE':'ANNUALE';
export const todayISO=()=>new Date().toISOString().slice(0,10);

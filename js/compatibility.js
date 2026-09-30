import { supabase } from './supabase.js';
import { esc } from './utils.js';
export const COMPATIBILITY_OS=['Monterey','Ventura','Sonoma','Sequoia','Tahoe'];
export const COMPATIBILITY_SOFTWARE=[['avid','Avid Media Composer'],['blackmagic','Blackmagic'],['server','Server'],['adobe','Adobe'],['davinci','Da Vinci'],['office','Office']];
const drafts=new Map();
export const isCompatibilityEditing=()=>drafts.size>0;
export function clearCompatibilityDrafts(){drafts.clear()}
export function compatibilityHTML(data){
  if(data.compatibility_error)return '<div class="empty"><strong>Compatibilità non disponibile</strong><p>Esegui la migrazione sql/migrate_v25_compatibility.sql in Supabase, poi ricarica.</p><small>'+esc(data.compatibility_error)+'</small></div>';
  const records=data.compatibility_entries||[];
  return `<div class="compatibility-grid">${COMPATIBILITY_OS.map(os=>`<section class="compatibility-card glass"><h2 class="badge os os-${os.toLowerCase()}">${os}</h2>${COMPATIBILITY_SOFTWARE.map(([key,label])=>{
    const id=os.toLowerCase()+':'+key;const row=records.find(r=>r.id===id);const draft=drafts.get(id);
    return `<section class="compatibility-software" data-compat-id="${id}"><header><h3>${label}</h3><button type="button" class="compat-edit" aria-label="Modifica ${label} per ${os}" title="Modifica" ${draft?'hidden':''}>✎</button></header><div class="compat-value" ${draft?'hidden':''}>${row?.notes?esc(row.notes):'<span class="subtle">Da compilare</span>'}</div><div class="compat-editor" ${draft?'':'hidden'}><textarea rows="3" maxlength="10000" aria-label="${label} per ${os}">${esc(draft?.text||'')}</textarea><div class="compat-actions"><button class="compat-cancel" type="button">Annulla</button><button class="compat-save" type="button">OK</button></div><p class="compat-error" role="alert"></p></div></section>`;
  }).join('')}</section>`).join('')}</div>`;
}
export function bindCompatibility(root,getData,onChange){
  root.querySelectorAll('[data-compat-id]').forEach(section=>{
    const id=section.dataset.compatId,edit=section.querySelector('.compat-edit'),value=section.querySelector('.compat-value'),editor=section.querySelector('.compat-editor'),input=section.querySelector('textarea'),save=section.querySelector('.compat-save'),cancel=section.querySelector('.compat-cancel'),error=section.querySelector('.compat-error');
    edit.onclick=()=>{
      const row=(getData().compatibility_entries||[]).find(r=>r.id===id);
      if(!row){error.textContent='Voce non disponibile. Ricarica dopo aver eseguito la migrazione.';editor.hidden=false;save.disabled=true;return;}
      drafts.set(id,{text:row.notes||'',updated_at:row.updated_at});input.value=row.notes||'';edit.hidden=true;value.hidden=true;editor.hidden=false;input.focus();
    };
    input.oninput=()=>{const draft=drafts.get(id);if(draft)draft.text=input.value};
    cancel.onclick=()=>{drafts.delete(id);onChange()};
    save.onclick=async()=>{
      const draft=drafts.get(id);if(!draft)return;
      save.disabled=true;cancel.disabled=true;input.disabled=true;error.textContent='';
      try{
        const {data,error:err}=await supabase.from('compatibility_entries').update({notes:input.value}).eq('id',id).eq('updated_at',draft.updated_at).select().maybeSingle();
        if(err)throw err;
        if(!data)throw new Error('Questa voce è stata modificata da un altro dispositivo. Copia il tuo testo, premi Annulla e riapri la modifica dopo aver ricaricato.');
        const rows=getData().compatibility_entries;const i=rows.findIndex(r=>r.id===id);if(i>=0)rows[i]=data;
        drafts.delete(id);onChange();
      }catch(err){error.textContent=err.message||'Salvataggio non riuscito. Riprova.'}
      finally{save.disabled=false;cancel.disabled=false;input.disabled=false}
    };
  });
}

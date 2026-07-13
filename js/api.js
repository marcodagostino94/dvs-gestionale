import { supabase } from './supabase.js';
const tables=['rooms','stations','computers','hardware','licenses','station_plugins','audit_log'];
export async function loadAll(){const out={};for(const t of tables){let q=supabase.from(t).select('*');if(t==='rooms'||t==='stations')q=q.order('position');else if(['computers','hardware','licenses'].includes(t))q=q.order('code');else q=q.order('created_at',{ascending:false});const {data,error}=await q;if(error)throw error;out[t]=data||[]}return out}
export async function saveRow(table,row){const payload={...row};delete payload._new;const {data,error}=await supabase.from(table).upsert(payload).select().single();if(error)throw error;return data}
export async function removeRow(table,id){const {error}=await supabase.from(table).delete().eq('id',id);if(error)throw error}
export async function archiveRow(table,id){const {error}=await supabase.from(table).update({archived_at:new Date().toISOString()}).eq('id',id);if(error)throw error}
export async function assignResource(kind,resourceId,stationId){const {data,error}=await supabase.rpc('assign_resource',{p_kind:kind,p_resource_id:resourceId||null,p_station_id:stationId||null});if(error)throw error;return data}
export async function assignPlugin(licenseId,stationId){const {data,error}=await supabase.rpc('assign_plugin',{p_license_id:licenseId,p_station_id:stationId||null});if(error)throw error;return data}
export async function addAudit(action,entityType,entityId,details={}){await supabase.from('audit_log').insert({action,entity_type:entityType,entity_id:entityId,details})}

import { supabase } from './supabase.js';
const tables=['rooms','stations','computers','hardware','licenses','station_plugins','reminders','audit_log'];
export async function loadAll(){const out={};for(const t of tables){let q=supabase.from(t).select('*');if(t==='rooms'||t==='stations')q=q.order('position');else if(['computers','hardware','licenses'].includes(t))q=q.order('code');else q=q.order('created_at',{ascending:false});const {data,error}=await q;if(error)throw error;out[t]=data||[]}return out}
export async function saveRow(table,row){const payload={...row};delete payload._new;const {data,error}=await supabase.from(table).upsert(payload).select().single();if(error)throw error;return data}
export async function removeRow(table,id){const {error}=await supabase.from(table).delete().eq('id',id);if(error)throw error}
export async function archiveRow(table,id){const {error}=await supabase.from(table).update({archived_at:new Date().toISOString()}).eq('id',id);if(error)throw error}
export async function assignResource(kind,resourceId,stationId){const {data,error}=await supabase.rpc('assign_resource',{p_kind:kind,p_resource_id:resourceId||null,p_station_id:stationId||null});if(error)throw error;return data}
export async function assignPlugin(licenseId,stationId){const {data,error}=await supabase.rpc('assign_plugin',{p_license_id:licenseId,p_station_id:stationId||null});if(error)throw error;return data}
export async function addAudit(action,entityType,entityId,details={}){await supabase.from('audit_log').insert({action,entity_type:entityType,entity_id:entityId,details})}

const ATTACHMENT_BUCKET='dvs-asset-attachments';
export async function listAssetAttachments(assetType,assetId){
  const {data,error}=await supabase.from('asset_attachments').select('*').eq('asset_type',assetType).eq('asset_id',assetId).order('created_at',{ascending:false});
  if(error)throw error;
  return data||[];
}
export async function uploadAssetAttachment(assetType,assetId,file){
  const safeName=(file.name||'allegato').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'allegato';
  const storagePath=`${assetType}/${assetId}/${crypto.randomUUID()}-${safeName}`;
  const {error:uploadError}=await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath,file,{contentType:file.type||'application/octet-stream',upsert:false});
  if(uploadError)throw uploadError;
  const {data,error}=await supabase.from('asset_attachments').insert({asset_type:assetType,asset_id:assetId,storage_path:storagePath,file_name:file.name||safeName,mime_type:file.type||null,size_bytes:file.size||0}).select().single();
  if(error){await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);throw error;}
  return data;
}
export async function openAssetAttachment(attachment){
  const {data,error}=await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(attachment.storage_path,60);
  if(error)throw error;
  return data.signedUrl;
}
export async function downloadAssetAttachment(attachment){
  const {data,error}=await supabase.storage.from(ATTACHMENT_BUCKET).download(attachment.storage_path);
  if(error)throw error;
  return data;
}
export async function deleteAssetAttachment(attachment){
  const {error:storageError}=await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storage_path]);
  if(storageError)throw storageError;
  const {error}=await supabase.from('asset_attachments').delete().eq('id',attachment.id);
  if(error)throw error;
}

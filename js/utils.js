export const DAY = 86400000;

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);
}

export function numberFromId(id) {
  const match = String(id).match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function sortByNumericId(items) {
  return [...items].sort((a,b) => numberFromId(a.id) - numberFromId(b.id) || String(a.id).localeCompare(String(b.id)));
}

export function isoToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return toISO(d);
}

export function parseISO(value) {
  if (!value) return null;
  const [y,m,d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y,m-1,d);
}

export function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function displayDate(value) {
  if (!value) return "—";
  const [y,m,d] = value.split("-");
  return `${d}-${m}-${y}`;
}

export function addCycle(value, cycle) {
  const date = parseISO(value) || parseISO(isoToday());
  const originalDay = date.getDate();
  if (cycle === "monthly") {
    date.setDate(1);
    date.setMonth(date.getMonth()+1);
    const last = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();
    date.setDate(Math.min(originalDay,last));
  } else {
    date.setFullYear(date.getFullYear()+1);
  }
  return toISO(date);
}

export function daysSince(value) {
  const date = parseISO(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((parseISO(isoToday()) - date) / DAY));
}

export function licenseStatus(license) {
  if (!license || !license.expiry) return {level:"none",label:"Nessuna scadenza",days:null};
  const today = parseISO(isoToday());
  const expiry = parseISO(license.expiry);
  const days = Math.ceil((expiry - today) / DAY);

  if (license.deactivationRequested && days < 0) {
    return {level:"expired",label:`Scaduta da ${daysSince(license.expiry)} giorni`,days};
  }
  if (days >= 0 && days <= 5) {
    return {level:"warning",label:days === 0 ? "Scade oggi" : `Scade tra ${days} giorni`,days};
  }
  return {level:"ok",label:"Attiva",days};
}

export function renewLicenses(data) {
  let changed = false;
  const today = parseISO(isoToday());
  data.licenses.forEach(license => {
    if (license.activation && !license.expiry) {
      license.expiry = addCycle(license.activation, license.billingCycle);
      changed = true;
    }
    if (license.expiry && !license.deactivationRequested) {
      let expiry = parseISO(license.expiry);
      while (expiry && expiry < today) {
        license.expiry = addCycle(license.expiry, license.billingCycle);
        expiry = parseISO(license.expiry);
        changed = true;
      }
    }
  });
  return changed;
}

export function pluginStatus(plugin) {
  if (!plugin || !plugin.expiry) return {level:"none",label:"Nessuna scadenza",days:null};
  const today = parseISO(isoToday());
  const expiry = parseISO(plugin.expiry);
  const days = Math.ceil((expiry - today) / DAY);

  if (plugin.deactivationRequested && days < 0) {
    return {level:"expired",label:`Scaduto da ${daysSince(plugin.expiry)} giorni`,days};
  }
  if (days >= 0 && days <= 5) {
    return {level:"warning",label:days === 0 ? "Scade oggi" : `Scade tra ${days} giorni`,days};
  }
  return {level:"ok",label:"Attivo",days};
}



export function softwareStatus(item) { return licenseStatus(item); }
export function renewAllSoftware(data) {
  let changed=false;
  const today=parseISO(isoToday());
  data.licenses.forEach(item=>{
    if(item.activation&&!item.expiry){item.expiry=addCycle(item.activation,item.billingCycle);changed=true;}
    if(item.expiry&&!item.deactivationRequested){
      let expiry=parseISO(item.expiry);
      while(expiry&&expiry<today){item.expiry=addCycle(item.expiry,item.billingCycle);expiry=parseISO(item.expiry);changed=true;}
    }
  });
  return changed;
}

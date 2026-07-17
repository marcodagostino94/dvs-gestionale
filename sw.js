const CACHE='dvs-v-9-finale';const ASSETS=[
  './assets/apple-touch-icon.png',
  './assets/workspace-icon-512.png',
  './assets/workspace-icon-192.png',
  './manifest.webmanifest',
  './manifest.json','./','./index.html','./css/app.css?v=9.finale','./js/app.js?v=9.finale','./js/api.js','./js/config.js','./js/supabase.js','./js/utils.js','./assets/logo-dvs.png','./manifest.webmanifest'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});


self.addEventListener('push',event=>{
  let payload={title:'DVS Workspace',body:'È disponibile un nuovo avviso.',url:'./'};
  try{
    if(event.data)payload={...payload,...event.data.json()};
  }catch{
    if(event.data)payload.body=event.data.text();
  }
  event.waitUntil(self.registration.showNotification(payload.title,{
    body:payload.body,
    icon:'./assets/logo-dvs.png',
    badge:'./assets/logo-dvs.png',
    tag:payload.tag||'dvs-expiry',
    data:{url:payload.url||'./',licenseId:payload.licenseId||null},
    renotify:true
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    for(const client of windows){
      if(client.url.startsWith(self.location.origin)&&'focus'in client){
        client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});

const CACHE='dvs-workspace-v12-1';
const ASSETS=[
  './',
  './index.html',
  './css/app.css?v=12-1',
  './js/app.js?v=12-1',
  './js/pdf-lib.min.js?v=12-0',
  './js/api.js',
  './js/config.js',
  './js/supabase.js',
  './js/utils.js',
  './assets/logo-dvs.png',
  './assets/etichetta-sala-background.png',
  './assets/etichetta-sala-logo.png',
  './assets/apple-touch-icon.png',
  './assets/workspace-icon-192.png',
  './assets/workspace-icon-512.png',
  './manifest.webmanifest?v=12-1',
  './manifest.json'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(ASSETS.map(async asset=>{
      try{
        const response=await fetch(asset,{cache:'reload'});
        if(!response.ok)throw new Error(`${response.status} ${asset}`);
        await cache.put(asset,response);
      }catch(error){
        console.warn('[DVS SW] Risorsa non precaricata:',asset,error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        cache.put(event.request,response.clone()).catch(()=>{});
      }
      return response;
    }catch(error){
      return (await caches.match(event.request))||(event.request.mode==='navigate'?await caches.match('./index.html'):Response.error());
    }
  })());
});

self.addEventListener('push',event=>{
  let payload={title:'DVS Workspace',body:'È disponibile un nuovo avviso.',url:'./'};
  try{
    if(event.data)payload={...payload,...event.data.json()};
  }catch{
    if(event.data)payload.body=event.data.text();
  }
  event.waitUntil(self.registration.showNotification(payload.title,{
    body:payload.body,
    icon:'./assets/workspace-icon-192.png',
    badge:'./assets/workspace-icon-192.png',
    tag:payload.tag||'dvs-expiry',
    data:{url:payload.url||'./',licenseId:payload.licenseId||null},
    renotify:true
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    for(const client of windows){
      if(client.url.startsWith(self.registration.scope)&&'focus'in client){
        client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});

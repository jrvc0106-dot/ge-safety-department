const CACHE='ge-safety-v3';
const SHELL=['/','/index.html','/manifest.webmanifest','/ge-logo.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  // Vite asset names include a content hash. The same URL is immutable.
  if(/^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const cached=await cache.match(event.request);
      if(cached)return cached;
      const response=await fetch(event.request);
      if(response.ok)await cache.put(event.request,response.clone());
      return response;
    }));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        }
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(event.request);
        if(cached)return cached;
        if(event.request.mode==='navigate')return caches.match('/index.html');
        return Response.error();
      })
  );
});
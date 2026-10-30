// GE ONE: cache only public application resources, never reports or user data.
const CACHE='ge-safety-v5';
const SHELL=['/','/index.html','/manifest.webmanifest','/ge-logo.png'];
const STATIC_ASSET=/^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/;
const PUBLIC_FILES=new Set(['/manifest.webmanifest','/ge-logo.png']);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ge-safety-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||request.headers.has('authorization'))return;
  if(STATIC_ASSET.test(url.pathname)){
    // Vite hashed assets are immutable: cache-first avoids repeat downloads.
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const cached=await cache.match(request);
      if(cached)return cached;
      const response=await fetch(request);
      if(response.ok)event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
      return response;
    }));
    return;
  }
  if(PUBLIC_FILES.has(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const cached=await cache.match(request);
      if(cached)return cached;
      const response=await fetch(request);
      if(response.ok)event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
      return response;
    }));
    return;
  }
  if(request.mode==='navigate'){
    // Online-first HTML prevents stale references after deployments.
    event.respondWith(fetch(request).catch(async()=>await caches.match('/index.html')||Response.error()));
  }
  // All other requests pass through without caching: PDFs, API, photos and private data.
});

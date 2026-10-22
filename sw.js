/* Versioned app shell. A failed network response must never poison the cache. */
const SHELL='fitlab-shell-v13-2-2';
const IMG='fitlab-img-v2';
const SHELL_FILES=['./','./index.html','./styles.css?v=13.2.2','./app.js?v=13.2.2','./companion.js?v=13.2.2','./assets/session-push-v13.png','./assets/session-pull-v13.png','./assets/session-legs-v13.png','./assets/session-upper-v13.png','./assets/session-lower-v13.png','./assets/session-recovery-v13.png','./assets/session-rest-v13.png','./manifest.webmanifest','./app-icon-192-v4.png','./app-icon-512-v4.png','./apple-touch-icon-v4.png','./favicon-32-v4.png'];
const scope=new URL('./',self.location.href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(SHELL_FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('fitlab-shell-')||key.startsWith('fitlab-img-'))&&key!==SHELL&&key!==IMG).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.startsWith('/gh/yuhonas/free-exercise-db')){
    event.respondWith((async()=>{const cache=await caches.open(IMG),hit=await cache.match(request);if(hit)return hit;try{const response=await fetch(request);if(response.ok||response.type==='opaque'){await cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>100)await cache.delete(keys[0]);}return response;}catch{return Response.error();}})());return;
  }
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  // Keep HTML and its versioned scripts together until the next complete shell activates.
  if(request.mode==='navigate'){
    if(url.pathname!==scope.pathname&&url.pathname!==new URL('index.html',scope).pathname)return;
    event.respondWith((async()=>{const cache=await caches.open(SHELL),hit=await cache.match('./index.html');if(hit)return hit;try{return await fetch(request);}catch{return Response.error();}})());return;
  }
  const known=SHELL_FILES.some(path=>new URL(path,scope).href===url.href);
  if(!known)return;
  event.respondWith((async()=>{const cache=await caches.open(SHELL),hit=await cache.match(request);if(hit)return hit;try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}catch{return Response.error();}})());
});

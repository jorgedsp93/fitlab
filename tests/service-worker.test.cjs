const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8');
function worker(fetcher){
  const handlers={},deleted=[],put=[],store=new Map([['./index.html',new Response('offline shell')]]);
  const cache={addAll:async()=>{},match:async key=>store.get(key),put:async(k,v)=>{put.push(k);store.set(k,v);},keys:async()=>[],delete:async()=>{}};
  const context={URL,Response,fetch:fetcher,self:{location:{href:'https://example.test/fitlab/sw.js'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(n,h)=>handlers[n]=h},caches:{open:async()=>cache,keys:async()=>['unrelated-app','fitlab-shell-v11','fitlab-shell-v12-1','fitlab-img-v1'],delete:async key=>deleted.push(key)}};
  vm.runInNewContext(source,context);
  return {handlers,deleted,put,store,request:async(url,mode)=>{let result;handlers.fetch({request:{url,mode,method:'GET'},respondWith:p=>result=p});return result?await result:undefined;}};
}
test('activation only removes FitLab-owned obsolete caches',async()=>{const w=worker();let done;w.handlers.activate({waitUntil:p=>done=p});await done;assert.deepEqual(w.deleted,['fitlab-shell-v11','fitlab-img-v1']);});
test('offline navigation uses app shell, while missing assets never receive HTML',async()=>{const w=worker(async()=>{throw new Error('offline');});const res=await w.request('https://example.test/fitlab/','navigate');assert.equal(await res.text(),'offline shell');const css=await w.request('https://example.test/fitlab/styles.css?v=12.1','cors');assert.equal(css.type,'error');});
test('server errors do not replace cached HTML and unrelated apps are not intercepted',async()=>{const w=worker(async()=>new Response('unavailable',{status:503}));assert.equal(await (await w.request('https://example.test/fitlab/','navigate')).text(),'offline shell');assert.equal(w.put.length,0);assert.equal(await w.request('https://example.test/another-app/','navigate'),undefined);});

test('non-app pages cannot overwrite the offline app shell',async()=>{const w=worker(async()=>new Response('responsive review page'));assert.equal(await w.request('https://example.test/fitlab/tests/viewports.html','navigate'),undefined);assert.equal(w.put.length,0);assert.equal(await (await w.request('https://example.test/fitlab/index.html','navigate')).text(),'responsive review page');assert.equal(w.put.length,1);});

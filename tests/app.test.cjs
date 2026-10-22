const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
process.env.TZ='America/Toronto';
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const bench='Barbell_Bench_Press_-_Medium_Grip';
function app(state){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(html,{url:'https://fitlab.test/fitlab/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;w.TextEncoder=TextEncoder;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.alert=()=>{};
  if(state!==undefined)w.localStorage.setItem('fitlab_v1',typeof state==='string'?state:JSON.stringify(state));
  const context=dom.getInternalVMContext();vm.runInContext(source,context);
  return {w,doc:w.document,errors,run:s=>vm.runInContext(s,context),close:()=>w.close(),click:s=>{const e=w.document.querySelector(s);assert.ok(e,`Missing control ${s}`);e.click();},input:(s,value)=>{const e=w.document.querySelector(s);assert.ok(e,`Missing input ${s}`);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));}};
}
function withApp(state,fn){const a=app(state);try{return fn(a);}finally{a.close();}}
test('first checked set, next block, back, and reload retain the session without crashing',()=>{
  let saved;
  withApp(undefined,a=>{a.click('[data-open-day]');a.input('[data-field="w"]','95');a.click('[data-ck]');assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'true');assert.match(a.doc.querySelector('.progress-meta').textContent,/1 of 19/);a.click('[data-flow-step="1"]');a.click('[data-flow-step="-1"]');assert.equal(a.doc.querySelector('[data-field="w"]').value,'95');assert.equal(a.errors.length,0);saved=a.w.localStorage.getItem('fitlab_v1');});
  withApp(saved,a=>{a.click('[data-open-day]');assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'true');assert.equal(a.errors.length,0);});
});
test('all 84 program days and every workout block render before and after a completed set',()=>withApp(undefined,a=>{
  a.run(`for(let w=1;w<=12;w++)for(let d=0;d<7;d++){viewingPos={week:w,dayIndex:d};view='day';render();const p=planFor(w,d);for(let b=0;b<workoutBlocks(p,dayKey(w,d)).length;b++){setFlowIndex(p,b);render();const ex=workoutBlocks(p,dayKey(w,d))[b].ex[0];const s=S.logs[dayKey(w,d)][ex.id][0];s.w='25';s.r='10';s.done=true;render();}}`);
  assert.equal(a.errors.length,0);
}));
test('local dates do not switch to tomorrow at midnight UTC; schedule ignores DST length',()=>withApp(undefined,a=>{
  const result=a.run(`(()=>{const Original=Date;Date=class extends Original{constructor(...args){super(...(args.length?args:['2026-10-22T00:30:00Z']));}};const today=todayISO();Date=Original;S.startDate='2026-03-07';return {today,delta:calendarDay('2026-03-09')-calendarDay(S.startDate),fall:calendarDay('2026-11-02')-calendarDay('2026-10-31')};})()`);
  assert.equal(result.today,'2026-10-21');assert.equal(result.delta,2);assert.equal(result.fall,2);
  for(const date of ['bad','2026-99-31','2026-02-30'])assert.equal(a.run(`validDate(${JSON.stringify(date)})`),false);
}));
test('unit changes convert all logged loads and bodyweight without changing their physical meaning',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'100',r:'8',done:true},{w:'0',r:'8',done:true}]};S.lastW['${bench}']='100';S.bw=[{d:todayISO(),v:200}];changeUnit('kg');`);
  assert.ok(Math.abs(a.run(`Number(S.logs.w1d0['${bench}'][0].w)`)-45.359)<.001);assert.ok(Math.abs(a.run('lastBW()')-90.718)<.001);assert.equal(a.run(`S.logs.w1d0['${bench}'][1].w`),'0');
  a.run(`changeUnit('lb')`);assert.ok(Math.abs(a.run('lastBW()')-200)<.005);
}));
test('invalid set entries cannot be checked, and edits to completed entries require rechecking',()=>withApp(undefined,a=>{
  a.click('[data-open-day]');a.click('[data-ck]');assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'false');
  a.input('[data-field="w"]','95');a.input('[data-field="r"]','2.5');a.click('[data-ck]');assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'false');
  a.input('[data-field="r"]','8');a.click('[data-ck]');a.input('[data-field="w"]','100');assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'false');assert.equal(a.run(`S.logs.w1d0['${bench}'][0].done`),false);
}));
test('supersets only start rest after both moves are checked',()=>withApp(undefined,a=>{
  a.run('openDay(1,0,3)');a.input('[data-field="w"]','25');a.click('[data-ck]');assert.equal(a.run('!!S.restTimer'),false);
  a.input('.exblock:nth-of-type(2) [data-field="w"]','25');a.click('.exblock:nth-of-type(2) [data-ck]');assert.equal(a.run('!!S.restTimer'),true);
}));
test('rest timer uses elapsed wall time after backgrounding and persists on reload',()=>{
  let saved;
  withApp(undefined,a=>{a.run("startRest(120,'Rest')");saved=a.w.localStorage.getItem('fitlab_v1');a.run('S.restTimer.endsAt=Date.now()-1000;tickRest()');assert.equal(a.run('!!S.restTimer'),false);assert.equal(a.doc.querySelector('#restbar').classList.contains('show'),false);});
  withApp(saved,a=>assert.ok(a.run('restSecondsLeft()')>100));
});
test('swapping cannot reuse a second exercise slot or hide already completed sets',()=>withApp(undefined,a=>{
  assert.equal(a.run(`setExerciseSwap('w1d0','${bench}','Incline_Dumbbell_Press')`),false);
  assert.equal(a.run(`setExerciseSwap('w1d0','${bench}','Dumbbell_Bench_Press')`),true);
  a.run(`openDay(1,0);S.logs.w1d0.Dumbbell_Bench_Press[0]={w:'30',r:'8',done:true}`);
  assert.equal(a.run(`setExerciseSwap('w1d0','${bench}',null)`),false);
  assert.equal(a.run('workoutExportDetail(1,0).summary.doneSets'),1);
}));
test('legacy completed sets from a replaced exercise remain in exports',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'95',r:'8',done:true}],Dumbbell_Bench_Press:[{w:'30',r:'8',done:true}]};S.swaps.w1d0={'${bench}':'Dumbbell_Bench_Press'};`);
  assert.equal(a.run('workoutExportDetail(1,0).summary.doneSets'),2);
}));
test('bodyweight corrections replace same-date entries and backdated entries do not become latest',()=>withApp(undefined,a=>{
  a.run(`upsertMeasurement('bw','2026-10-20',200);upsertMeasurement('bw','2026-10-21',199);upsertMeasurement('bw','2026-10-20',198);`);
  assert.equal(a.run('S.bw.length'),2);assert.equal(a.run('lastBW()'),199);
}));
test('partial prior workouts never trigger automatic load increases',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'100',r:'8',done:true}]}`);
  assert.equal(a.run(`suggest('${bench}',planFor(2,0).ex[0],'w2d0').weight`),100);
}));
test('backup round trip preserves data; workout exports are rejected as restore files',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'95',r:'8',done:true}]};S.daily[todayISO()]={steps:true};`);
  assert.equal(a.run(`JSON.stringify(validateBackup(JSON.stringify(backupPayload())))===JSON.stringify(S)`),true);
  assert.throws(()=>a.run(`validateBackup(JSON.stringify({source:'FitLab',workouts:[]}))`),/not a complete FitLab backup/);
}));
test('malformed storage is retained rather than overwritten and shared default objects are avoided',()=>{
  withApp('{bad',a=>{a.run('save()');assert.equal(a.w.localStorage.getItem('fitlab_v1'),'{bad');assert.equal(a.doc.querySelector('#storageWarning').hidden,false);});
  withApp({startDate:'2026-10-21',unit:'lb',logs:null,bw:null,bf:'bad',daily:[]},a=>{assert.equal(a.doc.querySelectorAll('h1').length,1);assert.equal(a.run('Array.isArray(S.bw)'),true);a.run('const fresh=newState();fresh.logs.test=1');assert.equal(a.run('newState().logs.test'),undefined);});
});
test('storage write failure gives visible feedback',()=>withApp(undefined,a=>{
  a.w.Storage.prototype.setItem=function(){throw new Error('QuotaExceededError');};assert.equal(a.run('save()'),false);assert.equal(a.doc.querySelector('#storageWarning').hidden,false);
}));
test('changing a schedule date is explicit and cancelable, not a date-input side effect',()=>withApp(undefined,a=>{
  a.run(`go('more')`);const previous=a.run('S.startDate');const input=a.doc.querySelector('#startIn');input.value='2026-01-01';input.dispatchEvent(new a.w.Event('change',{bubbles:true}));assert.equal(a.run('S.startDate'),previous);
  a.run(`S.logs.w1d0={'${bench}':[{w:'95',r:'8',done:true}]}`);a.w.confirm=()=>false;a.click('[data-save-start]');assert.equal(a.run('S.startDate'),previous);
}));
test('all views render; library search, focus trapping and dark mode work',()=>withApp(undefined,a=>{
  for(const view of ['today','plan','stats','more','guide','library']){a.run(`go('${view}')`);assert.ok(a.doc.querySelector('h1'));}
  a.input('#exerciseSearch','not-an-exercise');assert.match(a.doc.querySelector('#libraryResults').textContent,/No matching/);
  a.input('#exerciseSearch','bench');a.click('.librow');assert.equal(a.doc.querySelector('#sheetWrap').classList.contains('open'),true);assert.equal(a.doc.querySelector('#app').inert,true);a.doc.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(a.doc.querySelector('#app').inert,false);
  a.run(`go('more')`);a.click('[data-theme="dark"]');assert.equal(a.doc.documentElement.dataset.theme,'dark');assert.equal(a.errors.length,0);
}));
test('FIT export passes the official Garmin decoder and all sets fit inside session timing',async()=>{
  const {Decoder,Stream}=await import('@garmin/fitsdk');
  withApp(undefined,a=>{
    a.run(`S.logs.w1d0={'${bench}':[{w:'100',r:'8',done:true},{w:'100',r:'8',done:true},{w:'100',r:'8',done:true}],Incline_Dumbbell_Press:[{w:'35',r:'12',done:true}]}`);
    const bytes=a.run('buildGarminFit(workoutExportDetail(1,0))'),decoder=new Decoder(Stream.fromByteArray(Array.from(bytes)));
    assert.equal(bytes[1],0x20);assert.equal(decoder.checkIntegrity(),true);const {messages,errors}=decoder.read();assert.deepEqual(errors,[]);assert.equal(messages.setMesgs.length,4);assert.equal(messages.sessionMesgs.length,1);
    const session=messages.sessionMesgs[0];for(const set of messages.setMesgs){assert.ok(set.timestamp<=session.timestamp);assert.ok(set.startTime>=session.startTime);}assert.ok(Math.abs(messages.setMesgs[0].weight-45.36)<.1);
  });
});
test('TCX export contains every completed set and is well-formed XML',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'100',r:'8',done:true}]}`);const xml=a.run('buildGarminTcx(workoutExportDetail(1,0))'),parsed=new a.w.DOMParser().parseFromString(xml,'application/xml');assert.equal(parsed.querySelector('parsererror'),null);assert.equal(parsed.querySelectorAll('Activity').length,1);assert.match(parsed.querySelector('Notes').textContent,/100 lb/);
}));

test('legacy UTC start dates ahead of the local date are corrected without losing sets',()=>withApp(undefined,a=>{
  a.run(`const next=new Date();next.setDate(next.getDate()+1);const migrated=normalizeState({startDate:ymd(next),unit:'lb',logs:{w1d0:{'${bench}':[{w:'95',r:'8',done:true}]}},bw:[],bf:[]});if(migrated.startDate!==todayISO()||!migrated.logs.w1d0['${bench}'][0].done)throw new Error('Migration lost local date or completed set');`);
}));
test('legacy duplicate swaps cannot double-count a completed set',()=>withApp(undefined,a=>{
  a.run(`S=normalizeState({...S,swaps:{w1d1:{'Wide-Grip_Lat_Pulldown':'Pullups'}},logs:{w1d1:{Pullups:[{w:'0',r:'8',done:true}]}}});`);
  assert.equal(a.run('dayProgress(planFor(1,1)).done'),1);
}));

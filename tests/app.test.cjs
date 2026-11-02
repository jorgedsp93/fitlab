const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
process.env.TZ='America/Toronto';
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=['feedback.js','app.js'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
const bench='Barbell_Bench_Press_-_Medium_Grip';
function app(state,productionDefaults=false,setup){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(html,{url:'https://fitlab.test/fitlab/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window;w.TextEncoder=TextEncoder;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.alert=()=>{};
  if(!productionDefaults){if(state===undefined)state={program:'classic12'};else if(state&&typeof state==='object'&&!state.program)state={...state,program:'classic12'};}
  if(state!==undefined)w.localStorage.setItem('fitlab_v1',typeof state==='string'?state:JSON.stringify(state));
  setup?.(w);
  const context=dom.getInternalVMContext();vm.runInContext(source,context);
  return {w,doc:w.document,errors,run:s=>vm.runInContext(s,context),close:()=>w.close(),click:s=>{const e=w.document.querySelector(s);assert.ok(e,`Missing control ${s}`);if(e.click)e.click();else e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));},input:(s,value)=>{const e=w.document.querySelector(s);assert.ok(e,`Missing input ${s}`);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));}};
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


test('a direct tap focuses every workout weight and reps field, and typing keeps that node focused',()=>withApp(undefined,a=>{
  a.click('[data-open-day]');
  for(const field of a.doc.querySelectorAll('[data-number]')){
    a.doc.activeElement.blur();
    field.click();
    assert.equal(a.doc.activeElement,field,`Tap failed to focus ${field.getAttribute('aria-label')}`);
    const value=field.dataset.field==='w'?'135.5':'10';
    field.value='';
    field.dispatchEvent(new a.w.Event('input',{bubbles:true}));
    for(const character of value){
      field.value+=character;
      field.dispatchEvent(new a.w.InputEvent('input',{bubbles:true,data:character,inputType:'insertText'}));
      assert.equal(a.doc.activeElement,field,'Typing replaced or blurred the field');
      assert.equal(field.isConnected,true);
    }
    assert.equal(field.value,value);
  }
  a.click('[data-ck]');
  assert.equal(a.run(`S.logs.w1d0['${bench}'][0].w`),'135.5');
  assert.equal(a.run(`S.logs.w1d0['${bench}'][0].r`),'10');
}));

test('editing a completed set by tap accepts replacement, clearing, decimal drafts and zero',()=>withApp(undefined,a=>{
  a.click('[data-open-day]');a.input('[data-field="w"]','135.5');a.click('[data-ck]');
  const field=a.doc.querySelector('[data-field="w"]');field.click();
  for(const value of ['','2','22','22.','22.5']){a.input('[data-field="w"]',value);assert.equal(a.doc.activeElement,field);assert.equal(field.value,value);}
  assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'false');
  a.input('[data-field="w"]','0');a.click('[data-ck]');assert.equal(a.run(`S.logs.w1d0['${bench}'][0].w`),'0');
  a.run(`openSheet('${bench}');closeSheet({fromPop:true})`);a.click('[data-field="w"]');assert.equal(a.doc.activeElement,a.doc.querySelector('[data-field="w"]'));assert.equal(a.doc.querySelector('#app').inert,false);
}));

test('decimal comma weights survive completion and reload; malformed numeric text cannot be saved',()=>{
  let saved;
  withApp(undefined,a=>{
    a.click('[data-open-day]');
    for(const value of ['hello','1e2','0x20','--1','12..5','12,5,5','5001']){a.input('[data-field="w"]',value);a.click('[data-ck]');assert.equal(a.run(`S.logs.w1d0['${bench}'][0].done`),false,value);}
    a.input('[data-field="w"]','22,5');a.click('[data-ck]');assert.equal(a.run(`S.logs.w1d0['${bench}'][0].w`),'22.5');saved=a.w.localStorage.getItem('fitlab_v1');
  });
  withApp(saved,a=>{a.click('[data-open-day]');assert.equal(a.doc.querySelector('[data-field="w"]').value,'22.5');});
});

test('daily bodyweight, progress bodyweight, and body measurements support tap then type',()=>withApp(undefined,a=>{
  a.doc.querySelector('[data-bw-form]').closest('details').open=true;
  a.click('#dailyBwIn');assert.equal(a.doc.activeElement.id,'dailyBwIn');a.input('#dailyBwIn','200,5');a.click('[data-bw-form] button[type="submit"]');assert.equal(a.run('lastBW()'),200.5);
  a.run(`go('stats')`);a.click('#bwIn');assert.equal(a.doc.activeElement.id,'bwIn');a.input('#bwIn','199.5');a.click('[data-stats-bw-form] button[type="submit"]');assert.equal(a.run('lastBW()'),199.5);
  a.doc.querySelector('[data-bf-form]').closest('details').open=true;
  for(const id of ['waistIn','neckIn']){a.click('#'+id);assert.equal(a.doc.activeElement.id,id);}
  assert.equal(a.run(`upsertMeasurement('bw',todayISO(),'1e2')`),false);
}));


test('ordinary clicks never invoke the root theme attribute or replace active forms',()=>withApp(undefined,a=>{
  const title=a.doc.querySelector('h1'),theme=a.run('S.theme');title.click();assert.equal(title.isConnected,true,'Ordinary click rebuilt the screen');assert.equal(a.run('S.theme'),theme);
  a.run(`go('library')`);const search=a.doc.querySelector('#exerciseSearch');search.click();assert.equal(search.isConnected,true,'Search field was replaced on tap');a.input('#exerciseSearch','bench');assert.match(a.doc.querySelector('#libraryResults').textContent,/Bench/);
  a.run(`go('stats')`);const field=a.doc.querySelector('#bwIn');field.click();a.input('#bwIn','200.5');a.doc.querySelector('h3').click();assert.equal(field.isConnected,true);assert.equal(field.value,'200.5');a.click('[data-stats-bw-form] button[type="submit"]');assert.equal(a.run('lastBW()'),200.5);
}));

test('real summary clicks open and close details across the app without a rerender',()=>withApp(undefined,a=>{
  for(const view of ['today','more','stats','guide']){
    a.run(`go('${view}')`);
    for(const details of a.doc.querySelectorAll('details')){
      const wasOpen=details.open,summary=details.querySelector(':scope > summary');summary.click();assert.equal(details.isConnected,true,`Click replaced ${view} disclosure`);assert.equal(details.open,!wasOpen);summary.click();assert.equal(details.open,wasOpen);
    }
  }
  a.run('openDay(1,0)');const details=a.doc.querySelector('.exextras');details.querySelector('summary').click();assert.equal(details.isConnected,true);assert.equal(details.open,true);
  a.run(`go('more')`);a.click('button[data-theme="dark"]');assert.equal(a.doc.documentElement.dataset.theme,'dark');a.click('button[data-theme="light"]');assert.equal(a.doc.documentElement.dataset.theme,'light');
}));

test('measurement estimation submits through its real button and decimal drafts survive reload',()=>{
  let saved;
  withApp(undefined,a=>{
    a.run(`go('stats')`);a.doc.querySelector('[data-bf-form]').closest('details').querySelector('summary').click();a.input('#waistIn','36');a.input('#neckIn','16');a.click('[data-bf-form] button[type="submit"]');assert.equal(a.run('S.bf.length'),1);assert.match(a.doc.querySelector('#bfOut').textContent,/Saved for today/);
    a.run('openDay(1,0)');a.input('[data-field="w"]','22,5');saved=a.w.localStorage.getItem('fitlab_v1');
  });
  withApp(saved,a=>{a.click('[data-open-day]');assert.equal(a.doc.querySelector('[data-field="w"]').value,'22.5');assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'false');});
});

test('the preserved comeback program keeps four lifting days and its gradual volume',()=>{
  const a=app({program:'comeback8'},true);try{
    assert.equal(a.run('S.program'),'comeback8');assert.match(a.doc.querySelector('.topnote').textContent,/8-week/);
    assert.equal(a.run("programSplit().filter(d=>d.type==='workout').length"),4);
    assert.equal(a.run("programSplit().filter(d=>d.key==='recovery').length"),1);
    assert.equal(a.run("programSplit().filter(d=>d.key==='rest').length"),2);
    assert.equal(a.run('planFor(1,0).ex.reduce((n,e)=>n+e.sets,0)'),10);
    assert.equal(a.run('planFor(3,0).ex.reduce((n,e)=>n+e.sets,0)'),12);
    assert.equal(a.run('planFor(8,0).ex.reduce((n,e)=>n+e.sets,0)'),10);
    a.click('[data-go="plan"]');assert.equal(a.doc.querySelectorAll('#planWeek option').length,8);
    a.run('openDay(9,0)');assert.equal(a.run('view'),'plan');
    a.run('S.startDate=ymd(new Date(Date.now()-56*86400000));view="today";render()');assert.match(a.doc.querySelector('#app').textContent,/8-week schedule has reached its end/);
  }finally{a.close();}
});

test('all 56 comeback days and their workout blocks render, accept typed sets and survive completion',()=>{
  const a=app({program:'comeback8'},true);try{
    a.run(`for(let w=1;w<=8;w++)for(let d=0;d<7;d++){openDay(w,d);const p=planFor(w,d);for(let b=0;b<workoutBlocks(p,dayKey(w,d)).length;b++){setFlowIndex(p,b);render();const e=workoutBlocks(p,dayKey(w,d))[b].ex[0];if(!EXERCISES[e.id])throw new Error('Missing exercise '+e.id);const weight=document.querySelector('[data-field="w"]');weight.click();weight.value=EXERCISES[e.id].equipment==='body only'?'0':'25';weight.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-ck]').click();if(!S.logs[dayKey(w,d)][e.id][0].done)throw new Error('Set did not complete');}}`);
    assert.equal(a.errors.length,0);
  }finally{a.close();}
});

test('legacy upgrade archives the complete old program once and both programs reopen after reload',()=>{
  const legacy={schemaVersion:12,startDate:'2026-10-01',unit:'lb',bw:[{d:'2026-10-01',v:200}],bf:[],logs:{w1d0:{[bench]:[{w:'95',r:'8',done:true}]},w12d4:{Incline_Dumbbell_Press:[{w:'30',r:'10',done:true}]}},swaps:{},rides:{w1d1:true},daily:{'2026-10-01':{protein:true}},restTimer:{endsAt:Date.now()+60000}};
  const a=app(legacy,true);let saved;try{
    assert.equal(a.run('S.program'),'comeback8');assert.equal(a.run('Object.keys(S.logs).length'),0);assert.equal(a.run('S.restTimer'),undefined);
    assert.equal(a.run(`S.archives.classic12.logs.w1d0['${bench}'][0].w`),'95');
    assert.equal(a.run('S.archives.classic12.startDate'),'2026-10-01');assert.equal(a.run('lastBW()'),200);
    assert.deepEqual(JSON.parse(a.w.localStorage.getItem('fitlab_backup_v12')),legacy);
    a.click('[data-open-day]');a.input('[data-field="w"]','25');a.click('[data-ck]');
    a.run("go('more')");a.click('[data-program="classic12"]');assert.equal(a.run('workoutHistory().length'),2);
    assert.equal(a.run("S.daily['2026-10-01'].protein"),true);a.run("go('more')");a.click('[data-program="comeback8"]');
    assert.equal(a.run('S.logs.w1d0.Dumbbell_Bench_Press[0].done'),true);
    saved=a.w.localStorage.getItem('fitlab_v1');
    assert.equal(a.run('JSON.stringify(validateBackup(JSON.stringify(backupPayload())))===JSON.stringify(S)'),true);
  }finally{a.close();}
  const b=app(saved,true);try{assert.equal(b.run('S.program'),'comeback8');assert.equal(b.run('S.logs.w1d0.Dumbbell_Bench_Press[0].done'),true);assert.equal(b.run(`S.archives.classic12.logs.w12d4.Incline_Dumbbell_Press[0].w`),'30');}finally{b.close();}
});

test('unit conversion includes archived programs and program switches cannot discard drafts',()=>{
  const a=app({program:'comeback8'},true);try{
    a.click('[data-open-day]');a.input('[data-field="w"]','100');a.run("switchTrainingProgram('classic12');changeUnit('kg');switchTrainingProgram('comeback8')");
    assert.ok(Math.abs(a.run('Number(S.logs.w1d0.Dumbbell_Bench_Press[0].w)')-45.359)<.001);
    a.run("changeUnit('lb');switchTrainingProgram('classic12');switchTrainingProgram('comeback8')");assert.ok(Math.abs(a.run('Number(S.logs.w1d0.Dumbbell_Bench_Press[0].w)')-100)<.005);
    assert.equal(a.run('S.logs.w1d0.Dumbbell_Bench_Press[0].done'),false);
  }finally{a.close();}
});

test('failed upgrade or program save leaves the existing program and stored history intact',()=>{
  const legacy={startDate:'2026-10-01',unit:'lb',bw:[],bf:[],logs:{w1d0:{[bench]:[{w:'95',r:'8',done:true}]}}};
  const a=app(legacy,true,w=>{w.Storage.prototype.setItem=()=>{throw new Error('quota');};});try{
    assert.equal(a.run('S.program'),'classic12');assert.match(a.doc.querySelector('#storageWarning').textContent,/new plan could not be saved/);
    assert.deepEqual(JSON.parse(a.w.localStorage.getItem('fitlab_v1')),legacy);
    assert.equal(a.run("switchTrainingProgram('comeback8')"),false);assert.equal(a.run('S.program'),'classic12');assert.equal(a.run(`S.logs.w1d0['${bench}'][0].w`),'95');
  }finally{a.close();}
});

test('plank entry logs seconds, and Garmin exports retain actual hold duration',()=>{
  const a=app({program:'comeback8'},true);try{
    a.run('openDay(1,1,4)');assert.match(a.doc.querySelector('.set-hd').textContent,/Seconds/);
    a.input('[data-field="r"]','35');a.click('[data-ck]');
    const detail=a.run('workoutExportDetail(1,1)'),set=detail.exercises[0].sets[0];assert.equal(set.reps,null);assert.equal(set.durationSeconds,35);assert.equal(a.run('activeSetSeconds(workoutExportDetail(1,1).exercises[0].sets[0])'),35);
    const {Decoder,Stream}=require('@garmin/fitsdk');const decoder=new Decoder(Stream.fromByteArray(Array.from(a.run('buildGarminFit(workoutExportDetail(1,1))'))));const decoded=decoder.read();assert.equal(decoded.errors.length,0);
  }finally{a.close();}
});

test('update notices preserve active input nodes, and checks report current or offline status without touching logs',async()=>{
  const a=app({program:'comeback8'},true);try{
    a.click('[data-open-day]');a.input('[data-field="w"]','25');const field=a.doc.querySelector('[data-field="w"]');field.click();a.run('showUpdateReady()');assert.equal(a.doc.querySelector('#appUpdate').hidden,false);assert.equal(field.isConnected,true);assert.equal(a.doc.activeElement,field);
    a.run("updateReady=false;go('more')");const saved=a.w.localStorage.getItem('fitlab_v1');let opts;
    a.w.fetch=async(url,options)=>{opts=options;return new Response('<script src="app.js?v=13.6"></script>');};await a.run('checkAppUpdate()');assert.equal(opts.cache,'no-store');assert.match(a.doc.querySelector('#updateStatus').textContent,/up to date/);assert.equal(a.w.localStorage.getItem('fitlab_v1'),saved);
    a.w.fetch=async()=>{throw new Error('offline');};await a.run('checkAppUpdate()');assert.match(a.doc.querySelector('#updateStatus').textContent,/online/);assert.equal(a.w.localStorage.getItem('fitlab_v1'),saved);
  }finally{a.close();}
});

test('replacing a timed hold with a repetition exercise changes the input and export units',()=>{
  const a=app({program:'comeback8'},true);try{
    a.run('openDay(1,1,4)');assert.equal(a.run("setExerciseSwap('w1d1','Plank','Dead_Bug')"),true);
    assert.match(a.doc.querySelector('.set-hd').textContent,/Reps/);assert.doesNotMatch(a.doc.querySelector('.set-hd').textContent,/Seconds/);
    a.input('[data-field="r"]','8');a.click('[data-ck]');const set=a.run('workoutExportDetail(1,1).exercises[0].sets[0]');assert.equal(set.reps,8);assert.equal(set.durationSeconds,null);
  }finally{a.close();}
});

test('all comeback lifting days fit within 55 planned minutes including preparation and cooldown',()=>{
  const a=app({program:'comeback8'},true);try{
    for(let week=1;week<=8;week++)for(let day=0;day<7;day++){
      const p=a.run(`planFor(${week},${day})`);if(p.type!=='workout')continue;
      const minutes=a.run(`workoutTimeEstimate(planFor(${week},${day}),'w${week}d${day}').total`);
      assert.ok(minutes<=55,`Week ${week} day ${day}: ${minutes} minutes`);
      assert.ok(minutes>=30,'Warm-up, practice, rests and cooldown are counted');
    }
  }finally{a.close();}
});
test('hour clock survives reloads and counts breaks; 50 and 55 minute prompts preserve partial work',()=>{
  let saved;const a=app({program:'comeback8'},true);try{
    a.run('openDay(1,0)');a.click('[data-start-hour]');
    const began=a.run('S.sessionClocks.w1d0.startedAt');a.run("startHourClock('w1d0')");assert.equal(a.run('S.sessionClocks.w1d0.startedAt'),began);
    a.run('S.sessionClocks.w1d0.startedAt=Date.now()-50*60000;tickHourClock();save()');
    assert.match(a.doc.querySelector('[data-hour-message]').textContent,/Ten minutes left/);
    saved=a.w.localStorage.getItem('fitlab_v1');
  }finally{a.close();}
  const b=app(saved,true);try{
    b.run('openDay(1,0)');assert.match(b.doc.querySelector('[data-hour-message]').textContent,/Ten minutes left/);
    b.run('S.sessionClocks.w1d0.startedAt=Date.now()-55*60000;tickHourClock()');assert.match(b.doc.querySelector('[data-hour-message]').textContent,/Five minutes left/);
    b.run('S.sessionClocks.w1d0.startedAt=Date.now()-61*60000;tickHourClock()');assert.equal(b.doc.querySelector('[data-hour-clock]').textContent,'0:00 left');
    b.click('[data-finish-workout]');assert.ok(b.run('S.sessionClocks.w1d0.endedAt'));assert.equal(b.run('dayProgress(planFor(1,0)).done'),0);
  }finally{b.close();}
});
test('restart today preserves a recovery copy and measurements, resets the clock and persists Day 1',()=>{
  const a=app({program:'comeback8',startDate:'2026-10-23',bw:[{d:'2026-10-23',v:200}],logs:{w1d0:{Dumbbell_Bench_Press:[{w:'25',r:'10',done:true}]}},sessionClocks:{w1d0:{startedAt:12345}}},true);try{
    a.run("restartScheduleFrom(todayISO(),{confirm:false,program:'comeback8'})");
    assert.equal(a.run('S.startDate'),a.run('todayISO()'));assert.equal(a.run('todayPos().dayIndex'),0);assert.equal(a.run('S.bw.length'),1);
    assert.equal(a.run('Object.keys(S.logs).length'),0);assert.equal(a.run('Object.keys(S.sessionClocks).length'),0);
    const recovery=JSON.parse(a.w.localStorage.getItem('fitlab_backup_v12'));assert.equal(recovery.startDate,'2026-10-23');assert.equal(recovery.logs.w1d0.Dumbbell_Bench_Press[0].done,true);
    assert.equal(JSON.parse(a.w.localStorage.getItem('fitlab_v1')).startDate,a.run('todayISO()'));
  }finally{a.close();}
});
test('failed restart save keeps the original schedule and logs in memory and storage',()=>{
  const a=app({program:'comeback8',startDate:'2026-10-23',logs:{w1d0:{Dumbbell_Bench_Press:[{w:'25',r:'10',done:true}]}}},true);try{
    a.run("save();const originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fitlab_v1')throw new Error('full');return originalSet.call(this,k,v);}");
    assert.equal(a.run("restartScheduleFrom(todayISO(),{confirm:false})"),false);assert.equal(a.run('S.startDate'),'2026-10-23');assert.equal(a.run('S.logs.w1d0.Dumbbell_Bench_Press[0].done'),true);
  }finally{a.close();}
});
test('supersets retain every original comeback exercise, set and rep target for all eight weeks',()=>{
  const a=app({program:'comeback8'},true);try{
    for(let week=1;week<=8;week++)for(const day of [0,1,3,4]){
      const result=a.run(`(()=>{const p=planFor(${week},${day});return {base:COMEBACK_SPLIT[${day}].ex,ex:p.ex,blocks:workoutBlocks(p,'w${week}d${day}')};})()`);
      assert.deepEqual(Array.from(result.ex,e=>e.id),Array.from(result.base,e=>e.id));
      result.ex.forEach((e,i)=>{assert.equal(e.reps,result.base[i].reps);assert.equal(e.sets,week<=2||week===8?2:i<2?3:2);});
      assert.ok(result.blocks.some(b=>b.ex.length===2));
      if(day===1||day===4)assert.equal(result.blocks[0].ex.length,1,'Lower main lift retains its own rest');
    }
  }finally{a.close();}
});
test('Day 1 superset rests only after the press and row are both completed',()=>{
  const a=app({program:'comeback8'},true);try{
    a.run('openDay(1,0)');assert.match(a.doc.querySelector('.superset-note').textContent,/Press \+ row/);
    a.input('[data-ex="Dumbbell_Bench_Press"][data-field="w"]','25');a.click('[data-ck^="Dumbbell_Bench_Press|0|"]');assert.equal(a.run('!!S.restTimer'),false);
    a.input('[data-ex="Seated_Cable_Rows"][data-field="w"]','50');a.click('[data-ck^="Seated_Cable_Rows|0|"]');assert.ok(a.run('restSecondsLeft()')>115);
    assert.equal(a.run('dayProgress(planFor(1,0)).tot'),10);assert.equal(a.run('dayProgress(planFor(1,0)).done'),2);
  }finally{a.close();}
});

test('new installs open Push A today and show the four-day push/pull schedule',()=>{
  const a=app(undefined,true);try{
    assert.equal(a.run('S.program'),'pushpull8');assert.equal(a.run('S.startDate'),a.run('todayISO()'));
    assert.match(a.doc.querySelector('.topnote').textContent,/Push \/ Pull/);assert.match(a.doc.querySelector('.comeback-hero').textContent,/Push A/);
    assert.deepEqual(Array.from(a.run('programSplit().map(d=>d.key)')),['push-a','pull-a','recovery','push-b','pull-b','rest','rest']);
    a.click('[data-go="plan"]');assert.match(a.doc.querySelector('#app').textContent,/Legs included/);
  }finally{a.close();}
});
test('all 32 push/pull sessions retain six exercises and 14 sets within 55 planned minutes',()=>{
  const a=app(undefined,true);try{
    for(let week=1;week<=8;week++)for(const day of [0,1,3,4]){
      const p=a.run(`planFor(${week},${day})`);
      assert.equal(p.ex.length,6);assert.equal(p.ex.reduce((sum,e)=>sum+e.sets,0),14);
      assert.ok(a.run(`workoutTimeEstimate(planFor(${week},${day}),'w${week}d${day}').total`)<=55);
      for(const e of p.ex)assert.ok(a.run(`!!EXERCISES[${JSON.stringify(e.id)}]`));
      const ids=Array.from(p.ex,e=>e.id);
      if(day===0||day===3){assert.ok(!ids.some(id=>/Rows|Pulldown|Curl|Face_Pull|Deadlift/.test(id)));assert.ok(ids.some(id=>/Leg_Press|Squat/.test(id)));}
      else{assert.ok(!ids.some(id=>/Bench|Shoulder_Press|Triceps/.test(id)));assert.ok(ids.some(id=>/Deadlift|Hip_Thrust/.test(id)));}
    }
  }finally{a.close();}
});
test('push/pull keeps upper-body pairs together before the lower-body pair',()=>{
  const a=app(undefined,true);try{
    const lower=new Set(['Leg_Press','Standing_Calf_Raises','Goblet_Squat','Romanian_Deadlift','Barbell_Hip_Thrust','Lying_Leg_Curls']);
    for(const day of [0,1,3,4]){
      const blocks=a.run(`workoutBlocks(planFor(1,${day}),'w1d${day}')`);
      assert.equal(blocks.length,3);
      for(const [index,block] of blocks.entries()){
        assert.equal(block.ex.length,2);
        assert.ok(block.ex.every(e=>lower.has(e.id)===(index===2)));
        assert.ok(block.ex.every(e=>e.rest===120));
      }
    }
  }finally{a.close();}
});
test('all four sessions log 14 sets and rest correctly for paired and extra solo sets',()=>{
  const a=app(undefined,true);try{
    a.run('openDay(1,0)');a.input('[data-ex="Dumbbell_Bench_Press"][data-field="w"]','25');a.click('[data-ck^="Dumbbell_Bench_Press|0|"]');assert.equal(a.run('!!S.restTimer'),false);
    a.input('[data-ex="Side_Lateral_Raise"][data-field="w"]','10');a.click('[data-ck^="Side_Lateral_Raise|0|"]');assert.ok(a.run('restSecondsLeft()')>115);
    assert.match(a.doc.querySelector('.superset-note').textContent,/2 paired rounds.*1 remaining set of Dumbbell Bench Press/);
    for(const day of [0,1,3,4]){
      a.run(`openDay(1,${day});for(const [index,block] of workoutBlocks(planFor(1,${day}),'w1d${day}').entries()){setFlowIndex(planFor(1,${day}),index);render();for(let round=0;round<Math.max(...block.ex.map(e=>e.sets));round++)for(const e of block.ex){if(round>=e.sets)continue;const set=S.logs.w1d${day}[e.id][round];if(set.done)continue;set.w='25';set.r='10';toggleSet(e.id+'|'+round+'|'+e.rest);const roundDone=block.ex.every(x=>x.sets<=round||S.logs.w1d${day}[x.id][round].done);if(!!S.restTimer!==(roundDone&&!isWorkoutComplete(planFor(1,${day}))))throw new Error('Incorrect rest after '+e.id+' set '+round);}}`);
      assert.equal(a.run(`dayProgress(planFor(1,${day})).done`),14);assert.equal(a.run(`workoutExportDetail(1,${day}).summary.doneSets`),14);
    }
    assert.equal(a.errors.length,0);
  }finally{a.close();}
});
test('regrouping an active workout preserves completed upper/lower sets, start date and clock',()=>{
  const startedAt=Date.now()-600000;
  const a=app({program:'pushpull8',startDate:'2026-11-02',logs:{w1d0:{Dumbbell_Bench_Press:[{w:'25',r:'10',done:true}],Leg_Press:[{w:'100',r:'12',done:true}]}},sessionClocks:{w1d0:{startedAt}},flow:{w1d0:0}},true);try{
    a.run('openDay(1,0)');assert.equal(a.run('dayProgress(planFor(1,0)).done'),2);
    assert.equal(a.run('S.logs.w1d0.Dumbbell_Bench_Press[0].w'),'25');
    a.run('setFlowIndex(planFor(1,0),2);render()');assert.equal(a.run('S.logs.w1d0.Leg_Press[0].w'),'100');assert.equal(a.doc.querySelector('[data-ck^="Leg_Press|0|"]').getAttribute('aria-pressed'),'true');
    assert.equal(a.run('S.startDate'),'2026-11-02');assert.equal(a.run('S.sessionClocks.w1d0.startedAt'),startedAt);
  }finally{a.close();}
});
test('switching from comeback to Push/Pull preserves old logs and restores both programs after reload',()=>{
  const a=app({program:'comeback8',startDate:'2026-10-23',logs:{w1d0:{Dumbbell_Bench_Press:[{w:'25',r:'10',done:true}]}},bw:[{d:'2026-10-23',v:200}]},true);let saved;try{
    assert.equal(a.run('S.program'),'comeback8');
    a.run("switchTrainingProgram('pushpull8')");assert.equal(a.run('S.startDate'),a.run('todayISO()'));assert.equal(a.run('Object.keys(S.logs).length'),0);
    assert.equal(a.run('S.archives.comeback8.logs.w1d0.Dumbbell_Bench_Press[0].done'),true);
    a.run('openDay(1,0,2)');a.input('[data-ex="Leg_Press"][data-field="w"]','100');saved=a.w.localStorage.getItem('fitlab_v1');
  }finally{a.close();}
  const b=app(saved,true);try{
    assert.equal(b.run('S.program'),'pushpull8');assert.equal(b.run('S.logs.w1d0.Leg_Press[0].w'),'100');
    b.run("switchTrainingProgram('comeback8')");assert.equal(b.run('S.startDate'),'2026-10-23');assert.equal(b.run('S.logs.w1d0.Dumbbell_Bench_Press[0].done'),true);assert.equal(b.run('S.bw.length'),1);
  }finally{b.close();}
});
test('Push/Pull restart link waits for a click and preserves the previous program',()=>{
  const a=app({program:'comeback8',startDate:'2026-10-23',logs:{w1d0:{Dumbbell_Bench_Press:[{w:'25',r:'10',done:true}]}}},true,w=>w.history.replaceState(null,'','?setup=pushpull'));try{
    assert.equal(a.run('S.program'),'comeback8');assert.match(a.doc.querySelector('[data-restart-today]').textContent,/Start Push \/ Pull today/);
    a.click('[data-restart-today]');assert.equal(a.run('S.program'),'pushpull8');assert.equal(a.run('S.startDate'),a.run('todayISO()'));
    assert.equal(a.run('S.archives.comeback8.logs.w1d0.Dumbbell_Bench_Press[0].done'),true);assert.equal(JSON.parse(a.w.localStorage.getItem('fitlab_backup_v12')).program,'comeback8');
    assert.equal(a.w.location.search,'');assert.match(a.doc.querySelector('.comeback-hero').textContent,/Push A/);
  }finally{a.close();}
});

test('Push/Pull and comeback prefill a specific higher weight after all required sets reach the rep ceiling',()=>{
  for(const program of ['pushpull8','comeback8'])withApp({program,logs:{w1d0:{Dumbbell_Bench_Press:Array.from({length:3},()=>({w:'30',r:'12',done:true}))}}},a=>{
    a.run('openDay(2,0)');
    assert.equal(a.doc.querySelector('[data-ex="Dumbbell_Bench_Press"][data-field="w"]').value,'35');
    assert.equal(a.doc.querySelector('[data-ex="Dumbbell_Bench_Press"][data-field="r"]').value,'8');
    assert.match(a.doc.querySelector('.sugg').textContent,/35 lb each/);
    assert.match(a.doc.querySelector('.exdetails').textContent,/Every required set reached 12 reps/);
    assert.equal(a.run('S.logs.w1d0.Dumbbell_Bench_Press[0].w'),'30');
    assert.equal(a.run('dayProgress(planFor(2,0)).done'),0);
    const saved=a.w.localStorage.getItem('fitlab_v1');withApp(saved,b=>{b.run('openDay(2,0)');assert.equal(b.doc.querySelector('[data-ex="Dumbbell_Bench_Press"][data-field="w"]').value,'35');});
  });
});
test('modern progression holds for incomplete, inconsistent or below-target performance and builds reps first',()=>{
  const set=(w,r,done=true)=>({w:String(w),r:String(r),done});
  const cases=[
    {sets:[set(30,12),set(30,12)],w:30,r:8},
    {sets:[set(30,12),set(30,12),set(30,12,false)],w:30,r:8},
    {sets:[set(30,12),set(30,12),set(30,7)],w:30,r:8},
    {sets:[set(30,12),set(25,12),set(25,12)],w:25,r:8},
    {sets:[set(30,10),set(30,11),set(30,10)],w:30,r:11},
    {sets:[set(30,12),set(30,12),set('',12)],w:30,r:8},
  ];
  for(const c of cases)withApp({program:'pushpull8',logs:{w1d0:{Dumbbell_Bench_Press:c.sets}}},a=>{
    const s=a.run("suggest('Dumbbell_Bench_Press',planFor(2,0).ex[0],'w2d0')");assert.equal(s.weight,c.w);assert.equal(s.reps,c.r);
  });
});
test('shared exercises respect both days set counts and the latest session before increasing',()=>withApp({program:'pushpull8'},a=>{
  a.run("S.logs={w1d1:{Seated_Cable_Rows:[{w:'80',r:'12',done:true},{w:'80',r:'12',done:true}]}};");
  assert.equal(a.run("suggest('Seated_Cable_Rows',planFor(1,4).ex[0],'w1d4').weight"),80);
  a.run("S.logs.w1d4={Seated_Cable_Rows:[{w:'80',r:'12',done:true},{w:'80',r:'12',done:true},{w:'80',r:'12',done:false}]};");
  assert.equal(a.run("suggest('Seated_Cable_Rows',planFor(2,1).ex[2],'w2d1').weight"),80);
  a.run('S.logs.w1d4.Seated_Cable_Rows[2].done=true');
  assert.equal(a.run("suggest('Seated_Cable_Rows',planFor(2,1).ex[2],'w2d1').weight"),85);
}));
test('progression uses the performed exercise only and does not borrow archived or other movement weights',()=>withApp({program:'pushpull8'},a=>{
  a.run("S.logs={w1d0:{Dumbbell_Bench_Press:Array.from({length:3},()=>({w:'30',r:'12',done:true}))}};S.archives.classic12={logs:{w1d0:{Dumbbell_Shoulder_Press:[{w:'100',r:'12',done:true}]}}};");
  assert.equal(a.run("suggest('Dumbbell_Shoulder_Press',planFor(2,0).ex[2],'w2d0').weight"),'');
  assert.equal(a.run("suggest('Incline_Dumbbell_Press',planFor(1,3).ex[0],'w1d3').weight"),'');
  a.run("S.logs={w1d0:{Seated_Dumbbell_Press:Array.from({length:2},()=>({w:'25',r:'12',done:true}))}};S.swaps.w1d0={Dumbbell_Shoulder_Press:'Seated_Dumbbell_Press'};S.swaps.w2d0={Dumbbell_Shoulder_Press:'Seated_Dumbbell_Press'};");
  assert.equal(a.run("suggest('Seated_Dumbbell_Press',workoutExercises(planFor(2,0),'w2d0')[2],'w2d0').weight"),30);
}));
test('current workout suggestions use the actual load and explicit apply only changes unfinished sets',()=>withApp({program:'pushpull8',logs:{w1d0:{Dumbbell_Bench_Press:Array.from({length:3},()=>({w:'30',r:'12',done:true}))}}},a=>{
  a.run('openDay(2,0)');
  a.input('[data-ex="Dumbbell_Bench_Press"][data-field="w"][data-i="0"]','32.5');a.click('[data-ck^="Dumbbell_Bench_Press|0|"]');
  a.input('[data-ex="Dumbbell_Bench_Press"][data-field="w"][data-i="1"]','40');a.run('render()');
  assert.equal(a.run('S.logs.w2d0.Dumbbell_Bench_Press[1].w'),'40');
  assert.equal(a.run("suggest('Dumbbell_Bench_Press',planFor(2,0).ex[0],'w2d0').weight"),32.5);
  const completed=a.run('JSON.stringify(S.logs.w2d0.Dumbbell_Bench_Press[0])');
  a.click('[data-apply-suggestion="Dumbbell_Bench_Press"]');
  assert.equal(a.run('S.logs.w2d0.Dumbbell_Bench_Press[1].w'),'32.5');
  assert.equal(a.run('JSON.stringify(S.logs.w2d0.Dumbbell_Bench_Press[0])'),completed);
  assert.equal(a.run('dayProgress(planFor(2,0)).done'),1);
}));
test('exercise increases can be saved through the form without overwriting drafts, and survive units, backup and reload',()=>{
  let saved;
  withApp({program:'pushpull8',logs:{w1d0:{Dumbbell_Bench_Press:Array.from({length:3},()=>({w:'30',r:'12',done:true}))}}},a=>{
    a.run('openDay(2,0)');a.input('[data-ex="Dumbbell_Bench_Press"][data-field="w"]','40');
    a.input('[data-load-step-form="Dumbbell_Bench_Press"] input','2.5');a.click('[data-load-step-form="Dumbbell_Bench_Press"] button');
    assert.equal(a.run('S.loadSteps.Dumbbell_Bench_Press.lb'),2.5);assert.equal(a.run('S.logs.w2d0.Dumbbell_Bench_Press[0].w'),'40');
    assert.match(a.doc.querySelector('.sugg').textContent,/32.5 lb each/);
    a.click('[data-apply-suggestion="Dumbbell_Bench_Press"]');assert.equal(a.run('S.logs.w2d0.Dumbbell_Bench_Press[0].w'),'32.5');
    a.run("changeUnit('kg');setLoadStep('Dumbbell_Bench_Press','1');changeUnit('lb')");
    assert.equal(a.run('loadStepFor(planFor(2,0).ex[0])'),2.5);assert.equal(a.run('S.loadSteps.Dumbbell_Bench_Press.kg'),1);
    assert.equal(a.run('JSON.stringify(validateBackup(JSON.stringify(backupPayload())))===JSON.stringify(S)'),true);
    a.run("switchTrainingProgram('comeback8');switchTrainingProgram('pushpull8')");saved=a.w.localStorage.getItem('fitlab_v1');
  });
  withApp(saved,a=>{assert.equal(a.run('S.loadSteps.Dumbbell_Bench_Press.lb'),2.5);assert.equal(a.run('S.loadSteps.Dumbbell_Bench_Press.kg'),1);});
});
test('metric suggestions and small dumbbell increases use the appropriate increments',()=>{
  for(const [unit,id,w,r,next] of [['lb','Leg_Press',100,12,110],['kg','Leg_Press',100,12,105],['kg','Dumbbell_Bench_Press',20,12,22.5],['lb','Side_Lateral_Raise',10,15,12.5],['kg','Side_Lateral_Raise',5,15,6]])withApp({program:'pushpull8',unit,logs:{w1d0:{[id]:Array.from({length:3},()=>({w:String(w),r:String(r),done:true}))}}},a=>{
    assert.equal(a.run(`suggest('${id}',planFor(2,0).ex.find(e=>e.id==='${id}'),'w2d0').weight`),next);
  });
});
test('bodyweight and ambiguous assistance are not automatically increased, and timed sets retain seconds',()=>withApp({program:'pushpull8'},a=>{
  a.run("S.logs={w1d1:{Pullups:[{w:'50',r:'12',done:true},{w:'50',r:'12',done:true},{w:'50',r:'12',done:true}]}};S.swaps.w1d1={'Wide-Grip_Lat_Pulldown':'Pullups'};");
  assert.equal(a.run("suggest('Pullups',{id:'Pullups',sets:3,reps:'8–12'},'w2d1').weight"),50);
  assert.equal(a.run("suggest('Plank',{id:'Plank',sets:2,reps:'20–40',timed:true},'w2d1').reps"),20);
  assert.equal(a.run("suggest('Leg_Press',planFor(2,0).ex[4],'w2d0').weight"),'');
}));
test('invalid increase preferences are discarded and failed saves leave settings and drafts intact',()=>withApp({program:'pushpull8',loadSteps:{Dumbbell_Bench_Press:{lb:-5,kg:'2,5'},Unknown:{lb:5}}},a=>{
  assert.equal(a.run('S.loadSteps.Dumbbell_Bench_Press.lb'),undefined);assert.equal(a.run('S.loadSteps.Dumbbell_Bench_Press.kg'),2.5);assert.equal(a.run('S.loadSteps.Unknown'),undefined);
  assert.equal(a.run("setLoadStep('Dumbbell_Bench_Press','0')"),false);assert.equal(a.run("setLoadStep('Dumbbell_Bench_Press','NaN')"),false);
  a.run("S.logs.w1d0={Dumbbell_Bench_Press:Array.from({length:3},()=>({w:'30',r:'12',done:true}))};openDay(2,0)");a.input('[data-ex="Dumbbell_Bench_Press"][data-field="w"]','40');
  a.w.Storage.prototype.setItem=()=>{throw new Error('full');};
  assert.equal(a.run("setLoadStep('Dumbbell_Bench_Press','2.5')"),false);assert.equal(a.run('S.loadSteps.Dumbbell_Bench_Press.lb'),undefined);
  assert.equal(a.run("applySuggestion('Dumbbell_Bench_Press')"),false);assert.equal(a.run('S.logs.w2d0.Dumbbell_Bench_Press[0].w'),'40');
}));

// Visual check-ins use real logging and click paths; synthetic data never reaches a live account.
function completedPush(a,reps=12){a.run(`{S.startDate=todayISO();const plan=planFor(1,0);S.logs.w1d0=Object.fromEntries(workoutExercises(plan,'w1d0').map(e=>[e.id,Array.from({length:e.sets},()=>({w:e.id==='Leg_Press'?'100':'30',r:String(Math.min(${reps},parseRange(e.reps).max)),done:true}))]));save();render();}`);}
function nextBench(a){return a.run("suggest('Dumbbell_Bench_Press',planFor(2,0).ex[0],'w2d0')");}
test('completed Day 1 opens a photo and scale check-in with no text entry; taps survive reload',()=>{
  let saved;
  withApp({program:'pushpull8'},a=>{completedPush(a);a.click('[data-open-feedback="w1d0"]');assert.equal(a.doc.querySelectorAll('.fb-exercise').length,6);assert.equal(a.doc.querySelectorAll('.feedback-view input,.feedback-view textarea,.feedback-view select').length,0);assert.equal(a.doc.querySelectorAll('.fb-exercise-head img').length,6);
    a.click('[data-feedback-overall="4"]');a.click('[data-feedback-rir="Dumbbell_Bench_Press|3"]');a.click('[data-body-muscle="quadriceps"]');a.click('[data-body-score="5"]');
    assert.equal(a.run('S.feedback.w1d0.overall'),4);assert.equal(a.run("exerciseEffort('w1d0','Dumbbell_Bench_Press')"),3);assert.equal(a.run('S.recovery.muscles.quadriceps.score'),5);assert.equal(nextBench(a).weight,35);
    assert.equal(a.run("suggest('Leg_Press',planFor(2,0).ex[4],'w2d0').weight"),100);assert.match(a.doc.querySelector('[data-next-ex="Dumbbell_Bench_Press"]').textContent,/35 lb each/);
    assert.equal(a.run('dayProgress(planFor(1,0)).done'),14);assert.equal(a.errors.length,0);saved=a.w.localStorage.getItem('fitlab_v1');
  });
  withApp(saved,a=>{a.click('[data-open-feedback="w1d0"]');assert.equal(a.doc.querySelector('[data-feedback-rir="Dumbbell_Bench_Press|3"]').getAttribute('aria-pressed'),'true');assert.equal(a.run('S.feedback.w1d0.muscles.quadriceps.score'),5);a.click('[data-feedback-save]');assert.equal(a.run('view'),'today');});
});
test('finish shows congratulations, ends the clock, and keeps feedback reachable',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.run('openDay(1,0);S.sessionClocks.w1d0={startedAt:Date.now()-2000000};');a.click('[data-finish-workout]');assert.equal(a.run('view'),'day');assert.ok(a.doc.querySelector('.completion-card'));assert.ok(a.run('S.sessionClocks.w1d0.endedAt'));assert.equal(a.run('dayProgress(planFor(1,0)).done'),14);a.click('.completion-card [data-open-feedback]');a.click('[data-feedback-save]');assert.equal(a.run('view'),'day');
}));
test('effort selectively lowers, holds or advances load, and easy sets build reps within the range',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.click('[data-open-feedback]');
  for(const [rir,weight] of [[0,25],[1,30],[2,35],[3,35],[4,35]]){a.click(`[data-feedback-rir="Dumbbell_Bench_Press|${rir}"]`);assert.equal(nextBench(a).weight,weight);}
  completedPush(a,9);a.run("openFeedback('w1d0')");a.click('[data-feedback-rir="Dumbbell_Bench_Press|4"]');assert.equal(nextBench(a).weight,30);assert.equal(nextBench(a).reps,11);
  a.run('S.logs.w1d0.Dumbbell_Bench_Press[2].done=false');a.click('[data-feedback-rir="Dumbbell_Bench_Press|4"]');assert.equal(nextBench(a).weight,30);
  a.run('S.logs.w1d0.Dumbbell_Bench_Press.forEach(s=>s.w="2.5")');a.click('[data-feedback-rir="Dumbbell_Bench_Press|0"]');assert.ok(nextBench(a).weight>0);
  assert.equal(a.run('planFor(2,0).ex.length'),6);assert.equal(a.run('dayProgress(planFor(2,0)).tot'),14);assert.ok(a.run("workoutTimeEstimate(planFor(2,0),'w2d0').total")<=60);
}));
test('sharp pain blocks primary and secondary muscles even mid-workout, while unrelated legs progress',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.click('[data-open-feedback]');a.click('[data-body-muscle="shoulders"]');a.click('[data-body-kind="pain"]');assert.equal(nextBench(a).blocked,true);assert.equal(nextBench(a).weight,'');
  assert.equal(a.run("suggest('Dumbbell_Shoulder_Press',planFor(2,0).ex[2],'w2d0').blocked"),true);
  assert.equal(a.run("suggest('Leg_Press',planFor(2,0).ex[4],'w2d0').weight"),110);
  a.run('openDay(2,0)');assert.ok(a.doc.querySelector('.fb-training-note'));assert.equal(a.doc.querySelector('[data-apply-suggestion="Dumbbell_Bench_Press"]'),null);
  a.run("S.logs.w2d0.Dumbbell_Bench_Press[0]={w:'30',r:'8',done:true}");assert.equal(nextBench(a).blocked,true);
  a.click('[data-open-recovery]');a.click('[data-body-muscle="shoulders"]');a.click('[data-body-score="0"]');assert.equal(nextBench(a).blocked,undefined);
  assert.equal(a.run('S.feedback.w1d0.muscles.shoulders.pain'),true);assert.equal(a.run('S.recovery.muscles.shoulders.pain'),false);
}));
test('moderate and old discomfort hold until rechecked; severe discomfort pauses regardless of pain type',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.run("S.recovery.muscles.chest={score:4,pain:false,at:Date.now()-72*3600000}");assert.equal(nextBench(a).weight,30);assert.match(nextBench(a).note,/older than 48/);
  a.run('S.recovery.muscles.chest.score=7');assert.equal(nextBench(a).blocked,true);
  a.run('S.recovery.muscles.chest.score=0');assert.equal(nextBench(a).weight,35);
}));
test('readiness uses fresh energy only; post-workout feeling is not assumed to be future readiness',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.click('[data-open-feedback]');a.click('[data-feedback-overall="1"]');assert.equal(nextBench(a).weight,35);
  a.run("openFeedback(null,'recovery')");a.click('[data-feedback-overall="1"]');assert.equal(nextBench(a).weight,30);
  a.run('S.recovery.energy.at=Date.now()-25*3600000');assert.equal(nextBench(a).weight,35);
}));
test('editing old session effort does not make historical discomfort current',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.run("S.startDate='2026-01-01';openFeedback('w1d0')");a.click('[data-body-muscle="chest"]');a.click('[data-body-kind="pain"]');assert.equal(a.run('S.feedback.w1d0.muscles.chest.pain'),true);assert.equal(a.run('S.recovery.muscles.chest'),undefined);
}));
test('effort requires actual sets, survives unit conversion, and is invalidated by edited logs',()=>withApp({program:'pushpull8'},a=>{
  a.click('[data-open-feedback]');assert.equal(a.doc.querySelector('[data-feedback-rir]').disabled,true);assert.equal(a.run("setExerciseEffort('Dumbbell_Bench_Press',4)"),false);
  completedPush(a);a.run("openFeedback('w1d0')");a.click('[data-feedback-rir="Dumbbell_Bench_Press|1"]');a.run("changeUnit('kg')");assert.equal(a.run("exerciseEffort('w1d0','Dumbbell_Bench_Press')"),1);
  a.run("S.logs.w1d0.Dumbbell_Bench_Press[0].r='11'");assert.equal(a.run("exerciseEffort('w1d0','Dumbbell_Bench_Press')"),null);
}));
test('feedback archives with programs and reset recovery copy, while unresolved current pain persists',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.click('[data-open-feedback]');a.click('[data-feedback-rir="Dumbbell_Bench_Press|1"]');a.click('[data-body-muscle="chest"]');a.click('[data-body-kind="pain"]');
  a.run("switchTrainingProgram('comeback8')");assert.equal(a.run('Object.keys(S.feedback).length'),0);assert.equal(a.run('S.recovery.muscles.chest.pain'),true);
  a.run("switchTrainingProgram('pushpull8')");assert.equal(a.run("exerciseEffort('w1d0','Dumbbell_Bench_Press')"),1);
  a.run('restartScheduleFrom(todayISO(),{confirm:false})');assert.equal(a.run('Object.keys(S.feedback).length'),0);assert.equal(a.run('S.recovery.muscles.chest.pain'),true);assert.equal(JSON.parse(a.w.localStorage.getItem('fitlab_backup_v12')).feedback.w1d0.effort.Dumbbell_Bench_Press.rir,1);
}));
test('failed feedback saves roll back the tap and keep the stored workout unchanged',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.click('[data-open-feedback]');const before=a.w.localStorage.getItem('fitlab_v1');a.run("Storage.prototype.setItem=function(){throw new Error('full')}");a.click('[data-feedback-overall="5"]');assert.equal(a.run('S.feedback.w1d0'),undefined);assert.equal(a.doc.querySelector('#storageWarning').hidden,false);assert.equal(a.w.localStorage.getItem('fitlab_v1'),before);
}));
test('restore discards invalid ratings and muscle keys; keyboard body-map selection works',()=>withApp({program:'pushpull8',feedback:{bad:{overall:3},w1d0:{overall:9,effort:{Dumbbell_Bench_Press:{rir:9,signature:'x'}},muscles:{chest:{score:99,at:Date.now()},fake:{score:3,at:Date.now()}}}},recovery:{energy:{value:8,at:Date.now()},muscles:{shoulders:{score:5,pain:false,at:Date.now()}}}},a=>{
  assert.equal(a.run('Object.keys(S.feedback).length'),1);assert.equal(a.run('S.feedback.w1d0.overall'),undefined);assert.equal(a.run('Object.keys(S.feedback.w1d0.effort).length'),0);assert.equal(a.run('Object.keys(S.feedback.w1d0.muscles).length'),0);assert.equal(a.run('S.recovery.energy'),undefined);
  a.click('[data-open-feedback]');a.doc.querySelector('g[data-body-muscle="chest"]').dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.ok(a.doc.querySelector('[data-body-score="5"]'));
}));
test('feedback navigation restores session versus readiness views through browser history',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.click('[data-open-feedback]');const session=a.w.history.state;a.run("openFeedback(null,'recovery')");const recovery=a.w.history.state;
  a.w.dispatchEvent(new a.w.PopStateEvent('popstate',{state:session}));assert.equal(a.doc.querySelectorAll('.fb-exercise').length,6);
  a.w.dispatchEvent(new a.w.PopStateEvent('popstate',{state:recovery}));assert.equal(a.doc.querySelectorAll('.fb-exercise').length,0);assert.match(a.doc.querySelector('h1').textContent,/Ready/);
}));

test('the final set reveals and focuses congratulations with next-day and feedback actions',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.run("S.logs.w1d0.Leg_Press[2].done=false;openDay(1,0,2);S.sessionClocks.w1d0={startedAt:Date.now()-45*60000};startRest(120,'Rest');");
  assert.equal(a.doc.querySelector('.completion-card'),null);
  a.click('[data-ck^="Leg_Press|2|"]');
  assert.match(a.doc.querySelector('.completion-card').textContent,/Congratulations!/);assert.match(a.doc.querySelector('.completion-stats').textContent,/14 \/ 14/);
  assert.equal(a.doc.activeElement,a.doc.querySelector('.completion-title'));assert.equal(a.run('!!S.restTimer'),false);assert.equal(a.run('S.sessionClocks.w1d0.endedAt'),undefined);
  assert.match(a.doc.querySelector('[data-next-program-day]').textContent,/Go to Day 2/);
  assert.ok(a.doc.querySelector('.completion-card [data-open-feedback]'));assert.equal(a.run('dayProgress(planFor(1,1)).done'),0);assert.equal(a.errors.length,0);
}));
test('Day 2 opens after completion without restarting the schedule or starting the next clock',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.run('S.sessionClocks.w1d0={startedAt:Date.now()-3000000};render()');const start=a.run('S.startDate'),logs=a.run('JSON.stringify(S.logs.w1d0)');
  a.click('[data-next-program-day="w1d0"]');assert.equal(a.run('view'),'day');assert.equal(a.run('viewingPos.dayIndex'),1);assert.match(a.doc.querySelector('h1').textContent,/Pull A/);
  assert.equal(a.run('S.startDate'),start);assert.equal(a.run('JSON.stringify(S.logs.w1d0)'),logs);assert.ok(a.run('S.sessionClocks.w1d0.endedAt'));assert.equal(a.run('S.sessionClocks.w1d1'),undefined);assert.equal(a.run('dayProgress(planFor(1,1)).done'),0);
}));
test('saved Day 1 completion gets the celebration after reload and rating still returns to its next-day button',async()=>{
  let saved;withApp({program:'pushpull8'},a=>{completedPush(a);saved=a.w.localStorage.getItem('fitlab_v1');});
  const a=app(saved);try{
    assert.match(a.doc.querySelector('.completion-card').textContent,/Congratulations!/);assert.ok(a.doc.querySelector('[data-next-program-day="w1d0"]'));
    a.click('.completion-card [data-open-feedback]');a.click('[data-feedback-overall="4"]');a.click('[data-feedback-save]');assert.ok(a.doc.querySelector('[data-next-program-day="w1d0"]'));
    a.click('[data-open-day="1.0"]');a.click('.completion-card [data-open-feedback]');a.click('[data-feedback-save]');await new Promise(resolve=>a.w.requestAnimationFrame(resolve));assert.equal(a.doc.activeElement,a.doc.querySelector('.completion-title'));
  }finally{a.close();}
});
test('partial sessions and undone or edited sets do not claim full completion or allow advancing',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.run('openDay(1,0,2)');a.click('[data-ck^="Leg_Press|2|"]');assert.equal(a.doc.querySelector('.completion-card'),null);assert.equal(a.run("continueAfterWorkout('w1d0')"),false);
  a.click('[data-finish-workout]');assert.equal(a.run('view'),'feedback');assert.equal(a.run('dayProgress(planFor(1,0)).done'),13);
  a.run('openDay(1,0,2)');a.click('[data-ck^="Leg_Press|2|"]');assert.ok(a.doc.querySelector('.completion-card'));
  a.input('[data-ex="Leg_Press"][data-i="2"][data-field="w"]','105');assert.equal(a.doc.querySelector('.completion-card'),null);assert.equal(a.run("continueAfterWorkout('w1d0')"),false);
}));
test('continuing keeps recovery days, next-day lookup rolls weeks, and the final day stays in bounds',()=>withApp({program:'pushpull8'},a=>{
  a.run("{const p=planFor(1,1);S.logs.w1d1=Object.fromEntries(p.ex.map(e=>[e.id,Array.from({length:e.sets},()=>({w:'30',r:'12',done:true}))]));openDay(1,1);}");
  a.click('[data-next-program-day="w1d1"]');assert.equal(a.run('viewingPos.dayIndex'),2);assert.match(a.doc.querySelector('h1').textContent,/Easy cardio/);
  assert.equal(a.run('nextProgramDay(planFor(1,6)).week'),2);assert.equal(a.run('nextProgramDay(planFor(1,6)).dayIndex'),0);assert.equal(a.run('nextProgramDay(planFor(8,6))'),null);
}));
test('failed completion save keeps the user on Day 1 with the original clock and stored history',()=>withApp({program:'pushpull8'},a=>{
  completedPush(a);a.run('S.sessionClocks.w1d0={startedAt:Date.now()-1000000};save();render()');const before=a.w.localStorage.getItem('fitlab_v1');
  a.run("Storage.prototype.setItem=function(){throw new Error('full')}");a.click('[data-next-program-day="w1d0"]');assert.equal(a.run('view'),'today');assert.equal(a.run('S.sessionClocks.w1d0.endedAt'),undefined);assert.equal(a.run('S.reviewed.w1d0'),undefined);
  assert.equal(a.w.localStorage.getItem('fitlab_v1'),before);assert.equal(a.doc.querySelector('#storageWarning').hidden,false);
}));

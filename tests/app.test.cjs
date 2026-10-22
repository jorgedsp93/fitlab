const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
process.env.TZ='America/Toronto';
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'companion.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'app.js'),'utf8');
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
  a.input('[data-field="w"]','25');a.click('[data-ck]');assert.equal(a.run('!!S.restTimer'),true);
}));
test('rest timer uses elapsed wall time after backgrounding and persists on reload',()=>{
  let saved;
  withApp(undefined,a=>{a.run("startRest(120,'Rest')");saved=a.w.localStorage.getItem('fitlab_v1');a.run('S.restTimer.endsAt=Date.now()-1000;tickRest()');assert.equal(a.run('!!S.restTimer'),false);assert.equal(a.doc.querySelector('#restbar').classList.contains('ready'),true);assert.match(a.doc.querySelector('#rtannounce').textContent,/Ready for your next set/);});
  withApp(saved,a=>assert.ok(a.run('restSecondsLeft()')>100));
});
test('swapping cannot reuse a second exercise slot or hide already completed sets',()=>withApp(undefined,a=>{
  assert.equal(a.run(`setExerciseSwap('w1d0','${bench}','Incline_Dumbbell_Press')`),false);
  assert.equal(a.run(`setExerciseSwap('w1d0','${bench}','Dumbbell_Bench_Press')`),true);
  a.run(`openDay(1,0);S.logs.w1d0.Dumbbell_Bench_Press[0]={w:'30',r:'8',done:true}`);
  assert.equal(a.run(`setExerciseSwap('w1d0','${bench}',null)`),true);
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
  a.doc.querySelector('[data-manual-bf]').closest('details').open=true;
  for(const id of ['manualBF']){a.click('#'+id);assert.equal(a.doc.activeElement.id,id);}
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

test('manual body measurement submits through its real button and decimal drafts survive reload',()=>{
  let saved;
  withApp(undefined,a=>{
    a.run(`go('stats')`);a.doc.querySelector('[data-manual-bf]').closest('details').querySelector('summary').click();a.input('#manualBF','22');a.click('[data-manual-bf] button[type="submit"]');assert.equal(a.run('S.bf.length'),1);assert.equal(a.run('S.bf[0].v'),22);
    a.run('openDay(1,0)');a.input('[data-field="w"]','22,5');saved=a.w.localStorage.getItem('fitlab_v1');
  });
  withApp(saved,a=>{a.click('[data-open-day]');assert.equal(a.doc.querySelector('[data-field="w"]').value,'22.5');assert.equal(a.doc.querySelector('[data-ck]').getAttribute('aria-pressed'),'false');});
});

test('v12 migration freezes original workout dates, removes assumed measurements, and keeps logs',()=>withApp({startDate:'2026-01-01',schemaVersion:12,unit:'lb',heightCm:185.4,logs:{w1d0:{[bench]:[{w:'95',r:'8',done:true}]}},bw:[],bf:[{d:'2026-01-02',v:20}]},a=>{
  assert.equal(a.run('S.schemaVersion'),13);assert.equal(a.run('S.heightConfirmed'),false);assert.equal(a.run('S.sessions.w1d0.performedDate'),'2026-01-01');assert.match(a.run('S.bf[0].source'),/not confirmed/);
  a.run("setStartDate('2026-02-01')");assert.equal(a.run('ymd(dateForPos(1,0))'),'2026-01-01');assert.equal(a.run('S.logs.w1d0[Object.keys(S.logs.w1d0)[0]][0].done'),true);
}));
test('moving an unstarted session changes next-session order and starting records today',()=>withApp(undefined,a=>{
  a.run("const future=new Date();future.setDate(future.getDate()+10);moveSession('w1d0',ymd(future))");assert.equal(a.run('nextSession().key'),'pull');
  a.run("startSession('w1d0')");assert.equal(a.run('ymd(dateForPos(1,0))'),a.run('todayISO()'));assert.equal(a.run("moveSession('w1d0',todayISO())"),false);
}));
test('pause, resume, reload and finish preserve elapsed training time without paused time',()=>{
  let saved;
  withApp(undefined,a=>{a.run("startSession('w1d0');S.sessions.w1d0.runningSince=new Date(Date.now()-61000).toISOString();pauseSession('w1d0',false)");assert.equal(a.run("sessionElapsed('w1d0')"),61);a.run("startSession('w1d0');S.sessions.w1d0.runningSince=new Date(Date.now()-9000).toISOString();save()");saved=a.w.localStorage.getItem('fitlab_v1');});
  withApp(saved,a=>{assert.ok(a.run("sessionElapsed('w1d0')")>=70);a.run("openDay(1,0);finishSession('w1d0')");assert.equal(a.run('view'),'review');assert.equal(a.run('!!S.sessions.w1d0.runningSince'),false);assert.equal(a.run('S.sessions.w1d0.status'),'finished');});
});
test('plan pause shifts only future unstarted work and training weekdays are honored',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'95',r:'8',done:true}]};freezeHistoryDates();const fixed=ymd(dateForPos(1,0));const before=calendarDay(ymd(dateForPos(1,1)));pausePlan();S.schedule.pausedAt=ymd(new Date(Date.now()-3*86400000));resumePlan();if(calendarDay(ymd(dateForPos(1,1)))-before!==3)throw Error('Pending date did not move');if(ymd(dateForPos(1,0))!==fixed)throw Error('History moved');S.preferences.weekdays=[1,3];applyTrainingDays();`);
  assert.ok([1,3].includes(a.run('dateForPos(1,1).getDay()')));
}));
test('warmups do not count toward completion or progression, and work sets can be added or removed',()=>withApp(undefined,a=>{
  a.run(`openDay(1,0);addSet('w1d0','${bench}','warmup');S.logs.w1d0['${bench}'][0]={w:'300',r:'20',kind:'warmup',done:true};render()`);
  assert.equal(a.run('dayProgress(planFor(1,0)).done'),0);assert.equal(a.run(`currentWorkoutSuggestion('${bench}',planFor(1,0).ex[0],'w1d0')`),null);
  a.run(`addSet('w1d0','${bench}');`);assert.equal(a.run('dayProgress(planFor(1,0)).tot'),20);
  a.run(`removeSet('w1d0','${bench}',4)`);assert.equal(a.run('dayProgress(planFor(1,0)).tot'),19);
}));
test('mid-exercise swap retains completed sets, allocates remaining sets, and uses the replacement photo',()=>withApp(undefined,a=>{
  a.run(`openDay(1,0);S.logs.w1d0['${bench}'][0]={w:'95',r:'8',done:true};setExerciseSwap('w1d0','${bench}','Dumbbell_Bench_Press');`);
  assert.equal(a.run('dayProgress(planFor(1,0)).tot'),19);assert.equal(a.run('dayProgress(planFor(1,0)).done'),1);assert.equal(a.run("workoutExercises(planFor(1,0),'w1d0')[0].sets"),2);
  assert.match(a.doc.querySelector('.exercise-thumb').src,/Dumbbell_Bench_Press/);assert.equal(a.run('workoutExportDetail(1,0).summary.doneSets'),1);
  a.run("omitExercise('w1d0','Dumbbell_Bench_Press')");assert.equal(a.run("workoutExercises(planFor(1,0),'w1d0').some(e=>e.id==='Dumbbell_Bench_Press')"),false);assert.equal(a.run('dayProgress(planFor(1,0)).done'),1);
}));
test('short sessions preserve completed late exercises and full-session restore keeps the work',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={Standing_Dumbbell_Triceps_Extension:[{w:'30',r:'12',done:true}]};shortSession('w1d0',20);`);
  assert.ok(a.run('dayProgress(planFor(1,0)).tot')<19);assert.equal(a.run('dayProgress(planFor(1,0)).done'),1);
  a.run("shortSession('w1d0',0)");assert.equal(a.run('dayProgress(planFor(1,0)).tot'),19);assert.equal(a.run('dayProgress(planFor(1,0)).done'),1);
}));
test('adding, skipping, restoring and reordering movements cannot duplicate a planned exercise',()=>withApp(undefined,a=>{
  a.run(`omitExercise('w1d0','${bench}');addExercise('w1d0','${bench}');addExercise('w1d0','Dumbbell_Bench_Press');moveBlock('w1d0','Dumbbell_Bench_Press',-1);`);
  assert.equal(a.run(`workoutExercises(planFor(1,0),'w1d0').filter(e=>e.id==='${bench}').length`),1);assert.equal(a.run("workoutExercises(planFor(1,0),'w1d0').length"),8);assert.equal(a.errors.length,0);
}));
test('new cycles preserve searchable history, notes, dates and weight units through backup restore',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'100',r:'8',done:true}]};sessionFor('w1d0').notes={'${bench}':'Rack 2'};freezeHistoryDates();restartScheduleFrom(todayISO(),{confirm:false});changeUnit('kg');`);
  assert.equal(a.run('S.archives.length'),1);assert.equal(a.run('allHistory().length'),1);assert.ok(Math.abs(a.run(`lastPerf('${bench}','w1d0')[0].w`)-45.359)<.001);
  a.run("S=validateBackup(JSON.stringify(backupPayload()));archiveSelection=S.archives[0].id+'|w1d0';go('archive')");assert.match(a.doc.querySelector('#app').textContent,/Rack 2/);assert.match(a.doc.querySelector('#app').textContent,/45.4/);assert.equal(a.errors.length,0);
}));
test('hard effort holds the load and custom increments survive unit conversion',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':Array.from({length:3},()=>({w:'100',r:'8',done:true}))};sessionFor('w1d0').effort={'${bench}':'hard'};`);
  assert.equal(a.run(`suggest('${bench}',planFor(2,0).ex[0],'w2d0').weight`),100);
  a.run(`S.sessions.w1d0.effort['${bench}']='right';S.preferences.increments['${bench}']={value:2.5,unit:'lb'}`);assert.equal(a.run(`suggest('${bench}',planFor(2,0).ex[0],'w2d0').weight`),102.5);
  a.run("changeUnit('kg')");assert.ok(Math.abs(a.run('incFor(planFor(2,0).ex[0])')-1.134)<.001);
}));
test('weekly progress distinguishes partial sessions, complete sessions, and warmups',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':[{w:'100',r:'8',done:true}]};sessionFor('w1d0').performedDate=todayISO();S.logs.w1d1={Face_Pull:[{w:'20',r:'10',kind:'warmup',done:true}]};sessionFor('w1d1').performedDate=todayISO();go('stats')`);
  assert.equal(a.run('weeklySummary().partial'),1);assert.equal(a.run('weeklySummary().completed'),0);assert.equal(a.run('allHistory().length'),1);assert.ok(a.doc.querySelector('.trend-awaiting'));assert.equal(a.errors.length,0);
}));
test('notes and effort save from their controls; habit targets are user-chosen and survive reload',()=>{
  let saved;withApp(undefined,a=>{a.run('openDay(1,0)');a.input('#exerciseNote','Rack 3');a.click('[data-effort$="|hard"]');a.run("go('more')");a.input('[name="stepsTarget"]','7000');a.doc.querySelector('[name="rideEnabled"]').checked=false;a.doc.querySelector('[data-habit-settings]').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));saved=a.w.localStorage.getItem('fitlab_v1');});
  withApp(saved,a=>{assert.equal(a.run(`S.sessions.w1d0.notes['${bench}']`),'Rack 3');assert.equal(a.run(`S.sessions.w1d0.effort['${bench}']`),'hard');assert.equal(a.run('S.preferences.habits.steps.target'),7000);assert.equal(a.run('S.preferences.habits.ride.enabled'),false);});
});
test('actual timed exports keep synthetic sets within the recorded session window',async()=>{
  const {Decoder,Stream}=await import('@garmin/fitsdk');withApp(undefined,a=>{
    a.run(`S.logs.w1d0={'${bench}':Array.from({length:3},()=>({w:'100',r:'8',done:true}))};S.sessions.w1d0={startedAt:new Date(Date.now()-30000).toISOString(),endedAt:new Date().toISOString(),elapsedMs:10000};`);
    const detail=a.run('workoutExportDetail(1,0)');assert.equal(detail.timing.estimated,false);assert.equal(detail.timing.durationSeconds,10);
    const {messages,errors}=new Decoder(Stream.fromByteArray(Array.from(a.run('buildGarminFit(workoutExportDetail(1,0))')))).read();assert.deepEqual(errors,[]);for(const s of messages.setMesgs)assert.ok(s.timestamp<=messages.sessionMesgs[0].timestamp);
  });
});
test('malformed archived entries are filtered without breaking otherwise valid history',()=>withApp(undefined,a=>{
  a.run(`S=normalizeState({...S,archives:[{id:'old',startDate:'2026-01-01',logs:{w1d0:{'${bench}':null},bad:[]},sessions:{w1d0:null}}]});go('stats')`);assert.equal(a.errors.length,0);assert.equal(a.run('allHistory().length'),0);
}));
test('session artwork, exercise photos and quick cues match their intended movements',()=>withApp(undefined,a=>{
  a.run(`for(let d=0;d<7;d++){const p=planFor(1,d);if(!artwork(p).includes('session-'+p.key+'-v13.png'))throw Error('Wrong session art');}for(const id of Object.keys(EXERCISES)){if(!QUICK_CUES[id])throw Error('Missing quick cues '+id);for(const img of EXERCISES[id].images){if(!img.includes('/'+id+'/')&&!['Barbell_Hip_Thrust','Dumbbell_Shoulder_Press','Seated_Dumbbell_Press'].includes(id))throw Error('Unexpected image mapping '+id);}}`);
}));

test('Today follows moved sessions, while explicitly browsing another day remains possible',()=>withApp(undefined,a=>{
  a.run("const moved=new Date();moved.setDate(moved.getDate()+14);moveSession('w1d0',ymd(moved));go('today')");assert.match(a.doc.querySelector('.training-main h2').textContent,/Pull/);
  a.click('[data-select-day="0"]');assert.match(a.doc.querySelector('.training-main h2').textContent,/Push/);a.click('[data-day-step="7"]');assert.equal(a.run('selectedDayNumber()'),7);
}));
test('review gives the next programmed target after successful top-of-range sets',()=>withApp(undefined,a=>{
  a.run(`S.logs.w1d0={'${bench}':Array.from({length:3},()=>({w:'100',r:'8',done:true}))}`);assert.match(a.run(`nextExerciseAdvice('${bench}','w1d0')`),/105 lb/);
  assert.match(a.run("exerciseImage('Plank')"),/Plank\/1.jpg/);
}));

test('every training day has preparation for its actual movement patterns, with no lifting warmup on rest days',()=>withApp(undefined,a=>{
  const expected={0:['shoulders','slides'],1:['hinge','reach'],2:['ankles','squat','hinge'],4:['shoulders','slides','reach'],5:['ankles','squat','lunge','bridge']};
  for(let w=1;w<=12;w++)for(let d=0;d<7;d++){
    const prep=a.run(`warmupPlan(planFor(${w},${d}),'w${w}d${d}')`);
    if([3,6].includes(d)){assert.equal(prep.drills.length,0);assert.equal(prep.practice.length,0);continue;}
    assert.equal(prep.drills[0].id,'pulse');
    for(const id of expected[d])assert.ok(prep.drills.some(x=>x.id===id),`Missing ${id} on day ${d}`);
    assert.equal(new Set(prep.practice.map(e=>e.id)).size,prep.practice.length);
  }
  a.run('openDay(1,2)');assert.match(a.doc.querySelector('.warmup-card').textContent,/Warm up for leg day/);
  a.run('openDay(1,3)');assert.equal(a.doc.querySelector('.warmup-card'),null);
}));
test('practice buttons add editable light sets once, with honest totals and no invented loads',()=>withApp(undefined,a=>{
  a.run('openDay(1,0)');a.click(`[data-practice-sets="w1d0|${bench}"]`);
  assert.equal(a.doc.querySelector(`[aria-label="Barbell Bench Press warm-up 1 weight in lb"]`).value,'');
  assert.equal(a.doc.querySelector(`[aria-label="Barbell Bench Press warm-up 1 reps"]`).value,'5');
  a.run(`addPracticeSets('w1d0','${bench}');addPracticeSets('w1d0','${bench}')`);
  assert.equal(a.run(`S.logs.w1d0['${bench}'].filter(s=>s.kind==='warmup').length`),2);
  assert.equal(a.run('dayProgress(planFor(1,0)).tot'),19);
  assert.equal(a.run('dayProgress(planFor(1,0)).done'),0);
  a.input('[data-field="w"]','45');a.click('[data-ck]');
  assert.equal(a.run('dayProgress(planFor(1,0)).done'),0);assert.equal(a.run('!!S.restTimer'),false);
  assert.equal(a.run(`currentWorkoutSuggestion('${bench}',planFor(1,0).ex[0],'w1d0')`),null);
  assert.equal(a.run('allHistory().length'),0);assert.equal(a.errors.length,0);
}));
test('existing manual warmups are reused and bodyweight practice avoids loading prescriptions',()=>withApp(undefined,a=>{
  a.run(`openDay(1,0);addSet('w1d0','${bench}','warmup');S.logs.w1d0['${bench}'][0].w='35';addPracticeSets('w1d0','${bench}')`);
  assert.equal(a.run(`S.logs.w1d0['${bench}'].filter(s=>s.kind==='warmup').length`),2);
  assert.equal(a.run(`S.logs.w1d0['${bench}'][0].w`),'35');
  a.run("openDay(1,1);addPracticeSets('w1d1','Pullups')");
  assert.equal(a.run("S.logs.w1d1.Pullups.filter(s=>s.kind==='warmup').length"),1);
  assert.equal(a.run("S.logs.w1d1.Pullups[0].r"),'2');assert.match(a.doc.querySelector('.practice-guidance').textContent,/assistance/);
  assert.equal(a.doc.querySelector('.exercise-title b').textContent,'Pull-Ups');
}));
test('changing a movement updates practice and its photo while completed warmups stay with the original lift',()=>withApp(undefined,a=>{
  a.run(`openDay(1,0);addPracticeSets('w1d0','${bench}');S.logs.w1d0['${bench}'][0]={w:'45',r:'5',kind:'warmup',done:true};setExerciseSwap('w1d0','${bench}','Dumbbell_Bench_Press');addPracticeSets('w1d0','Dumbbell_Bench_Press');`);
  assert.equal(a.run(`S.logs.w1d0['${bench}'].length`),1);assert.equal(a.run(`S.logs.w1d0['${bench}'][0].done`),true);
  assert.equal(a.run("warmupPlan(planFor(1,0),'w1d0').practice[0].id"),'Dumbbell_Bench_Press');
  assert.match(a.doc.querySelector('.exercise-thumb').src,/Dumbbell_Bench_Press/);
  assert.equal(a.run('dayProgress(planFor(1,0)).tot'),19);assert.equal(a.run('dayProgress(planFor(1,0)).done'),0);
  a.run(`setExerciseSwap('w1d0','${bench}',null);addPracticeSets('w1d0','${bench}')`);
  assert.equal(a.run(`S.logs.w1d0['${bench}'].filter(s=>s.kind==='warmup').length`),2);
}));
test('warmup checklist and edited practice survive reload and backup without duplicating sets',()=>{
  let saved;
  withApp(undefined,a=>{
    a.run('openDay(1,2)');a.click('[data-warmup-check="w1d2|ankles"]');
    assert.equal(a.run('!!S.sessions.w1d2.startedAt'),true);
    a.click('[data-practice-sets="w1d2|Barbell_Squat"]');a.input('[data-field="w"]','45');a.input('[data-field="r"]','4');
    saved=a.w.localStorage.getItem('fitlab_v1');
  });
  withApp(saved,a=>{
    a.run("S=validateBackup(JSON.stringify(backupPayload()));openDay(1,2);addPracticeSets('w1d2','Barbell_Squat')");
    assert.equal(a.run('S.sessions.w1d2.warmupPrep.ankles'),true);assert.equal(a.run('S.sessions.w1d2.warmupExpanded'),false);
    assert.equal(a.run('S.logs.w1d2.Barbell_Squat[0].w'),'45');assert.equal(a.run('S.logs.w1d2.Barbell_Squat[0].r'),'4');
    assert.equal(a.run("S.logs.w1d2.Barbell_Squat.filter(s=>s.kind==='warmup').length"),2);
  });
});
test('shortening, reordering, and replacing patterns keep preparation aligned with the remaining workout',()=>withApp(undefined,a=>{
  a.run("shortSession('w1d0',20)");assert.equal(a.run("warmupPlan(planFor(1,0),'w1d0').drills.some(d=>d.id==='slides')"),false);
  assert.equal(a.run("warmupPlan(planFor(1,0),'w1d0').drills[0].id"),'pulse');
  a.run(`setExerciseSwap('w1d0','${bench}','Dumbbell_Bench_Press')`);assert.equal(a.run("workoutExercises(planFor(1,0),'w1d0')[0].sets"),2);
  a.run("shortSession('w1d0',0);setExerciseSwap('w1d1','Barbell_Deadlift','Barbell_Hip_Thrust')");
  assert.equal(a.run("warmupPlan(planFor(1,1),'w1d1').drills.some(d=>d.id==='bridge')"),true);
  assert.equal(a.run("warmupPlan(planFor(1,1),'w1d1').drills.some(d=>d.id==='hinge')"),false);
  a.run(`moveBlock('w1d0','Incline_Dumbbell_Press',-1)`);assert.equal(a.run("warmupPlan(planFor(1,0),'w1d0').practice[0].id"),'Incline_Dumbbell_Press');
}));
test('time estimates include preparation and practice but completed working sessions have no time left',()=>withApp(undefined,a=>{
  assert.ok(a.run("workoutTimeEstimate(planFor(1,0),'w1d0').total")>a.run("Math.ceil(workoutExercises(planFor(1,0),'w1d0').reduce((s,e)=>s+estimateSetSeconds(e,e.sets),0)/60)"));
  const estimate=a.run("workoutTimeEstimate(planFor(1,0),'w1d0').remaining");a.run("sessionFor('w1d0').warmupExpanded=false");assert.equal(a.run("workoutTimeEstimate(planFor(1,0),'w1d0').remaining"),estimate);
  a.run(`for(const e of workoutExercises(planFor(1,0),'w1d0'))setsFor('w1d0',e.id,e.sets,'20','8').forEach(s=>s.done=true)`);
  assert.equal(a.run("workoutTimeEstimate(planFor(1,0),'w1d0').remaining"),0);
}));
test('malformed preparation state is ignored and checked steps do not leak to another session',()=>withApp(undefined,a=>{
  a.run("S.sessions.w1d0={warmupExpanded:'yes',warmupPrep:{pulse:'yes',shoulders:true,unknown:true}};S=normalizeState(S)");
  assert.equal(a.run('S.sessions.w1d0.warmupExpanded'),undefined);
  assert.equal(a.run('JSON.stringify(S.sessions.w1d0.warmupPrep)'),'{"shoulders":true}');
  a.run('openDay(2,0)');assert.equal(a.doc.querySelectorAll('[data-warmup-check][aria-pressed="true"]').length,0);
}));

test('the visible Start rest button starts the exercise countdown and +30s extends its deadline',()=>withApp(undefined,a=>{
  a.run('openDay(1,0)');assert.match(a.doc.querySelector('[data-rest]').textContent,/Start rest · 2:00/);a.click('[data-rest]');
  assert.equal(a.doc.querySelector('#rtnum').textContent,'2:00');assert.equal(a.doc.querySelector('#rtlabel').textContent,'Barbell Bench Press');
  const ends=a.run('S.restTimer.endsAt');a.click('#rtadd');assert.equal(a.run('S.restTimer.endsAt'),ends+30000);
  a.click('#rtskip');assert.equal(a.run('!!S.restTimer'),false);assert.equal(a.doc.querySelector('#restbar').classList.contains('show'),false);assert.equal(a.run('dayProgress(planFor(1,0)).done'),0);
}));
test('rest completion alerts once, remains visible through reload, and Continue does not log a set',()=>{
  let saved;
  withApp(undefined,a=>{
    a.run("let alerts=[];playRestSound=id=>alerts.push(id);startRest(30,'Squat');S.restTimer.endsAt=Date.now()-1000;tickRest();tickRest()");
    assert.equal(a.run('alerts.length'),1);assert.equal(a.run('rtInt'),null);assert.equal(a.doc.querySelector('#rtstate').textContent,'Rest complete');
    assert.equal(a.doc.querySelector('#rtskip').textContent,'Continue');saved=a.w.localStorage.getItem('fitlab_v1');
  });
  withApp(saved,a=>{
    assert.equal(a.doc.querySelector('#restbar').classList.contains('ready'),true);
    a.click('#rtskip');assert.equal(a.doc.querySelector('#restbar').classList.contains('show'),false);assert.equal(a.run('!!S.restReady'),false);assert.equal(a.run('dayProgress(planFor(1,0)).done'),0);
  });
});
test('a finished rest can be extended and an expired restored timer immediately shows completion',()=>{
  let saved;
  withApp(undefined,a=>{a.run("startRest(30,'Pull-ups');S.restTimer.endsAt=Date.now()-1000;save()");saved=a.w.localStorage.getItem('fitlab_v1');});
  withApp(saved,a=>{
    assert.equal(a.doc.querySelector('#restbar').classList.contains('ready'),true);a.click('#rtadd');
    assert.equal(a.run('!!S.restReady'),false);assert.ok(a.run('restSecondsLeft()')>=29);assert.equal(a.doc.querySelector('#rtlabel').textContent,'Pull-ups');
  });
});
function fakeAudio(a){
  a.run(`let tones=[],resumes=0;window.AudioContext=class{
    constructor(){this.state='suspended';this.currentTime=10;this.destination={};}
    resume(){resumes++;this.state='running';return Promise.resolve();}
    createOscillator(){const tone={frequency:null,starts:[],stops:[],ramps:[]};tones.push(tone);return {frequency:{set value(v){tone.frequency=v;}},connect(){},disconnect(){},start(t){tone.starts.push(t);},stop(t){tone.stops.push(t);}};}
    createGain(){return {connect(){},disconnect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}};}
  };`);
}
test('enabled rest sound creates a three-tone chime and mute cancels it while preserving visual alerts',async()=>{
  const a=app();try{
    fakeAudio(a);await a.run('armSound()');assert.equal(a.run('resumes'),1);
    a.run("startRest(30,'Bench');S.restTimer.endsAt=Date.now()-1000;tickRest();tickRest()");
    assert.equal(a.run('tones.length'),3);assert.equal(a.run('JSON.stringify(tones.map(t=>t.frequency))'),'[660,880,1046]');
    assert.ok(a.run('tones.every(t=>t.stops[0]>t.starts[0])'));assert.ok(a.run('tones[2].starts[0]>tones[1].starts[0]'));
    await a.run('toggleRestSound()');assert.equal(a.run('S.preferences.sound'),false);assert.ok(a.run('tones.every(t=>t.stops.length===2)'));
    a.run("startRest(30,'Bench');S.restTimer.endsAt=Date.now()-1000;tickRest()");assert.equal(a.run('tones.length'),3);assert.equal(a.doc.querySelector('#restbar').classList.contains('ready'),true);
  }finally{a.close();}
});
test('the sound-test control enables a muted preference, plays the chime and survives reload',async()=>{
  const a=app({preferences:{sound:false}});let saved;
  try{
    fakeAudio(a);a.run('openDay(1,0)');assert.match(a.doc.querySelector('.rest-options [data-test-rest-sound]').textContent,/Enable & test/);
    a.click('.rest-options [data-test-rest-sound]');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(a.run('tones.length'),3);assert.equal(a.doc.querySelector('.rest-options [data-rest-sound]').textContent,'Sound on');saved=a.w.localStorage.getItem('fitlab_v1');
  }finally{a.close();}
  withApp(saved,a=>assert.equal(a.run('S.preferences.sound'),true));
});
test('sound failures and unsupported vibration do not break the countdown or completion banner',async()=>{
  const a=app();try{
    a.run("window.AudioContext=class{constructor(){throw Error('unsupported')}};navigator.vibrate=()=>{throw Error('blocked')}");
    await a.run('testRestSound()');assert.match(a.doc.querySelector('#toast').textContent,/unavailable/);
    a.run("startRest(1,'Bench');S.restTimer.endsAt=Date.now()-1;tickRest()");assert.equal(a.doc.querySelector('#restbar').classList.contains('ready'),true);assert.equal(a.errors.length,0);
  }finally{a.close();}
});
test('malformed saved timers are discarded, defaults enable sound, and an explicit mute is preserved',()=>{
  withApp({restTimer:{endsAt:'bad'},restReady:{endsAt:null}},a=>{assert.equal(a.run('!!S.restTimer||!!S.restReady'),false);assert.equal(a.run('S.preferences.sound'),true);});
  withApp({preferences:{sound:false}},a=>assert.equal(a.run('S.preferences.sound'),false));
});
test('dismissing a completed rest cancels a chime waiting for audio to resume',async()=>{
  const a=app();try{
    fakeAudio(a);await a.run('armSound()');
    a.run("let resumeAudio;audioContext.state='suspended';audioContext.resume=()=>new Promise(resolve=>{resumeAudio=()=>{audioContext.state='running';resolve();}});S.restReady={id:'pending',endsAt:Date.now()-1,label:'Bench'}");
    const pending=a.run("playRestSound('pending')");
    a.run('stopRest();resumeAudio()');assert.equal(await pending,false);assert.equal(a.run('tones.length'),0);
  }finally{a.close();}
});

/* Visual check-ins. Exact adjustment thresholds are product rules; see docs/TRAINING-SCIENCE.md. */
const FEEDBACK_MUSCLES={chest:'Chest',shoulders:'Shoulders',biceps:'Biceps',triceps:'Triceps',forearms:'Forearms',abdominals:'Abs',quadriceps:'Quads',traps:'Upper back',lats:'Lats','middle back':'Mid back','lower back':'Lower back',glutes:'Glutes',hamstrings:'Hamstrings',calves:'Calves'};
let feedbackMode='session',feedbackFrom='day',feedbackMuscle=null;
function feedbackInteger(value,min,max){return Number.isInteger(value)&&value>=min&&value<=max;}
function feedbackTimestamp(value){return Number.isFinite(value)&&value>0&&value<=Date.now()+60000;}
function normalizeBodyReports(value){
  const out={};if(!record(value))return out;
  for(const [m,r] of Object.entries(value))if(Object.hasOwn(FEEDBACK_MUSCLES,m)&&record(r)&&feedbackTimestamp(r.at)&&(feedbackInteger(r.score,0,10)||r.pain===true))out[m]={score:feedbackInteger(r.score,0,10)?r.score:null,pain:r.pain===true,at:r.at};
  return out;
}
function normalizeFeedback(value){
  const out={};if(!record(value))return out;
  for(const [dk,f] of Object.entries(value)){
    if(!/^w(?:[1-9]|1[0-2])d[0-6]$/.test(dk)||!record(f))continue;
    const item={effort:{},muscles:normalizeBodyReports(f.muscles)};
    if(feedbackInteger(f.overall,1,5))item.overall=f.overall;
    if(feedbackTimestamp(f.savedAt))item.savedAt=f.savedAt;
    if(record(f.effort))for(const [id,r] of Object.entries(f.effort))if(EXERCISES[id]&&record(r)&&feedbackInteger(r.rir,0,4)&&typeof r.signature==='string'&&r.signature.length<10000)item.effort[id]={rir:r.rir,signature:r.signature};
    out[dk]=item;
  }
  return out;
}
function normalizeRecovery(value){
  const out={muscles:normalizeBodyReports(value?.muscles)};
  if(record(value?.energy)&&feedbackInteger(value.energy.value,1,5)&&feedbackTimestamp(value.energy.at))out.energy={value:value.energy.value,at:value.energy.at};
  return out;
}
function feedbackKey(){return viewingPos?dayKey(viewingPos.week,viewingPos.dayIndex):null;}
function feedbackSignature(dk,id){return JSON.stringify((S.logs[dk]?.[id]||[]).map(s=>[cleanNumber(s.w),cleanNumber(s.r,true),s.done===true]));}
function exerciseEffort(dk,id){const r=S.feedback[dk]?.effort?.[id];return r&&r.signature===feedbackSignature(dk,id)?r.rir:null;}
function recoveryGuard(e){
  const x=EXERCISES[e.id],muscles=[...new Set([...(x?.primary||[]),...(x?.secondary||[])])];
  const reports=muscles.map(m=>({m,...S.recovery.muscles[m]})).filter(r=>r.at);
  const pain=reports.find(r=>r.pain||r.score>=7);
  if(pain)return {blocked:true,status:'pause',note:`${FEEDBACK_MUSCLES[pain.m]}: ${pain.pain?'sharp or joint pain':'severe discomfort'} reported. Pause this movement and recheck how you feel. Seek professional advice if pain persists or worsens.`,muscle:pain.m};
  const sore=reports.find(r=>r.score>=4);
  if(sore)return {hold:true,status:'hold',note:Date.now()-sore.at>48*3600000?`Recheck your ${FEEDBACK_MUSCLES[sore.m].toLowerCase()} before adding load; the discomfort report is older than 48 hours.`:`Your ${FEEDBACK_MUSCLES[sore.m].toLowerCase()} discomfort holds this exercise at its previous load. Recheck before progressing.`,muscle:sore.m};
  if(S.recovery.energy?.value<=2&&Date.now()-S.recovery.energy.at<24*3600000)return {hold:true,status:'hold',note:'Your current readiness is low. Keep your previous load and rep target today.'};
  return {};
}
function feedbackFace(value){
  const mouths=['M16 30 Q24 19 32 30','M16 28 Q24 23 32 28','M16 27 H32','M16 25 Q24 33 32 25','M15 24 Q24 37 33 24 Z'];
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="fb-face"><circle cx="24" cy="24" r="20" fill="currentColor" opacity=".12"/><circle cx="18" cy="19" r="2" fill="currentColor"/><circle cx="30" cy="19" r="2" fill="currentColor"/><path d="${mouths[value-1]}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
}
function feedbackIcon(type){
  const paths={body:'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M7 22l1-8-3 3M17 22l-1-8 3 3M8 10h8l1 5M7 15l1-5M12 15v7',ache:'M3 12c3-9 5 9 8 0s5 9 10 0',pain:'M13 2 5 14h6l-1 8 9-13h-7Z',check:'m5 12 4 4L19 6',up:'M12 20V4m-7 7 7-7 7 7',down:'M12 4v16m-7-7 7 7 7-7',hold:'M5 9h14M5 15h14',pause:'M8 4v16M16 4v16'};
  return `<svg class="fb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[type]||paths.body}"/></svg>`;
}
function feedbackLaunch(dk){return `<div class="fb-launch"><button class="btn ghost" data-open-feedback="${dk}">${feedbackFace(4)}Workout check-in</button><button class="btn ghost" data-open-recovery="1">${feedbackIcon('body')}Readiness now</button></div>`;}
function openFeedback(dk,mode='session'){
  if(mode==='session'){
    const n=dayNum(dk);if(n<0||n>=programDays())return;
    const plan=planFor(Math.floor(n/7)+1,n%7);if(plan.type!=='workout')return;
    viewingPos={week:plan.week,dayIndex:plan.dayIndex};
  }
  feedbackFrom=view==='day'?'day':'today';feedbackMode=mode;feedbackMuscle=null;go('feedback');
}
function feedbackCommit(change,focus){
  const before={feedback:JSON.parse(JSON.stringify(S.feedback)),recovery:JSON.parse(JSON.stringify(S.recovery))};
  change();
  if(!save()){S.feedback=before.feedback;S.recovery=before.recovery;return false;}
  const y=window.scrollY,extra=document.querySelector('.fb-extra-muscles')?.open;
  render();if(extra&&document.querySelector('.fb-extra-muscles'))document.querySelector('.fb-extra-muscles').open=true;
  window.scrollTo({top:y});if(focus)document.querySelector(`[data-fb-focus="${focus}"]`)?.focus({preventScroll:true});
  return true;
}
function feedbackSession(){const dk=feedbackKey();if(!dk)return null;return S.feedback[dk]||(S.feedback[dk]={effort:{},muscles:{}});}
function setFeedbackOverall(value){
  if(!feedbackInteger(value,1,5))return false;
  return feedbackCommit(()=>{if(feedbackMode==='recovery')S.recovery.energy={value,at:Date.now()};else if(feedbackSession())feedbackSession().overall=value;},`overall-${value}`);
}
function setExerciseEffort(id,rir){
  if(feedbackMode!=='session'||!viewingPos||!feedbackInteger(rir,0,4))return false;
  const dk=feedbackKey(),plan=planFor(viewingPos.week,viewingPos.dayIndex);
  if(!workoutExercises(plan,dk).some(e=>e.id===id)||!S.logs[dk]?.[id]?.some(validCompletedSet))return false;
  return feedbackCommit(()=>{feedbackSession().effort[id]={rir,signature:feedbackSignature(dk,id)};},`rir-${id}-${rir}`);
}
function feedbackBody(){return feedbackMode==='recovery'?S.recovery.muscles:S.feedback[feedbackKey()]?.muscles||{};}
function feedbackIsToday(){return viewingPos&&ymd(dateForPos(viewingPos.week,viewingPos.dayIndex))===todayISO();}
function setFeedbackBody(m,field,value){
  if(!Object.hasOwn(FEEDBACK_MUSCLES,m)||!['score','pain'].includes(field))return false;
  if(field==='score'&&!feedbackInteger(value,0,10)||field==='pain'&&typeof value!=='boolean')return false;
  return feedbackCommit(()=>{
    const reports=feedbackMode==='recovery'?S.recovery.muscles:feedbackSession()?.muscles;if(!reports)return;
    const next={score:null,pain:false,...reports[m],[field]:value,at:Date.now()};if(field==='score'&&value===0)next.pain=false;
    reports[m]=next;if(feedbackMode==='session'&&feedbackIsToday())S.recovery.muscles[m]={...next};
  },field==='score'?`score-${value}`:`kind-${value?'pain':'ache'}`);
}
function clearFeedbackBody(){
  return feedbackCommit(()=>{for(const m of Object.keys(FEEDBACK_MUSCLES)){
    const report={score:0,pain:false,at:Date.now()};
    if(feedbackMode==='recovery')S.recovery.muscles[m]=report;
    else{feedbackSession().muscles[m]=report;if(feedbackIsToday())S.recovery.muscles[m]={...report};}
  }},'body-clear');
}
function finishFeedback(){
  if(feedbackMode==='session'&&!feedbackCommit(()=>{feedbackSession().savedAt=Date.now();}))return;
  go(feedbackFrom);if(feedbackFrom==='day')requestAnimationFrame(()=>{if(viewingPos&&isWorkoutComplete(planFor(viewingPos.week,viewingPos.dayIndex)))focusWorkoutCompletion();else document.querySelector('.reviewcard')?.scrollIntoView({block:'start'});});
}
function feedbackMap(){
  const reports=feedbackBody(),groups={};let base='';
  for(const s of MAP_SHAPES){
    const shape=s.t==='c'?`<circle cx="${s.x}" cy="${s.y}" r="${s.r}"/>`:s.t==='e'?`<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}"/>`:`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}"/>`;
    if(s.m)(groups[s.m]??=[]).push(shape);else base+=shape;
  }
  return `<svg class="fb-body-map" viewBox="30 6 260 190" aria-label="Front and back muscle selector"><g class="fb-body-base">${base}</g>${Object.entries(groups).map(([m,shapes])=>{const r=reports[m],level=r?.pain||r?.score>=7?'high':r?.score>=4?'medium':r?.score!=null&&r.score>=0?'low':'unknown';return `<g role="button" tabindex="0" data-body-muscle="${m}" data-fb-focus="muscle-${m}" aria-label="${FEEDBACK_MUSCLES[m]}${r?.pain?', sharp or joint pain':r?.score!=null?`, discomfort ${r.score} of 10`:''}" aria-pressed="${feedbackMuscle===m}" class="fb-body-area ${level} ${feedbackMuscle===m?'selected':''}"><title>${FEEDBACK_MUSCLES[m]}</title>${shapes.join('')}</g>`;}).join('')}<text x="80" y="190" text-anchor="middle">Front</text><text x="240" y="190" text-anchor="middle">Back</text></svg>`;
}
function renderBodyFeedback(){
  const r=feedbackMuscle?feedbackBody()[feedbackMuscle]:null;
  return `<section class="card fb-body-card"><h2>${feedbackIcon('body')}Where did you feel it?</h2><p class="small muted">Tap a muscle, then a number. 0 = none · 10 = severe.</p>${feedbackMap()}<button class="btn ghost fb-clear" data-body-clear="1" data-fb-focus="body-clear">${feedbackIcon('check')}All areas feel okay</button>
  ${feedbackMuscle?`<div class="fb-muscle-rating"><h3>${FEEDBACK_MUSCLES[feedbackMuscle]}</h3><div class="fb-kind"><button data-body-kind="ache" data-fb-focus="kind-ache" aria-pressed="${r?.pain===false}">${feedbackIcon('ache')}Muscle ache</button><button data-body-kind="pain" data-fb-focus="kind-pain" aria-pressed="${r?.pain===true}">${feedbackIcon('pain')}Sharp / joint</button></div><div class="fb-number-scale" role="group" aria-label="${FEEDBACK_MUSCLES[feedbackMuscle]} discomfort from 0 to 10">${Array.from({length:11},(_,n)=>`<button data-body-score="${n}" data-fb-focus="score-${n}" aria-pressed="${r?.score===n}" aria-label="${FEEDBACK_MUSCLES[feedbackMuscle]} discomfort ${n} of 10">${n}</button>`).join('')}</div>${r?.pain||r?.score>=7?'<p class="fb-pain-note" role="status">Pause movements that hurt. Persistent, worsening, or sharp pain needs professional advice.</p>':''}</div>`:''}
  <details class="fb-extra-muscles"><summary>Choose a muscle by picture</summary><div class="fb-muscle-picks">${Object.keys(FEEDBACK_MUSCLES).map(m=>`<button data-body-muscle="${m}" aria-pressed="${feedbackMuscle===m}">${muscleMap([m],[])}<span>${FEEDBACK_MUSCLES[m]}</span></button>`).join('')}</div></details></section>`;
}
function nextExerciseOccurrence(id,dk){
  for(let n=dayNum(dk)+1;n<programDays();n++){const plan=planFor(Math.floor(n/7)+1,n%7),key=dayKey(plan.week,plan.dayIndex),e=workoutExercises(plan,key).find(x=>x.id===id);if(e)return {e,dk:key};}
  return null;
}
function feedbackPreview(plan,dk){
  return `<section class="card fb-next"><h2>Next time</h2><p class="small muted">Updates as you tap. Recheck your body on the workout day.</p>${workoutExercises(plan,dk).map(e=>{
    const next=nextExerciseOccurrence(e.id,dk);if(!next)return '';
    const sug=suggest(e.id,next.e,next.dk),last=(S.logs[dk]?.[e.id]||[]).filter(validCompletedSet),baseline=last.length?Math.min(...last.map(s=>entryNumber(s.w))):null;
    const direction=sug.blocked?'pause':baseline!=null&&Number(sug.weight)>baseline?'up':baseline!=null&&!blank(sug.weight)&&Number(sug.weight)<baseline?'down':'hold';
    const label=sug.blocked?'Pause & recheck':blank(sug.weight)?'Log a starting weight':`${displayNumber(sug.weight)} ${S.unit}${loadMeta(e.id).mult>1?' each':''} × ${sug.reps||next.e.reps}`;
    return `<div class="fb-next-row" data-next-ex="${e.id}"><img src="${EXERCISES[e.id].images[0]}" alt="" loading="lazy"><div><b>${esc(EXERCISES[e.id].name)}</b><span>${esc(label)}</span></div><span class="fb-direction ${direction}" aria-label="${direction==='up'?'Increase':direction==='down'?'Lighter':direction==='pause'?'Pause':'Hold or build reps'}">${feedbackIcon(direction)}</span></div>`;
  }).join('')}</section>`;
}
function feedbackScience(){return `<details class="card fb-science"><summary>Why these adjustments?</summary><p>Logged sets plus reps in reserve guide each exercise. Easy sets build reps before weight; reaching failure can suggest one lighter equipment step. Ratings are estimates, especially when returning to training.</p><p>Discomfort never earns a weight increase. Moderate discomfort holds progression; severe discomfort or sharp/joint pain pauses the recommendation until you recheck. Old reports ask for a fresh check. The exact cutoffs are conservative app rules, not a clinically validated prescription.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/31009432/" target="_blank" rel="noopener noreferrer">RIR-based training study</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/38393985/" target="_blank" rel="noopener noreferrer">Failure versus reps in reserve</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/12453160/" target="_blank" rel="noopener noreferrer">Soreness and muscle damage</a> · <a href="https://acsm.org/resistance-training-guidelines-update-2026/" target="_blank" rel="noopener noreferrer">ACSM guidance</a></p></details>`;}
function renderFeedback(){
  const recovery=feedbackMode==='recovery',dk=feedbackKey(),plan=viewingPos?planFor(viewingPos.week,viewingPos.dayIndex):null;
  if(!recovery&&(!plan||plan.type!=='workout'))return renderToday();
  const f=S.feedback[dk]||{},overall=recovery?(S.recovery.energy&&Date.now()-S.recovery.energy.at<24*3600000?S.recovery.energy.value:null):f.overall;
  const exercises=!recovery?workoutExercises(plan,dk):[],rated=exercises.filter(e=>exerciseEffort(dk,e.id)!=null).length;
  return `<div class="feedback-view"><button class="backbtn" data-feedback-close="1">${icon('back')}Back</button>${heading(recovery?'Ready for today?':'How did it feel?',recovery?'Your body now. Tap to update.':`${plan.title} · ${prettyISO(ymd(dateForPos(plan.week,plan.dayIndex)))} · Tap pictures and scales.`)}
  <section class="card"><h2>${recovery?'Energy now':'Overall feeling'}</h2><div class="fb-face-scale" role="group" aria-label="${recovery?'Readiness':'Workout feeling'} from 1 drained to 5 great">${[1,2,3,4,5].map(n=>`<button data-feedback-overall="${n}" data-fb-focus="overall-${n}" aria-label="${n} of 5, ${['drained','low','okay','good','great'][n-1]}" aria-pressed="${overall===n}">${feedbackFace(n)}<b>${n}</b></button>`).join('')}</div><div class="fb-scale-ends"><span>Drained</span><span>Great</span></div></section>
  ${!recovery?`<section class="fb-effort"><div class="section-row"><h2>Each exercise</h2><span class="pill">${rated}/${exercises.length}</span></div><p class="small muted">After your last working set, how many more good reps could you have done?</p>${exercises.map(e=>{const rir=exerciseEffort(dk,e.id),enabled=!!S.logs[dk]?.[e.id]?.some(validCompletedSet);return `<article class="card fb-exercise"><div class="fb-exercise-head"><img src="${EXERCISES[e.id].images[0]}" alt="${esc(EXERCISES[e.id].name)}" loading="lazy"><div><h3>${esc(EXERCISES[e.id].name)}</h3><span class="small muted">${enabled?'Good reps left': 'Log your sets first'}</span></div></div><div class="fb-rir-scale" role="group" aria-label="${esc(EXERCISES[e.id].name)} reps in reserve">${[0,1,2,3,4].map(n=>`<button data-feedback-rir="${e.id}|${n}" data-fb-focus="rir-${e.id}-${n}" aria-pressed="${rir===n}" aria-label="${esc(EXERCISES[e.id].name)}: ${n===4?'4 or more':n} good reps left" ${enabled?'':'disabled'}>${feedbackFace(n+1)}<b>${n===4?'4+':n}</b></button>`).join('')}</div><div class="fb-scale-ends"><span>No more</span><span>Plenty left</span></div></article>`;}).join('')}</section>`:''}
  ${renderBodyFeedback()}${!recovery?feedbackPreview(plan,dk):'<p class="small muted">This check updates affected exercise suggestions. Your workout sets stay in place.</p>'}${feedbackScience()}
  <div class="fb-save"><span class="small muted">Each tap saves on this device.</span><button class="btn primary" data-feedback-save="1">${feedbackIcon('check')}Done</button></div></div>`;
}
document.addEventListener('click',event=>{
  const c=selector=>event.target instanceof Element?event.target.closest(selector):null;
  const open=c('[data-open-feedback]');if(open){openFeedback(open.dataset.openFeedback);return;}
  if(c('[data-open-recovery]')){openFeedback(null,'recovery');return;}
  if(view!=='feedback')return;
  if(c('[data-feedback-close]')){go(feedbackFrom);return;}
  if(c('[data-feedback-save]')){finishFeedback();return;}
  const overall=c('[data-feedback-overall]');if(overall){setFeedbackOverall(Number(overall.dataset.feedbackOverall));return;}
  const rir=c('[data-feedback-rir]');if(rir){const [id,n]=rir.dataset.feedbackRir.split('|');setExerciseEffort(id,Number(n));return;}
  const muscle=c('[data-body-muscle]');if(muscle){feedbackMuscle=muscle.dataset.bodyMuscle;const y=window.scrollY;render();window.scrollTo({top:y});return;}
  const score=c('[data-body-score]');if(score){setFeedbackBody(feedbackMuscle,'score',Number(score.dataset.bodyScore));return;}
  const kind=c('[data-body-kind]');if(kind){setFeedbackBody(feedbackMuscle,'pain',kind.dataset.bodyKind==='pain');return;}
  if(c('[data-body-clear]'))clearFeedbackBody();
});
document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches?.('g[data-body-muscle]')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});

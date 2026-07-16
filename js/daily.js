const Daily = (() => {
  const $ = id => document.getElementById(id);
  const state = { fire:{}, local:{}, abdomen:{} };
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const val = id => $(id)?.value?.trim() || "";
  const selected = cls => Array.from(document.querySelectorAll(`.${cls}:checked`)).map(x=>x.value);

  function renderChoices(id, items, cls){
    const el=$(id); if(!el) return;
    el.innerHTML=items.map(x=>`<label class="choice-chip"><input type="checkbox" class="${cls}" value="${esc(x)}"><span>${esc(x)}</span></label>`).join("");
    el.querySelectorAll('input').forEach(x=>x.addEventListener('change',()=>{refreshSuggestions();refreshCaseSummary();}));
  }
  function cycle(group,key,button){
    const n=((state[group][key]||0)+1)%3;
    state[group][key]=n; button.dataset.level=String(n);
    button.classList.toggle('active',n===1); button.classList.toggle('strong',n===2);
    button.setAttribute('aria-pressed',n?'true':'false');
    const small=button.querySelector('small'); if(small) small.textContent=n===2?'強反応':n===1?'反応':'反応';
    refreshSuggestions(); refreshCaseSummary();
  }
  function renderMap(id,items,group){
    const el=$(id); if(!el) return;
    el.innerHTML=items.map(x=>`<button type="button" class="map-zone" data-level="0" data-key="${esc(x)}"><span>${esc(x)}</span><small>反応</small></button>`).join("");
    el.querySelectorAll('.map-zone').forEach(b=>b.addEventListener('click',()=>cycle(group,b.dataset.key,b)));
  }
  function renderFireMap(){
    const el=$('fireMap'); if(!el) return;
    el.innerHTML=DAILY_RULES.fireGroups.map(group=>`<section class="fire-limb"><h4>${esc(group.label)}</h4><div class="fire-points">${group.points.map(point=>{const key=`${group.label}｜${point}`;return `<button type="button" class="map-zone fire-point" data-level="0" data-key="${esc(key)}"><span>${esc(point)}</span><small>反応</small></button>`}).join('')}</div></section>`).join('');
    el.querySelectorAll('.fire-point').forEach(b=>b.addEventListener('click',()=>cycle('fire',b.dataset.key,b)));
  }
  function mapValues(group){return Object.entries(state[group]).filter(([,v])=>v>0).map(([name,level])=>({name,level}));}
  function currentUG(){return selected('beforeTest');}
  function afterUG(){return selected('afterTest');}
  function unique(a){return [...new Set(a.filter(Boolean))];}

  function refreshUGPriority(){
    const el=$('ugPriority'); if(!el) return;
    const codes=currentUG();
    if(!codes.length){el.innerHTML='<p class="small">施術前UGLABを選択すると、治療の入口と再検査が表示されます。</p>';return;}
    el.innerHTML=codes.map((code,i)=>{const u=DAILY_RULES.ugPriority[code]||{};return `<div class="ug-priority-row"><div class="ug-priority-code">${esc(code)}</div><div><b>${esc(u.name||'')}</b><strong>${i===0?'最優先：':''}${esc(u.direction||'')}</strong><span>${esc(u.intervention||'')}　→　${esc(u.retest||'')}</span></div></div>`}).join('');
  }

  function buildSuggestions(){
    const out=[];
    const fire=mapValues('fire');
    if(fire.length) out.push({source:'火穴診',text:'気水穴処置',reason:'火穴反応あり'});
    return unique(out.map(x=>`${x.source}｜${x.text}｜${x.reason}`)).map(s=>{const [source,text,reason]=s.split('｜');return{source,text,reason};});
  }
  function refreshSuggestions(){
    refreshUGPriority();
    const el=$('treatmentSuggestions'); if(!el) return;
    const items=buildSuggestions();
    const ug=currentUG();
    const ugBlock=ug.length?`<div class="engine-ug-axis"><b>UGLAB優先方向</b><span>${ug.map(c=>{const u=DAILY_RULES.ugPriority[c]||{};return `${c}${u.name||''}：${u.direction||''}`}).join(' ／ ')}</span></div>`:'';
    if(!items.length){el.innerHTML=ugBlock+'<p class="small">長野式所見から確定できる処置法候補はまだありません。</p>';return;}
    el.innerHTML=ugBlock+items.map(x=>`<button type="button" class="suggestion-button" data-method="${esc(x.text)}"><b>${esc(x.text)}</b><small>${esc(x.source)}：${esc(x.reason)}</small></button>`).join('');
    el.querySelectorAll('.suggestion-button').forEach(b=>b.addEventListener('click',()=>{
      const target=Array.from(document.querySelectorAll('.treatmentMethodChoice')).find(x=>x.value===b.dataset.method);
      if(target){target.checked=true;target.dispatchEvent(new Event('change',{bubbles:true}));}
    }));
  }
  function levelText(x){return x.level===2?'強反応':'反応';}
  function formatRegions(items){return items.length?items.map(x=>`${x.name}（${levelText(x)}）`).join('、'):'なし';}
  function ugText(codes){return codes.length?codes.map(c=>`${c}${DAILY_RULES.ugPriority[c]?.name||''}`).join('・'):'なし';}
  function refreshCaseSummary(){
    const el=$('caseSummary'); if(!el) return;
    const lines=[
      ['主訴', val('chiefComplaint') || val('currentCondition') || '未入力'],
      ['UGLAB施術前', ugText(currentUG())],
      ['UGLAB優先方向', currentUG().length?currentUG().map(c=>DAILY_RULES.ugPriority[c]?.direction).filter(Boolean).join(' → '):'未判定'],
      ['脉状', selected('pulseChoice').length?selected('pulseChoice').join('・'):'なし'],
      ['腹診', formatRegions(mapValues('abdomen'))],
      ['火穴診', formatRegions(mapValues('fire'))],
      ['局所診', formatRegions(mapValues('local'))],
      ['ルーティン処置', selected('routineChoice').length?selected('routineChoice').join('・'):'なし'],
      ['処置法', selected('treatmentMethodChoice').length?selected('treatmentMethodChoice').join('・'):'未選択'],
      ['実施手技', selected('manualTechniqueChoice').length?selected('manualTechniqueChoice').join('・'):'未選択'],
      ['UGLAB施術後', ugText(afterUG())],
      ['再検査・変化', selected('changeChoice').length?selected('changeChoice').join('・'):'未入力'],
      ['経過', val('dailyInsight') || '未入力']
    ];
    el.innerHTML=lines.map(([k,v])=>`<div class="summary-row"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('');
  }
  function collect(){
    return {
      ug:{before:currentUG(),after:afterUG(),priority:currentUG().map(c=>({code:c,...(DAILY_RULES.ugPriority[c]||{})}))},
      pulse:{selected:selected('pulseChoice'),memo:val('pulseMemo')}, abdomen:{regions:mapValues('abdomen'),memo:val('abdomenMemo')},
      fire:{regions:mapValues('fire'),memo:val('fireMemo')}, local:{regions:mapValues('local'),memo:val('localMemo')},
      routines:selected('routineChoice'), treatmentMethods:selected('treatmentMethodChoice'), suggested:buildSuggestions(),
      techniques:selected('manualTechniqueChoice'), treatmentMemo:val('dailyTreatmentMemo'), changes:selected('changeChoice'),
      beforeMemo:val('beforeFindingMemo'), afterMemo:val('afterFindingMemo'), insight:val('dailyInsight')
    };
  }
  function patient(){return {name:val('patientName'),kana:val('patientKana'),phone:val('phone'),gender:val('gender'),birth:{year:val('year'),month:val('month'),day:val('day'),hour:val('hour'),minute:val('minute')},address:val('address')};}
  function intake(){return typeof Intake!=='undefined' && Intake.collect ? Intake.collect() : {};}
  async function saveToClinic(){
    const status=$('dailySaveStatus');
    if(location.protocol==='file:'){status.textContent='サーバーから開いてください（http://localhost:3000）。';return;}
    if(!val('patientName')||!val('year')||!val('month')||!val('day')){status.textContent='患者名と生年月日を入力してください。';return;}
    const payload={visitDate:val('visitDate'),patient:patient(),intake:intake(),bodyos:{beforeUG:currentUG(),afterUG:afterUG()},daily:collect(),savedAt:new Date().toISOString()};
    status.textContent='保存中…';
    try{const r=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.error||'保存できませんでした');status.textContent=`保存しました：${j.patientId} / ${j.visitDate}`;}catch(e){status.textContent=`保存エラー：${e.message}`;}
  }
  function clearDaily(){
    if(!confirm('日報の入力だけを消しますか？')) return;
    ['pulseMemo','fireMemo','localMemo','abdomenMemo','dailyTreatmentMemo','beforeFindingMemo','afterFindingMemo','dailyInsight'].forEach(id=>{if($(id))$(id).value='';});
    document.querySelectorAll('.pulseChoice,.changeChoice,.routineChoice,.treatmentMethodChoice,.manualTechniqueChoice').forEach(x=>x.checked=false);
    ['fire','local','abdomen'].forEach(g=>{state[g]={};});
    document.querySelectorAll('.map-zone').forEach(b=>{b.dataset.level='0';b.classList.remove('active','strong');const sm=b.querySelector('small');if(sm)sm.textContent='反応';});
    refreshSuggestions(); refreshCaseSummary(); $('dailySaveStatus').textContent='';
  }
  window.addEventListener('DOMContentLoaded',()=>{
    renderChoices('pulseChoices',DAILY_RULES.pulses,'pulseChoice'); renderChoices('routineChoices',DAILY_RULES.routines,'routineChoice');
    renderChoices('treatmentMethodChoices',DAILY_RULES.treatmentMethods,'treatmentMethodChoice');
    renderChoices('manualTechniqueChoices',["推拿","鍼","灸","按腹","上部頸椎","その他"],'manualTechniqueChoice');
    renderChoices('changeChoices',DAILY_RULES.changes,'changeChoice'); renderFireMap(); renderMap('localMap',DAILY_RULES.localRegions,'local'); renderMap('abdomenMap',DAILY_RULES.abdomenRegions,'abdomen');
    document.querySelectorAll('.beforeTest,.afterTest').forEach(x=>x.addEventListener('change',()=>{refreshSuggestions();refreshCaseSummary();}));
    ['dailyTreatmentMemo','beforeFindingMemo','afterFindingMemo','dailyInsight','pulseMemo','fireMemo','localMemo','abdomenMemo'].forEach(id=>$(id)?.addEventListener('input',refreshCaseSummary));
    refreshSuggestions(); refreshCaseSummary();
  });
  return {refreshUGPriority,refreshSuggestions,refreshCaseSummary,saveToClinic,clearDaily,collect};
})();

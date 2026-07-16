const Reception = (() => {
  let queue=[];
  let mode='new';
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function isServer(){return location.protocol==='http:' || location.protocol==='https:';}
  function birth(prefix='r'){
    return {year:$(prefix+'Year')?.value||'',month:$(prefix+'Month')?.value||'',day:$(prefix+'Day')?.value||'',hour:$(prefix+'Hour')?.value||'',minute:$(prefix+'Minute')?.value||''};
  }
  function receptionData(){
    return {name:$('rName').value.trim(),kana:$('rKana').value.trim(),gender:$('rGender').value,birth:birth('r'),postal:$('rPostal').value.trim(),address:$('rAddress').value.trim(),phone:$('rPhone').value.trim(),email:$('rEmail').value.trim(),occupation:$('rOccupation').value.trim(),workplace:$('rWorkplace').value.trim(),commute:$('rCommute').value.trim()};
  }
  function setMode(next){
    mode=next;
    $('newReceptionForm')?.classList.toggle('hidden',next!=='new');
    $('revisitReceptionForm')?.classList.toggle('hidden',next!=='revisit');
    $('modeNew')?.classList.toggle('active',next==='new');
    $('modeRevisit')?.classList.toggle('active',next==='revisit');
    if($('receptionSubmitStatus')) $('receptionSubmitStatus').textContent='';
  }
  async function submit(){
    if(mode==='revisit') return submitRevisit();
    const d=receptionData(), msg=$('receptionSubmitStatus');
    if(!d.name || !d.birth.year || !d.birth.month || !d.birth.day || !d.phone){msg.textContent='氏名・生年月日・電話番号を入力してください。'; return;}
    if(!$('rConsent').checked){msg.textContent='個人情報の院内利用への同意を確認してください。'; return;}
    if(!isServer()) { msg.textContent='QR受付はBodyOSサーバーから開いた時に使えます。院のiPad入力をご利用ください。'; return; }
    try{
      const res=await fetch('/api/reception',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); const out=await res.json();
      if(!res.ok) throw new Error(out.error||'送信できませんでした。');
      showThanks('初診受付が完了しました');
    }catch(e){msg.textContent=e.message;}
  }
  async function submitRevisit(){
    const msg=$('receptionSubmitStatus');
    const d={name:$('rrName').value.trim(),birth:birth('rr')};
    if(!d.name || !d.birth.year || !d.birth.month || !d.birth.day){msg.textContent='お名前と生年月日を入力してください。';return;}
    if(!isServer()){msg.textContent='再診受付はBodyOSサーバーから開いた時に使えます。';return;}
    try{
      const res=await fetch('/api/reception/revisit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); const out=await res.json();
      if(!res.ok) throw new Error(out.error||'カルテを確認できませんでした。');
      showThanks('再診受付が完了しました');
    }catch(e){msg.textContent=e.message;}
  }
  function showThanks(title){
    $('receptionForm').classList.add('hidden');
    $('receptionThanks').classList.remove('hidden');
    if($('receptionThanksTitle')) $('receptionThanksTitle').textContent=title;
  }
  function showMode(){
    const reception=new URLSearchParams(location.search).get('mode')==='reception';
    document.body.classList.toggle('reception-mode',reception);
    $('clinicApp')?.classList.toggle('hidden',reception); $('receptionApp')?.classList.toggle('hidden',!reception);
    if(reception) setMode('new'); else initClinic();
  }
  async function initClinic(){
    if(!isServer()){
      $('qrUnavailable').classList.remove('hidden'); $('qrBox').classList.add('hidden');
      return;
    }
    try{
      const cfg=await (await fetch('/api/config')).json();
      $('receptionUrl').textContent=cfg.receptionUrl; $('receptionLink').href=cfg.receptionUrl; $('qrImage').src='/api/reception/qr?'+Date.now();
      await refresh(); setInterval(refresh,5000);
    }catch{ $('qrUnavailable').classList.remove('hidden'); }
  }
  async function refresh(){
    if(!isServer()) return;
    try{ queue=await (await fetch('/api/reception')).json(); renderQueue(); }catch{}
  }
  function renderQueue(){
    const box=$('receptionQueue');
    if(!queue.length){box.innerHTML='<p class="small">受付待ちはありません。</p>';return;}
    box.innerHTML=queue.map((p,i)=>{
      const revisit=p.receptionType==='revisit';
      const detail=revisit
        ? `再診｜${esc(p.birth.year)}年${esc(p.birth.month)}月${esc(p.birth.day)}日${p.lastVisit?`｜前回 ${esc(p.lastVisit)}`:''}`
        : `初診｜${esc(p.kana)}｜${esc(p.birth.year)}年${esc(p.birth.month)}月${esc(p.birth.day)}日｜${esc(p.phone)}`;
      return `<article class="queue-card"><div><b>${esc(p.name)} 様</b> <span class="reception-badge ${revisit?'revisit':'new'}">${revisit?'再診':'初診'}</span><div class="small">${detail}</div></div><button onclick="Reception.accept(${i})">カルテを開く</button></article>`;
    }).join('');
  }
  async function accept(i){
    const p=queue[i]; if(!p) return; Intake.applyPatient(p);
    try{await fetch('/api/reception/'+encodeURIComponent(p.id),{method:'DELETE'});}catch{}
    await refresh();
  }
  function useIPad(){ document.getElementById('step1')?.scrollIntoView({behavior:'smooth'}); document.getElementById('patientName')?.focus(); }
  window.addEventListener('DOMContentLoaded',showMode);
  return {submit,submitRevisit,setMode,refresh,accept,useIPad};
})();

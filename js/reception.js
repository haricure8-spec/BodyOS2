const Reception = (() => {
  let queue=[];
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function isClinicServer(){return location.protocol==='http:' && (location.hostname==='localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname));}
  function receptionType(){return document.querySelector('input[name="receptionType"]:checked')?.value || 'new';}
  function receptionData(){
    return {receptionType:receptionType(),name:$('rName').value.trim(),kana:$('rKana').value.trim(),gender:$('rGender').value,birth:{year:$('rYear').value,month:$('rMonth').value,day:$('rDay').value,hour:$('rHour').value,minute:$('rMinute').value},postal:$('rPostal').value.trim(),address:$('rAddress').value.trim(),phone:$('rPhone').value.trim(),email:$('rEmail').value.trim(),occupation:$('rOccupation').value.trim(),workplace:$('rWorkplace').value.trim(),commute:$('rCommute').value.trim()};
  }
  function toggleType(){
    const revisit=receptionType()==='revisit';
    document.querySelectorAll('.new-only').forEach(el=>el.classList.toggle('hidden',revisit));
    $('receptionTitle').textContent=revisit?'再診受付':'初診受付';
    $('receptionLead').textContent=revisit?'お名前と生年月日をご入力ください。':'個人情報のみご入力ください。問診は院長がお話を伺います。';
    $('rPhoneRequired').classList.toggle('hidden',revisit);
    $('receptionSubmitStatus').textContent='';
  }
  async function submit(){
    const d=receptionData(), msg=$('receptionSubmitStatus');
    if(!d.name || !d.birth.year || !d.birth.month || !d.birth.day){msg.textContent='氏名と生年月日を入力してください。'; return;}
    if(d.receptionType==='new' && !d.phone){msg.textContent='初診の方は電話番号も入力してください。'; return;}
    if(!$('rConsent').checked){msg.textContent='個人情報の院内利用への同意を確認してください。'; return;}
    if(!isClinicServer()) { msg.textContent='受付送信は院内BodyOSサーバーから開いた時に使えます。'; return; }
    try{
      const res=await fetch('/api/reception',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); const out=await res.json();
      if(!res.ok) throw new Error(out.error||'送信できませんでした。');
      $('receptionForm').classList.add('hidden'); $('receptionThanks').classList.remove('hidden');
      $('receptionThanksText').textContent=d.receptionType==='revisit'?'再診受付が完了しました。そのままお待ちください。':'初診受付が完了しました。そのままお待ちください。';
    }catch(e){msg.textContent=e.message;}
  }
  function showMode(){
    const reception=new URLSearchParams(location.search).get('mode')==='reception';
    document.body.classList.toggle('reception-mode',reception);
    $('clinicApp')?.classList.toggle('hidden',reception); $('receptionApp')?.classList.toggle('hidden',!reception);
    if(reception){ toggleType(); document.querySelectorAll('input[name="receptionType"]').forEach(x=>x.addEventListener('change',toggleType)); }
    else initClinic();
  }
  async function initClinic(){
    if(!isClinicServer()){
      $('qrUnavailable').classList.remove('hidden'); $('qrBox').classList.add('hidden');
      return;
    }
    try{
      const cfg=await (await fetch('/api/config')).json();
      $('receptionUrl').textContent=cfg.receptionUrl; $('receptionLink').href=cfg.receptionUrl; $('qrImage').src='/api/reception/qr?'+Date.now();
      if($('dataLocation')) $('dataLocation').textContent=cfg.dataDir;
      await refresh(); setInterval(refresh,5000);
    }catch{ $('qrUnavailable').classList.remove('hidden'); }
  }
  async function refresh(){
    if(!isClinicServer()) return;
    try{ queue=await (await fetch('/api/reception')).json(); renderQueue(); }catch{}
  }
  function renderQueue(){
    const box=$('receptionQueue');
    if(!queue.length){box.innerHTML='<p class="small">受付待ちはありません。</p>';return;}
    box.innerHTML=queue.map((p,i)=>`<article class="queue-card"><div><b>${esc(p.name)} 様</b> <span class="visit-badge ${p.receptionType==='revisit'?'revisit':'new'}">${p.receptionType==='revisit'?'再診':'初診'}</span><div class="small">${esc(p.kana||'')}｜${esc(p.birth.year)}年${esc(p.birth.month)}月${esc(p.birth.day)}日${p.phone?'｜'+esc(p.phone):''}</div></div><button onclick="Reception.accept(${i})">${p.receptionType==='revisit'?'カルテを開く':'問診を開始'}</button></article>`).join('');
  }
  async function accept(i){
    const p=queue[i]; if(!p) return;
    Intake.applyPatient(p);
    if(p.patientId) sessionStorage.setItem('bodyos_current_patient_id',p.patientId); else sessionStorage.removeItem('bodyos_current_patient_id');
    try{await fetch('/api/reception/'+encodeURIComponent(p.id),{method:'DELETE'});}catch{}
    await refresh();
  }
  function useIPad(){ document.getElementById('step1')?.scrollIntoView({behavior:'smooth'}); document.getElementById('patientName')?.focus(); }
  window.addEventListener('DOMContentLoaded',showMode);
  return {submit,refresh,accept,useIPad,toggleType};
})();

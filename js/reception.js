const Reception = (() => {
  let queue=[];
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function isServer(){return location.protocol==='http:' || location.protocol==='https:';}
  function receptionData(){
    return {name:$('rName').value.trim(),kana:$('rKana').value.trim(),gender:$('rGender').value,birth:{year:$('rYear').value,month:$('rMonth').value,day:$('rDay').value,hour:$('rHour').value,minute:$('rMinute').value},postal:$('rPostal').value.trim(),address:$('rAddress').value.trim(),phone:$('rPhone').value.trim(),email:$('rEmail').value.trim(),occupation:$('rOccupation').value.trim(),workplace:$('rWorkplace').value.trim(),commute:$('rCommute').value.trim()};
  }
  async function submit(){
    const d=receptionData(), msg=$('receptionSubmitStatus');
    if(!d.name || !d.birth.year || !d.birth.month || !d.birth.day || !d.phone){msg.textContent='氏名・生年月日・電話番号を入力してください。'; return;}
    if(!$('rConsent').checked){msg.textContent='個人情報の院内利用への同意を確認してください。'; return;}
    if(!isServer()) { msg.textContent='QR受付はBodyOSサーバーから開いた時に使えます。院のiPad入力をご利用ください。'; return; }
    try{
      const res=await fetch('/api/reception',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); const out=await res.json();
      if(!res.ok) throw new Error(out.error||'送信できませんでした。');
      $('receptionForm').classList.add('hidden'); $('receptionThanks').classList.remove('hidden');
    }catch(e){msg.textContent=e.message;}
  }
  function showMode(){
    const reception=new URLSearchParams(location.search).get('mode')==='reception';
    document.body.classList.toggle('reception-mode',reception);
    $('clinicApp')?.classList.toggle('hidden',reception); $('receptionApp')?.classList.toggle('hidden',!reception);
    if(!reception) initClinic();
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
    box.innerHTML=queue.map((p,i)=>`<article class="queue-card"><div><b>${esc(p.name)} 様</b><div class="small">${esc(p.kana)}｜${esc(p.birth.year)}年${esc(p.birth.month)}月${esc(p.birth.day)}日｜${esc(p.phone)}</div></div><button onclick="Reception.accept(${i})">問診を開始</button></article>`).join('');
  }
  async function accept(i){
    const p=queue[i]; if(!p) return; Intake.applyPatient(p);
    try{await fetch('/api/reception/'+encodeURIComponent(p.id),{method:'DELETE'});}catch{}
    await refresh();
  }
  function useIPad(){ document.getElementById('step1')?.scrollIntoView({behavior:'smooth'}); document.getElementById('patientName')?.focus(); }
  window.addEventListener('DOMContentLoaded',showMode);
  return {submit,refresh,accept,useIPad};
})();

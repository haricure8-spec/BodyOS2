const Intake = (() => {
  const DRAFT_KEY = 'bodyos_intake_draft_v3';
  const FIELD_IDS = [
    'patientName','patientKana','year','month','day','hour','minute','gender','postalCode','address','phone','email','occupation','workplace','commute',
    'height','weight','bloodType','bloodPressure','dominantHand','smoking','vision','familyStructure','medicalHistory','familyHistory',
    'sleepNotes','dietNotes','medicationPrescription','medicationOTC','supplements','physicalComplaint','psychologicalComplaint','stressLevel','stressCause',
    'exerciseNotes','digestiveNotes','skinNotes','allergyNotes','womenNotes','otherNotes','chiefComplaint'
  ];
  function $(id){ return document.getElementById(id); }
  function value(id){ return $(id)?.value ?? ''; }
  function set(id,v){ if($(id) && v != null) $(id).value = v; }
  function collect(){ const out={}; FIELD_IDS.forEach(id=>out[id]=value(id)); return out; }
  function saveDraft(silent=false){
    localStorage.setItem(DRAFT_KEY, JSON.stringify({savedAt:new Date().toISOString(), data:collect()}));
    if(!silent) status('問診内容をこの端末に一時保存しました。');
  }
  function loadDraft(){
    try { const row=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null'); if(!row) return; Object.entries(row.data||{}).forEach(([k,v])=>set(k,v)); status('前回の入力途中データを復元しました。'); }
    catch {}
  }
  function clearDraft(){ if(confirm('入力途中の内容を消しますか？')) { localStorage.removeItem(DRAFT_KEY); FIELD_IDS.forEach(id=>set(id,'')); status('入力内容を消しました。'); } }
  function status(msg){ const el=$('intakeStatus'); if(el) el.textContent=msg; }
  function applyPatient(p){
    set('patientName',p.name); set('patientKana',p.kana); set('gender',p.gender); set('postalCode',p.postal); set('address',p.address); set('phone',p.phone);
    set('email',p.email); set('occupation',p.occupation); set('workplace',p.workplace); set('commute',p.commute);
    set('year',p.birth?.year); set('month',String(Number(p.birth?.month||''))); set('day',String(Number(p.birth?.day||''))); set('hour',p.birth?.hour); set('minute',p.birth?.minute);
    saveDraft(true); status(`${p.name} 様の受付情報を問診票へ取り込みました。`);
    document.getElementById('step2')?.scrollIntoView({behavior:'smooth'});
  }
  function bindAutosave(){ FIELD_IDS.forEach(id=>$(id)?.addEventListener('change',()=>saveDraft(true))); }
  window.addEventListener('DOMContentLoaded',()=>{ loadDraft(); bindAutosave(); });
  return {collect,saveDraft,loadDraft,clearDraft,applyPatient};
})();

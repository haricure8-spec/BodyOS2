const Records = (() => {
  const STORAGE_KEY = "uglab_research_records_v1";
  const PATIENTS_KEY = "uglab_patient_registry_v1";
  const PATIENT_COUNTER_KEY = "uglab_patient_counter";
  const SOFTWARE_VERSION = "UGLAB-1.0-complete";
  const BODYOS_LOGIC_VERSION = "BodyOS-UG6-2026.07";

  function $(id){return document.getElementById(id);}
  function nowISO(){return new Date().toISOString();}
  function todayDate(){const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function val(id){const el=$(id); return el ? el.value.trim() : "";}
  function checked(cls){return Array.from(document.querySelectorAll("." + cls + ":checked")).map(x=>x.value);}
  function getJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch(e){return fallback;}}
  function setJSON(key,value){localStorage.setItem(key, JSON.stringify(value));}
  function getRecords(){return getJSON(STORAGE_KEY, []);}
  function setRecords(records){setJSON(STORAGE_KEY, records);}
  function getPatients(){return getJSON(PATIENTS_KEY, []);}
  function setPatients(patients){setJSON(PATIENTS_KEY, patients);}
  function nextCounter(key){let n=Number(localStorage.getItem(key)||"0")+1; localStorage.setItem(key,String(n)); return n;}
  function nextPatientId(){return "BP-" + String(nextCounter(PATIENT_COUNTER_KEY)).padStart(6,"0");}

  function patientKey(){
    const name=val("patientName").replace(/\s+/g,"");
    const gender=val("gender") || "不明";
    const y=val("year");
    const m=String(val("month")).padStart(2,"0");
    const d=String(val("day")).padStart(2,"0");
    if(!name || !y || !m || !d) return "";
    return `${name}|${gender}|${y}-${m}-${d}`;
  }

  function findExistingPatientOnly(){
    const key=patientKey();
    if(!key) return null;
    return getPatients().find(p=>p.patientKey===key) || null;
  }

  function findOrCreatePatient(){
    const key=patientKey();
    if(!key) return { patientId:"", isNew:false, patientKey:"" };
    const patients=getPatients();
    let patient=patients.find(p=>p.patientKey===key);
    if(!patient){
      patient={
        patientId:nextPatientId(),
        patientKey:key,
        name:val("patientName"),
        gender:val("gender") || "不明",
        birth:{year:val("year"),month:val("month"),day:val("day"),hour:val("hour"),minute:val("minute")},
        createdAt:nowISO(),
        updatedAt:nowISO()
      };
      patients.push(patient);
      setPatients(patients);
      return {...patient,isNew:true};
    }
    patient.updatedAt=nowISO();
    patient.name=val("patientName") || patient.name;
    patient.gender=val("gender") || patient.gender;
    patient.birth.hour=val("hour");
    patient.birth.minute=val("minute");
    setPatients(patients);
    return {...patient,isNew:false};
  }

  function visitNumberFor(patientId, visitDate){
    const records=getRecords().filter(r=>r.patientId===patientId);
    const sameDate=records.find(r=>r.visitDate===visitDate);
    if(sameDate) return sameDate.visitNumber || 1;
    return records.length + 1;
  }

  function makeResearchId(patientId, visitNumber){
    if(!patientId) return "";
    return `${patientId}-V${String(visitNumber).padStart(3,"0")}`;
  }

  function currentResult(){
    if(typeof App !== "undefined" && App.getResult) return App.getResult();
    return null;
  }

  function toggleResearchMode(){
    const on=$("researchMode")?.checked;
    const box=$("researchOnly");
    if(box) box.classList.toggle("hidden", !on);
    if(on) checkQuality(false);
  }

  function requiredCheck(){
    const result=currentResult();
    const before=checked("beforeTest");
    const after=checked("afterTest");
    const missing=[];
    const warnings=[];
    if(!val("patientName")) missing.push("患者名");
    if(!val("year") || !val("month") || !val("day")) missing.push("生年月日");
    if(!result) missing.push("命式作成");
    if(!val("chiefComplaint")) missing.push("主訴");
    if(before.length===0) missing.push("施術前BodyOS");
    if(after.length===0) missing.push("施術後BodyOS");
    if(!val("homeCare")) missing.push("セルフケア");
    if(!val("nextCheck")) missing.push("次回確認");
    if(!val("outcome")) warnings.push("予後評価が未評価");
    if(before.length && after.length && before.join("・")===after.join("・")) warnings.push("施術前後が同じです。入力漏れでなければOK");
    const total=8;
    const score=Math.max(0, Math.round(((total-missing.length)/total)*100));
    return {ok:missing.length===0, missing, warnings, score};
  }

  function checkQuality(showAlert=true){
    const q=requiredCheck();
    const patient=findExistingPatientOnly();
    const el=$("qualityStatus");
    if(el){
      let patientNote="";
      if(patient) patientNote=`<br><span class="quality-ok">継続患者：${patient.patientId}</span>`;
      else if(patientKey()) patientNote=`<br><span class="quality-warn">新規患者として登録予定</span>`;
      if(q.ok){
        el.className="quality-status quality-ok";
        el.innerHTML=`保存可能：${q.score}%${patientNote}` + (q.warnings.length ? `<br><span class="quality-warn">確認：${q.warnings.join(" / ")}</span>` : "");
      }else{
        el.className="quality-status quality-ng";
        el.innerHTML=`保存できません：${q.score}%<br>不足：${q.missing.join(" / ")}${patientNote}`;
      }
    }
    if(showAlert && !q.ok) alert("保存できません\n\n不足項目:\n・" + q.missing.join("\n・"));
    return q;
  }

  function collect(){
    const result=currentResult();
    if(!result) throw new Error("命式を作成してから保存してください。");
    const visitDate=val("visitDate") || todayDate();
    const patient=findOrCreatePatient();
    const visitNumber=visitNumberFor(patient.patientId, visitDate);
    const researchId=makeResearchId(patient.patientId, visitNumber);
    const counts=BodyOS.fiveElements(result.pillars);
    const ug=BodyOS.ugFromFive(counts);
    const before=checked("beforeTest");
    const after=checked("afterTest");
    const care=BodyOS.care(after.length ? after : before.length ? before : ug.predicted);
    if($("researchId")) $("researchId").value=researchId;
    return {
      researchId, patientId:patient.patientId, patientKey:patient.patientKey, visitNumber, isNewPatient:patient.isNew,
      createdAt:nowISO(), visitDate, softwareVersion:SOFTWARE_VERSION, bodyosLogicVersion:BODYOS_LOGIC_VERSION,
      dataQuality:checkQuality(false),
      patient:{name:val("patientName"),kana:val("patientKana"),gender:val("gender"),birth:{year:val("year"),month:val("month"),day:val("day"),hour:val("hour"),minute:val("minute")},postal:val("postalCode"),address:val("address"),phone:val("phone"),email:val("email"),occupation:val("occupation"),workplace:val("workplace"),commute:val("commute")},
      intake:(typeof Intake!=="undefined"&&Intake.collect)?Intake.collect():{},
      chiefComplaint:val("chiefComplaint"),
      meishiki:{pillars:result.pillars,input:result.input,detail:{lichun:result.detail?.yearP?.lichun||null,monthTerm:result.detail?.monthP?.monthInfo||null}},
      fiveElements:counts, prediction:ug.predicted, beforeUG:before, afterUG:after,
      treatmentMemo:val("treatmentMemo"), selfCare:val("homeCare"), nextCheck:val("nextCheck"), outcome:val("outcome"),
      autoCare:{codes:care.codes, theme:care.theme, summary:care.summary, care:care.care, next:care.next, focus:care.focus}
    };
  }

  function save(){
    if(!$("researchMode")?.checked){
      alert("研究モードがOFFです。\n保存したい時だけ研究モードをONにしてください。");
      return;
    }
    const quality=checkQuality(true);
    if(!quality.ok) return;
    try{
      const record=collect();
      const records=getRecords();
      const idx=records.findIndex(r=>r.patientId===record.patientId && r.visitDate===record.visitDate);
      if(idx>=0) records[idx]=record; else records.push(record);
      setRecords(records);
      renderStatus(record,records);
      const msg=record.isNewPatient
        ? `保存しました\n\n新規患者ID: ${record.patientId}\n研究ID: ${record.researchId}`
        : `保存しました\n\n継続患者ID: ${record.patientId}\n来院回数: ${record.visitNumber}\n研究ID: ${record.researchId}`;
      alert(msg);
    }catch(e){alert(e.message || String(e));}
  }

  function renderStatus(record,records){
    if($("recordStatus")) $("recordStatus").textContent=`保存件数：${records.length}件 / 患者ID：${record.patientId} / 来院回数：${record.visitNumber}`;
    if($("recordPreview")) $("recordPreview").textContent=JSON.stringify(record,null,2);
  }

  function download(filename,text,mime){
    const blob=new Blob([text],{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON(){
    download("uglab_research_database.json", JSON.stringify({exportedAt:nowISO(), patients:getPatients(), records:getRecords()}, null, 2), "application/json");
  }

  function csvEscape(v){
    if(v==null) return "";
    const s=Array.isArray(v) ? v.join("・") : String(v);
    return '"' + s.replace(/"/g,'""') + '"';
  }

  function exportCSV(){
    const records=getRecords();
    const headers=["patientId","researchId","visitNumber","createdAt","visitDate","softwareVersion","bodyosLogicVersion","qualityScore","patientName","gender","birthYear","birthMonth","birthDay","birthHour","birthMinute","chiefComplaint","yearPillar","monthPillar","dayPillar","hourPillar","wood","fire","earth","metal","water","prediction","beforeUG","afterUG","treatmentMemo","selfCare","nextCheck","outcome","autoSummary"];
    const rows=records.map(r=>[r.patientId,r.researchId,r.visitNumber,r.createdAt,r.visitDate,r.softwareVersion,r.bodyosLogicVersion,r.dataQuality?.score,r.patient?.name,r.patient?.gender,r.patient?.birth?.year,r.patient?.birth?.month,r.patient?.birth?.day,r.patient?.birth?.hour,r.patient?.birth?.minute,r.chiefComplaint,r.meishiki?.pillars?.year,r.meishiki?.pillars?.month,r.meishiki?.pillars?.day,r.meishiki?.pillars?.hour,r.fiveElements?.["木"],r.fiveElements?.["火"],r.fiveElements?.["土"],r.fiveElements?.["金"],r.fiveElements?.["水"],r.prediction,r.beforeUG,r.afterUG,r.treatmentMemo,r.selfCare,r.nextCheck,r.outcome,r.autoCare?.summary]);
    const csv=[headers.map(csvEscape).join(","), ...rows.map(row=>row.map(csvEscape).join(","))].join("\n");
    download("uglab_research_records.csv", csv, "text/csv");
  }

  function deleteCurrentPatient(){
    const key=patientKey();
    if(!key){alert("患者名・生年月日・性別が分からないため削除できません。"); return;}
    const patient=getPatients().find(p=>p.patientKey===key);
    if(!patient){alert("この患者の保存データは見つかりません。"); return;}
    const count=getRecords().filter(r=>r.patientId===patient.patientId).length;
    if(!confirm(`この患者の研究データを削除しますか？\n\n患者ID: ${patient.patientId}\n記録数: ${count}件\n\nこの操作は元に戻せません。`)) return;
    if(!confirm("本当に削除しますか？\n\n削除前に必要ならJSON/CSV出力でバックアップしてください。")) return;
    setPatients(getPatients().filter(p=>p.patientId!==patient.patientId));
    setRecords(getRecords().filter(r=>r.patientId!==patient.patientId));
    if($("researchId")) $("researchId").value="";
    if($("recordStatus")) $("recordStatus").textContent=`患者ID ${patient.patientId} のデータを削除しました。`;
    if($("recordPreview")) $("recordPreview").textContent="";
    checkQuality(false);
    alert("この患者の研究データを削除しました。");
  }

  function deleteAllData(){
    const records=getRecords(), patients=getPatients();
    if(!confirm(`全研究データを削除しますか？\n\n患者数: ${patients.length}名\n記録数: ${records.length}件\n\nこの操作は元に戻せません。`)) return;
    const word=prompt("完全削除する場合は「削除」と入力してください。");
    if(word!=="削除"){alert("削除を中止しました。"); return;}
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PATIENTS_KEY);
    localStorage.removeItem(PATIENT_COUNTER_KEY);
    if($("researchId")) $("researchId").value="";
    if($("recordStatus")) $("recordStatus").textContent="全研究データを削除しました。";
    if($("recordPreview")) $("recordPreview").textContent="";
    if($("qualityStatus")) $("qualityStatus").textContent="未チェック";
    alert("全研究データを削除しました。");
  }


  async function saveClinic(){
    if(location.protocol!=="http:" || !(location.hostname==="localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname))){
      alert("院内PCへ保存するには start-bodyos.bat から起動し、http://localhost:3000 または院内IPで開いてください。");
      return;
    }
    try{
      const record=collect();
      const currentId=sessionStorage.getItem("bodyos_current_patient_id")||"";
      if(currentId) record.patientId=currentId;
      const res=await fetch("/api/records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(record)});
      const out=await res.json();
      if(!res.ok) throw new Error(out.error||"保存できませんでした。");
      sessionStorage.setItem("bodyos_current_patient_id",out.patientId);
      Intake.saveDraft(true);
      alert(`院内PCへ保存しました。\n\n患者ID: ${out.patientId}\n来院回数: ${out.visitNumber}\n保存先: ${out.dataDir}`);
    }catch(e){ alert(e.message||String(e)); }
  }

  async function loadClinicHistory(patientId){
    if(!patientId) return [];
    try{ const r=await fetch(`/api/records?patientId=${encodeURIComponent(patientId)}`); return r.ok?await r.json():[]; }catch{return [];}
  }
  window.addEventListener("DOMContentLoaded", toggleResearchMode);

  return {toggleResearchMode,checkQuality,save,saveClinic,loadClinicHistory,exportJSON,exportCSV,collect,getRecords,getPatients,findExistingPatientOnly,deleteCurrentPatient,deleteAllData};
})();

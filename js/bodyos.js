const BodyOS = (() => {
  const STEM_ELEMENT={"甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水"};
  const BRANCH_ELEMENT={"寅":"木","卯":"木","巳":"火","午":"火","辰":"土","戌":"土","丑":"土","未":"土","申":"金","酉":"金","亥":"水","子":"水"};
  function splitPillar(p){ if(!p || p==="不明") return {stem:"",branch:""}; return {stem:p.slice(0,1),branch:p.slice(1,2)}; }
  function fiveElements(pillars){
    const counts={"木":0,"火":0,"土":0,"金":0,"水":0};
    [pillars.year,pillars.month,pillars.day,pillars.hour].filter(x=>x && x!=="不明").forEach(p=>{
      const s=splitPillar(p);
      if(STEM_ELEMENT[s.stem]) counts[STEM_ELEMENT[s.stem]]++;
      if(BRANCH_ELEMENT[s.branch]) counts[BRANCH_ELEMENT[s.branch]]++;
    });
    return counts;
  }
  function ugFromFive(counts){
    const entries=Object.entries(counts);
    const max=entries.slice().sort((a,b)=>b[1]-a[1])[0];
    const min=entries.slice().sort((a,b)=>a[1]-b[1])[0];
    const map={"木":"①","火":"②","金":"③","土":"④","水":"⑤"};
    const predicted=[map[max[0]]];
    if(min[1]===0) predicted.push("⑥");
    return {strongest:max, weakest:min, predicted};
  }
  function checked(cls){return Array.from(document.querySelectorAll("."+cls+":checked")).map(x=>x.value);}
  function unique(arr){return Array.from(new Set((arr||[]).filter(Boolean)));}
  function currentCodes(result){
    const after=checked("afterTest");
    const before=checked("beforeTest");
    if(after.length) return unique(after);
    if(before.length) return unique(before);
    if(result){return ugFromFive(fiveElements(result.pillars)).predicted;}
    return [];
  }
  function care(codes){
    const clean=unique(codes).sort();
    const key=clean.slice(0,2).join("+");
    const combo=window.UG_COMBOS[key];
    if(combo){
      return {codes:clean, summary:combo.summary, care:combo.care, next:combo.next, focus:clean.flatMap(c=>window.UGDB[c]?.focus||[]).slice(0,3), theme:combo.theme};
    }
    let care=[],next=[],focus=[],summary=[];
    clean.slice(0,2).forEach(c=>{
      const d=window.UGDB[c]; if(!d) return;
      care.push(...d.care); next.push(...d.next); focus.push(...d.focus); summary.push(d.summary);
    });
    return {codes:clean, summary:summary.join(" "), care:unique(care).slice(0,3), next:unique(next).slice(0,3), focus:unique(focus).slice(0,3), theme:clean.map(c=>window.UGDB[c]?.name||c).join("＋")};
  }
  function patientLabel(code){return window.UGDB[code]?.patient || "整い方向";}
  function found(code){return window.UGDB[code]?.found || "身体の状態を確認しました";}
  function changed(code){return window.UGDB[code]?.changed || "身体の反応";}
  return {fiveElements,ugFromFive,checked,currentCodes,care,patientLabel,found,changed};
})();

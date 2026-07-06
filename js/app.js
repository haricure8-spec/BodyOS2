const App = (() => {
  let lastResult=null;
  function $(id){return document.getElementById(id);}
  function today(){const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function hasBirth(){return $("year").value && $("month").value && $("day").value;}
  function calc(){
    if(!hasBirth()){
      $("analysis").innerHTML='<p class="small">生年月日を入力してから命式を作成してください。</p>';
      return;
    }
    lastResult=Calendar.calc({year:$("year").value,month:$("month").value,day:$("day").value,hour:$("hour").value,minute:$("minute").value});
    const counts=BodyOS.fiveElements(lastResult.pillars);
    const ug=BodyOS.ugFromFive(counts);
    $("analysis").innerHTML=`<h2>BodyOS解析</h2>
      <div class="summary-grid">
        <div class="summary-card"><h3>UG6仮説</h3><div class="big">${ug.predicted.join("・")}</div></div>
        <div class="summary-card"><h3>命式</h3><div>${lastResult.pillars.year} / ${lastResult.pillars.month} / ${lastResult.pillars.day} / ${lastResult.pillars.hour}</div></div>
        <div class="summary-card"><h3>五行</h3><div>木:${counts["木"]} 火:${counts["火"]} 土:${counts["土"]} 金:${counts["金"]} 水:${counts["水"]}</div></div>
      </div>`;
    autoCare();
  }
  function autoCare(){
    if(!lastResult) calc();
    if(!lastResult) return;
    const rec=BodyOS.care(BodyOS.currentCodes(lastResult));
    if(!$("homeCare").value) $("homeCare").value=rec.care.join("・");
    if(!$("nextCheck").value) $("nextCheck").value=rec.next.join("・");
    if(!$("treatmentMemo").value) $("treatmentMemo").value=rec.focus.join("・")+"を確認";
    $("autoCare").innerHTML=`<div class="autocare-title">UG自動提案 ${rec.codes.join("・") || ""} ${rec.theme ? "｜"+rec.theme : ""}</div>
      <div class="autocare-list"><b>サマリー：</b>${rec.summary || ""}<br><b>セルフケア：</b>${rec.care.join("・")}<br><b>次回確認：</b>${rec.next.join("・")}</div>`;
    if(typeof Records !== "undefined" && Records.checkQuality) Records.checkQuality(false);
  }
  function beforeJudge(){ autoCare(); $("beforeResult").innerHTML="施術前："+BodyOS.checked("beforeTest").join("・"); }
  function afterJudge(){ autoCare(); $("afterResult").innerHTML="施術後："+BodyOS.checked("afterTest").join("・"); }
  function getResult(){ if(!lastResult) calc(); return lastResult; }
  window.addEventListener("DOMContentLoaded",()=>{ $("visitDate").value=today(); });
  return {calc,autoCare,beforeJudge,afterJudge,getResult};
})();

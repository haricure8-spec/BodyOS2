const App = (() => {
  let lastResult=null;
  function $(id){return document.getElementById(id);}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function today(){const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function hasBirth(){return $("year").value && $("month").value && $("day").value;}
  function renderCore(plan,result){
    const bp=plan.blueprint, env=plan.environment, term=env.term?.name || "節気不明";
    const counts=bp.counts;
    $("analysis").innerHTML=`<h2>BodyOS</h2>
      <div class="os-grid">
        <article class="os-card"><div class="os-kicker">Blueprint OS｜設計図</div><h3>${esc(bp.strong)}｜${esc(bp.strongData?.title||"")}</h3><p>${esc(bp.strongData?.tendency||"")}</p><div class="os-note">弱くなりやすい力：${esc(bp.weak)}</div></article>
        <article class="os-card"><div class="os-kicker">Environment OS｜環境</div><h3>${esc(term)}｜${esc(env.season)}</h3><p>${esc(env.data?.message||"")}</p><div class="os-note">${esc(env.data?.food||"")}</div></article>
        <article class="os-card"><div class="os-kicker">Current OS｜現在地</div><h3>${plan.current.codes.length?esc(plan.current.codes.join("・")):"正常を確認"}</h3><p>${esc(plan.labActive?plan.current.summary:"LAB未入力のため、設計図からの仮説を表示しています。")}</p><div class="os-note">UG6仮説：${esc(BodyOS.ugFromFive(counts).predicted.join("・"))}</div></article>
        <article class="os-card care-card"><div class="os-kicker">Care OS｜今日の養生</div><h3>${plan.labActive?"今の状態を優先":"設計図と季節から"}</h3><p><b>食養：</b>${esc(plan.food.join("・"))}</p><p><b>暮らし：</b>${esc(plan.life.join("・"))}</p></article>
      </div>
      <details class="os-details"><summary>命式と五行を確認</summary><div class="summary-grid">
        <div class="summary-card"><h3>命式</h3><div>${esc(result.pillars.year)} / ${esc(result.pillars.month)} / ${esc(result.pillars.day)} / ${esc(result.pillars.hour)}</div></div>
        <div class="summary-card"><h3>五行</h3><div>木:${counts["木"]} 火:${counts["火"]} 土:${counts["土"]} 金:${counts["金"]} 水:${counts["水"]}</div></div>
        <div class="summary-card"><h3>設計図の注意</h3><div>${esc(bp.strongData?.caution||"")}</div></div>
      </div></details>`;
  }
  function calc(){
    if(!hasBirth()){ $("analysis").innerHTML='<p class="small">生年月日を入力してから命式を作成してください。</p>'; return; }
    try{
      lastResult=Calendar.calc({year:$("year").value,month:$("month").value,day:$("day").value,hour:$("hour").value,minute:$("minute").value});
      renderCore(BodyOS.carePlan(lastResult),lastResult);
      autoCare();
    }catch(e){ $("analysis").innerHTML=`<p class="error">${esc(e.message||e)}</p>`; }
  }
  function autoCare(){
    if(!lastResult) calc();
    if(!lastResult) return;
    const rec=BodyOS.care(BodyOS.currentCodes(lastResult));
    const plan=BodyOS.carePlan(lastResult);
    if(!$("homeCare").value) $("homeCare").value=(rec.care.length?rec.care:plan.life).join("・");
    if(!$("nextCheck").value) $("nextCheck").value=rec.next.join("・");
    if(!$("treatmentMemo").value) $("treatmentMemo").value=rec.focus.join("・")+(rec.focus.length?"を確認":"");
    $("autoCare").innerHTML=`<div class="autocare-title">Treatment OS ${esc(rec.codes.join("・"))} ${rec.theme?"｜"+esc(rec.theme):""}</div>
      <div class="autocare-list"><b>現在地：</b>${esc(rec.summary||"LABを入力すると、今の状態を優先して提案します。")}<br><b>セルフケア：</b>${esc((rec.care.length?rec.care:plan.life).join("・"))}<br><b>食養：</b>${esc(plan.food.join("・"))}<br><b>次回確認：</b>${esc(rec.next.join("・"))}</div>`;
    renderCore(plan,lastResult);
    if(typeof Records!=="undefined" && Records.checkQuality) Records.checkQuality(false);
  }
  function beforeJudge(){autoCare(); $("beforeResult").innerHTML="施術前："+esc(BodyOS.checked("beforeTest").join("・"));}
  function afterJudge(){autoCare(); $("afterResult").innerHTML="施術後："+esc(BodyOS.checked("afterTest").join("・"));}
  function getResult(){if(!lastResult) calc(); return lastResult;}
  window.addEventListener("DOMContentLoaded",()=>{
    $("visitDate").value=$("visitDate").value||today();
    const fill=(id,start,end,pad=false)=>{const el=$(id); if(!el) return; for(let n=start;n<=end;n++){const o=document.createElement("option");o.value=String(n);o.textContent=pad?String(n).padStart(2,"0"):String(n);el.appendChild(o);}};
    fill("month",1,12); fill("day",1,31); fill("hour",0,23,true); fill("minute",0,59,true);
    const tests=[['①','止まれない'],['②','上に浮く'],['③','外に漏れる'],['④','時間が合わない'],['⑤','頭に集まる'],['⑥','受け取れない']];
    const render=(id,cls)=>{const el=$(id); if(el) el.innerHTML=tests.map(([c,n])=>`<div class="ug6-card"><label><input type="checkbox" class="${cls}" value="${c}">${c}${n}</label></div>`).join('');};
    render("beforeTests","beforeTest");render("afterTests","afterTest");
    if(typeof Intake!=="undefined") Intake.loadDraft();
  });
  return {calc,autoCare,beforeJudge,afterJudge,getResult};
})();

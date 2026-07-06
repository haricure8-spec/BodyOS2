const Reports = (() => {
  function val(id, fallback=""){return document.getElementById(id)?.value.trim() || fallback;}
  function today(){const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function split(text){return text.split(/[、,・]/).map(x=>x.trim()).filter(Boolean).slice(0,3);}
  function checks(items,mark){return items.map(x=>`${mark} ${x}`).join("<br>");}
  function data(){
    const result=App.getResult();
    const codes=BodyOS.currentCodes(result);
    const rec=BodyOS.care(codes);
    return {
      name:val("patientName","患者さま"),
      date:val("visitDate",today()),
      complaint:val("chiefComplaint",""),
      result,
      counts:BodyOS.fiveElements(result.pillars),
      ug:BodyOS.ugFromFive(BodyOS.fiveElements(result.pillars)),
      before:BodyOS.checked("beforeTest"),
      after:BodyOS.checked("afterTest"),
      care:rec,
      treatment:val("treatmentMemo",rec.focus.join("・")+"を確認"),
      home:val("homeCare",rec.care.join("・")),
      next:val("nextCheck",rec.next.join("・"))
    };
  }
  function printMode(mode){document.body.classList.add(mode); setTimeout(()=>{window.print(); document.body.classList.remove(mode);},100);}
  function chart(){
    const d=data(), r=d.result, counts=d.counts;
    const before=d.before.join("・")||"-", after=d.after.join("・")||"-";
    document.getElementById("chartReport").innerHTML=`<div class="report-a4">
      <div class="report-head"><div><div class="report-title">UG LAB カルテ</div><div class="small">院内保存用</div></div><div class="report-brand">Clinic Record</div></div>
      <div class="report-meta"><div><b>患者：</b>${d.name}</div><div><b>日付：</b>${d.date}</div><div><b>主訴：</b>${d.complaint||"-"}</div></div>
      <div class="report-card"><h3>命式</h3><table><tr><th>年柱</th><th>月柱</th><th>日柱</th><th>時柱</th></tr><tr><td>${r.pillars.year}</td><td>${r.pillars.month}</td><td>${r.pillars.day}</td><td>${r.pillars.hour}</td></tr></table></div>
      <div class="report-grid2"><div class="report-card"><h3>五行</h3><div class="report-list">木:${counts["木"]}　火:${counts["火"]}　土:${counts["土"]}　金:${counts["金"]}　水:${counts["水"]}</div></div><div class="report-card"><h3>UG6仮説</h3><div class="report-big">${d.ug.predicted.join("・")}</div><div class="report-list">${d.care.summary}</div></div></div>
      <div class="report-grid2"><div class="report-card"><h3>施術前</h3><div class="report-big">${before}</div></div><div class="report-card"><h3>施術後</h3><div class="report-big">${after}</div></div></div>
      <div class="report-grid2"><div class="report-card"><h3>施術メモ</h3><div class="report-list">${d.treatment}</div></div><div class="report-card"><h3>セルフケア</h3><div class="report-list">${d.home}</div></div></div>
      <div class="report-card"><h3>次回確認</h3><div class="report-list">${d.next}</div></div>
      <div class="report-card"><h3>院長メモ</h3><div class="memo-space"></div></div>
      <div class="report-footer">UG LAB｜答えは身体にある。</div>
      <div class="print-buttons no-print"><button onclick="Reports.printChart()">カルテ印刷</button></div>
      </div>`;
    showOnly("chartReport");
  }
  function patient(){
    const d=data();
    const before=d.before.length?d.before:d.ug.predicted.slice(0,2);
    const after=d.after;
    document.getElementById("patientReport").innerHTML=`<div class="report-a4">
      <div class="report-head"><div><div class="report-title">からだの変化レポート</div><div class="small">今日の身体の状態と、整ったポイントです。</div></div><div class="report-brand">UG LAB BodyOS</div></div>
      <div class="report-meta"><div><b>お名前：</b>${d.name}</div><div><b>日付：</b>${d.date}</div><div><b>主訴：</b>${d.complaint||"-"}</div></div>
      <div class="report-card"><h3>今日の身体</h3><div class="report-big">${BodyOS.patientLabel(before[0])}</div><div class="report-list">身体テストから見た今日の入り口です。</div></div>
      <div class="report-grid2"><div class="report-card"><h3>今回見つかったこと</h3><div class="report-list">${before.map(c=>"✓ "+BodyOS.found(c)).join("<br>") || "✓ 身体の状態を確認しました"}</div></div><div class="report-card"><h3>施術で変わったこと</h3><div class="report-list">${after.length?after.map(c=>"✓ "+BodyOS.changed(c)+"が変化しました").join("<br>"):"✓ 呼吸・動き・安定感を確認しました"}</div></div></div>
      <div class="report-card"><h3>今日のおうちケア</h3><div class="report-list">${split(d.home).map((x,i)=>(i+1)+". "+x).join("<br>")}</div></div>
      <div class="report-card"><h3>次回確認すること</h3><div class="report-list">${checks(split(d.next),"□")}</div></div>
      <div class="report-card"><h3>今日の身体からのひとこと</h3><div class="report-message">${d.care.summary || "身体は毎日少しずつ変わっています。"}</div></div>
      <div class="report-footer">UG LAB BodyOS｜答えは身体にある。</div>
      <div class="print-buttons no-print"><button onclick="Reports.printPatient()">患者レポート印刷</button></div>
      </div>`;
    showOnly("patientReport");
  }
  function showOnly(id){
    document.getElementById("chartReport").classList.add("hidden");
    document.getElementById("patientReport").classList.add("hidden");
    document.getElementById(id).classList.remove("hidden");
  }
  return {chart,patient,printChart:()=>printMode("print-chart"),printPatient:()=>printMode("print-patient")};
})();

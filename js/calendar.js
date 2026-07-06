const Calendar = (() => {
  const stems=["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const branches=["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const DAY_OFFSET=17;
  function mod(n,m){return ((n%m)+m)%m;}
  function daysFromCivil(y,m,d){
    y-=m<=2?1:0;
    const era=Math.floor(y/400), yoe=y-era*400;
    const doy=Math.floor((153*(m+(m>2?-3:9))+2)/5)+d-1;
    const doe=yoe*365+Math.floor(yoe/4)-Math.floor(yoe/100)+doy;
    return era*146097+doe-719468;
  }
  function pillarFromIndex(idx){
    idx=mod(idx,60);
    return {index:idx, stem:stems[idx%10], branch:branches[idx%12], pillar:stems[idx%10]+branches[idx%12]};
  }
  function dt(m,d,h,mi){return (((m*100+d)*100+h)*100+mi);}
  function cmpTerm(m,d,h,mi,t){
    const b=dt(m,d,h,mi), x=dt(t.month,t.day,t.hour,t.minute);
    return b<x ? -1 : b>x ? 1 : 0;
  }
  function term(year,name){
    const t=window.SOLAR_TERMS[year+"_"+name];
    if(!t) throw new Error("節入りデータなし: "+year+"_"+name);
    return t;
  }
  function yearPillar(y,m,d,h=0,mi=0){
    const lichun=term(y,"立春");
    const cmp=cmpTerm(m,d,h,mi,lichun);
    const solarYear=cmp<0 ? y-1 : y;
    return {...pillarFromIndex(solarYear-1984), solarYear, lichun, beforeLichun:cmp<0};
  }
  function monthInfo(y,m,d,h=0,mi=0){
    const names=["小寒","立春","啓蟄","清明","立夏","芒種","小暑","立秋","白露","寒露","立冬","大雪"];
    let selected=null;
    for(const name of names){
      const t=term(y,name);
      if(cmpTerm(m,d,h,mi,t)>=0) selected={termName:name,...t};
    }
    if(!selected) selected={termName:"大雪",...term(y-1,"大雪"),previousYear:true};
    return selected;
  }
  function monthPillar(y,m,d,h,mi,yearIndex){
    const info=monthInfo(y,m,d,h,mi);
    const num={"寅":0,"卯":1,"辰":2,"巳":3,"午":4,"未":5,"申":6,"酉":7,"戌":8,"亥":9,"子":10,"丑":11}[info.branch];
    const ys=mod(yearIndex,10);
    const first=mod((ys%5)*2+2,10);
    const stem=stems[mod(first+num,10)];
    return {pillar:stem+info.branch, stem, branch:info.branch, monthInfo:info};
  }
  function dayPillar(y,m,d){
    const serial=daysFromCivil(y,m,d);
    const idx=mod(serial+DAY_OFFSET,60);
    return {serial, offset:DAY_OFFSET, ...pillarFromIndex(idx)};
  }
  function hourPillar(dayIndex,hour){
    if(hour==="" || hour===null || Number.isNaN(Number(hour))) return {pillar:"不明", stem:"", branch:""};
    const hi=Number(hour);
    const bi=hi===23 ? 0 : Math.floor((hi+1)/2)%12;
    const ds=mod(dayIndex,10);
    const first=mod((ds%5)*2,10);
    const stem=stems[mod(first+bi,10)];
    const branch=branches[bi];
    return {pillar:stem+branch, stem, branch, hourBranchIndex:bi};
  }
  function calc(input){
    const y=Number(input.year), m=Number(input.month), d=Number(input.day);
    const hour=input.hour==="" ? "" : Number(input.hour);
    const minute=input.minute==="" ? 0 : Number(input.minute||0);
    const hForCal=hour==="" ? 0 : hour;
    const yp=yearPillar(y,m,d,hForCal,minute);
    const mp=monthPillar(y,m,d,hForCal,minute,yp.index);
    const dp=dayPillar(y,m,d);
    const hp=hourPillar(dp.index,hour);
    return {
      input:{year:y,month:m,day:d,hour,minute},
      pillars:{year:yp.pillar,month:mp.pillar,day:dp.pillar,hour:hp.pillar},
      detail:{yearP:yp,monthP:mp,dayP:dp,hourP:hp}
    };
  }
  return {calc};
})();

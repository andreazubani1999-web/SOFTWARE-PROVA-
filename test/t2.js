const {open,ok,summary}=require('./lib');
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));
  const r=await page.evaluate(()=>{
    const p=blankProject('T'); COMPUTTO_WORKS_FIX(p); appData.projects.push(p); appData.activeId=p.id; state=p; 
    const out={};
    for(const c of ['2.11','4.12','15.8','15.9']){ out[c]={work:!!findWork(c), price:getPriceForCode(c), comp:!!p.computo[c], info:!!WORK_INFO[c], rel:PRICE_RELIABILITY[c]}; }
    p.computo['2.11'].qty=1; p.computo['4.12'].qty=5; 
    out.tot=calculateProjectTotals(p).worksTotal; out.n=getWorks().reduce((a,c)=>a+c.items.length,0);
    return out;});
  console.log(JSON.stringify(r));
  for(const c of ['2.11','4.12','15.8','15.9']) ok(r[c].work&&r[c].price>0&&r[c].comp&&r[c].info&&r[c].rel,'voce '+c);
  ok(r.tot===1800+5*28,'totale con nuove voci '+r.tot); ok(r.n===128,'128 voci');
  // render computo senza errori
  await page.evaluate(()=>{ buildComputo(); });
  const html=await page.evaluate(()=>document.body.textContent.includes('Cerchiatura'));
  ok(html,'voce 2.11 visibile nel computo');
  // library
  const lib=await page.evaluate(()=>{try{buildPriceLibrary();return document.body.textContent.includes('Coordinatore della sicurezza')}catch(e){return String(e)}});
  ok(lib===true,'libreria prezzi mostra CSE '+lib);
  await page.reload(); await page.waitForTimeout(500);
  ok(await page.evaluate(()=>!!findWork('15.9')),'dopo reload ok');
  ok(errors.length===0,'nessun errore '+JSON.stringify(errors));
  await browser.close(); summary();
})();

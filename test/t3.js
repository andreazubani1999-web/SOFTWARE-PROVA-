const {open,ok,summary}=require('./lib');
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));
  await page.evaluate(()=>{ const p=blankProject('Q'); COMPUTTO_WORKS_FIX(p); appData.projects.push(p); appData.activeId=p.id; state=p; p.computo['1.1'].qty=10; p.computo['1.2'].qty=20; p.computo['7.1'].qty=30; saveApp(); });
  const msgs=[]; page.on('dialog',d=>msgs.push(d.message()));
  const T=()=>page.evaluate(()=>calculateProjectTotals(state).worksTotal);
  const t0=await T(); ok(t0>0,'totale base '+t0);
  // artigiano + preventivo
  await page.evaluate(()=>{ showPage('artisans',document.querySelectorAll('.nav button')[5]); artisanAdd(); });
  const ids=await page.evaluate(()=>{const a=artisanData.artisans[0]; quoteAdd(a.id); const q=a.quotes[0]; return {a:a.id,q:q.id};});
  await page.evaluate(({a,q})=>{ artisanSet(a,'name','Mario Edile'); quoteSet(a,q,'title','Demolizioni'); quoteSet(a,q,'amount','1500'); quoteToggleCover(a,q,'1.1',true); quoteToggleCover(a,q,'1.2',true); },ids);
  const list=await page.evaluate(()=>calculateProjectTotals(state).worksTotal);
  const listVal=await page.evaluate(()=>10*getProjectPrice(state,'1.1')+20*getProjectPrice(state,'1.2'));
  await page.evaluate(({a,q})=>quoteUseInProject(a,q),ids);
  const t1=await T();
  ok(Math.abs(t1-(t0-listVal+1500))<0.01,`totale con preventivo ${t1} = ${t0}-${listVal}+1500`);
  ok(await page.evaluate(()=>getRowTotal('1.1')===0 && state.computo['1.1'].qty===10),'voce coperta a zero ma quantità conservata');
  // doppia copertura
  const q2=await page.evaluate((a)=>{ const A=findArtisan(a); quoteAdd(a); const q=A.quotes[0]; quoteSet(a,q.id,'amount','900'); quoteToggleCover(a,q.id,'1.2',true); return q.id;},ids.a);
  msgs.length=0;
  await page.evaluate(({a,q})=>quoteUseInProject(a,q),{a:ids.a,q:q2});
  ok(msgs.join().includes('Doppia copertura'),'blocca la doppia copertura');
  ok(await page.evaluate(()=>state.quoteUses.length)===1,'un solo uso attivo');
  // preventivo senza voci
  const q3=await page.evaluate((a)=>{ const A=findArtisan(a); quoteAdd(a); const q=A.quotes[0]; quoteSet(a,q.id,'amount','100'); return q.id;},ids.a);
  msgs.length=0;
  await page.evaluate(({a,q})=>quoteUseInProject(a,q),{a:ids.a,q:q3});
  ok(msgs.join().includes('sostituisce nessuna'),'blocca preventivo senza voci coperte');
  // UI
  await page.evaluate(()=>{ showPage('computo',document.querySelectorAll('.nav button')[2]); });
  const txt=await page.evaluate(()=>document.body.textContent);
  ok(txt.includes('Coperta dal preventivo di Mario Edile'),'badge sulla voce coperta');
  ok(txt.includes('Preventivi artigiani in questo progetto'),'pannello preventivi');
  // l'artigiano ha elimina preventivo: la copia nel progetto resta
  await page.evaluate(({a,q})=>{ const A=findArtisan(a); A.quotes=A.quotes.filter(x=>x.id!==q); saveArtisanData(); },ids);
  ok(await page.evaluate(()=>state.quoteUses.length)===1 && Math.abs(await T()-t1)<0.01,'copia nel progetto indipendente');
  // persistenza
  await page.reload(); await page.waitForTimeout(500);
  ok(await page.evaluate(()=>artisanData.artisans.length)===1,'rubrica persiste');
  ok(Math.abs(await page.evaluate(()=>calculateProjectTotals(state).worksTotal)-t1)<0.01,'totale persiste dopo reload');
  // backup roundtrip
  const bk=await page.evaluate(()=>{ const b={artisanData}; return JSON.stringify(b); });
  await page.evaluate(()=>{ artisanData={artisans:[]}; saveArtisanData(); });
  await page.evaluate((b)=>restoreArtisanData(JSON.parse(b).artisanData),bk);
  ok(await page.evaluate(()=>artisanData.artisans.length)===1,'restore rubrica');
  // rimozione uso
  await page.evaluate(()=>{ state.quoteUses=[]; refreshAfterQuoteChange(); });
  ok(Math.abs(await T()-t0)<0.01,'rimosso: totale torna a listino');
  // render rubrica aperta + picker
  await page.evaluate(()=>{ showPage('artisans',document.querySelectorAll('.nav button')[5]); const a=artisanData.artisans[0]; artisanOpenId=a.id; quoteAdd(a.id); quotePickerOpen(a.id,a.quotes[0].id); });
  ok(await page.evaluate(()=>!!document.getElementById('quotePickerOverlay')),'picker aperto');
  await page.screenshot({path:'test/shot_artisans.png'});
  ok(errors.length===0,'nessun errore JS '+JSON.stringify(errors));
  await browser.close(); summary();
})();

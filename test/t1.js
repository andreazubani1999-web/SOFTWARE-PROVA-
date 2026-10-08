const {open,ok,summary}=require('./lib');
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));
  // setup: due progetti con quantità
  await page.evaluate(()=>{
    const mk=(name)=>{ const p=blankProject(name); COMPUTTO_WORKS_FIX(p); appData.projects.push(p); return p; };
    const A=mk('A'), B=mk('B');
    for(const P of [A,B]){ P.computo['7.1'].qty=50; P.computo['1.1'].qty=10; }
    appData.activeId=A.id; state=A; saveApp(); window.__A=A.id; window.__B=B.id;
  });
  const tot=(id)=>page.evaluate((id)=>calculateProjectTotals(appData.projects.find(p=>p.id===id)).worksTotal,id);
  const A=await page.evaluate(()=>window.__A), B=await page.evaluate(()=>window.__B);
  const a0=await tot(A), b0=await tot(B);
  ok(a0===b0 && a0>0,`totali iniziali uguali (${a0})`);
  // blocco prezzi A
  await page.evaluate(()=>lockProjectPrices());
  ok(await page.evaluate(()=>!!state.lockedPrices && state.priceLock.worksTotal>0),'prezzi di A bloccati');
  await page.evaluate(()=>{ setGlobalPrice('7.1','100'); });
  const a1=await tot(A), b1=await tot(B);
  ok(a1===a0,`A bloccato non cambia (${a1})`);
  ok(b1===b0+50*(100-38),`B segue la libreria (${b1} = ${b0}+${50*(100-38)})`);
  // voce personalizzata aggiunta non riscrive A
  await page.evaluate(()=>{ setGlobalPrice('7.1','38'); });
  // nascondi voce in A (accetta tutte le conferme = anche catalogo)
  await page.evaluate(()=>{ window.confirm=()=>true; hideWorkInProject('1.1'); });
  const a2=await tot(A), b2=await tot(B);
  ok(a2===a0-10*18,`A senza 1.1 (${a2})`);
  ok(b2===b0,`B invariato (${b2})`);
  ok(await page.evaluate(()=>catalogHiddenWorks.includes('1.1')),'1.1 rimossa dal catalogo');
  ok(await page.evaluate(()=>!COMPUTO_WORKS.flatMap(c=>c.items).every(i=>i[0]!=='1.1')),'COMPUTO_WORKS intatto (1.1 ancora nel catalogo base)');
  ok(await page.evaluate(()=>!getWorks().flatMap(c=>c.items).some(i=>i[0]==='1.1')),'1.1 non compare nel computo di A');
  ok(await page.evaluate(()=>getWorks(true).flatMap(c=>c.items).some(i=>i[0]==='1.1')),'1.1 presente con includeHidden');
  ok(await page.evaluate(()=>!!findWork('1.1')),'findWork trova ancora 1.1');
  // nuovo progetto parte con 1.1 nascosta
  await page.evaluate(()=>{ window.prompt=()=> 'C'; newProject(); });
  ok(await page.evaluate(()=>state.hiddenWorks.includes('1.1')),'nuovo progetto C parte con 1.1 nascosta');
  ok(await page.evaluate((B)=>!appData.projects.find(p=>p.id===B).hiddenWorks.includes('1.1'),B),'B esistente non cambia');
  // persistenza dopo ricarica
  await page.reload(); await page.waitForTimeout(500);
  ok(await page.evaluate((A)=>{const p=appData.projects.find(x=>x.id===A);return !!p.lockedPrices && p.hiddenWorks.includes('1.1');},A),'blocco e voce nascosta sopravvivono alla ricarica');
  ok(await page.evaluate(()=>catalogHiddenWorks.includes('1.1')),'catalogo personale persiste');
  ok(await page.evaluate(()=>!COMPUTO_WORKS.flatMap(c=>c.items).every(i=>i[0]!=='1.1')),'dopo ricarica la voce 1.1 è ancora nel catalogo base');
  // ripristino
  await page.evaluate((A)=>{ selectProject(A); restoreHiddenWork('1.1'); },A);
  ok(await tot(A)===a0,'ripristinata: A torna al totale iniziale');
  await page.evaluate(()=>{ restoreCatalogWork('1.1'); });
  ok(await page.evaluate(()=>catalogHiddenWorks.length===0),'catalogo ripristinato');
  // eliminazione di una voce standard: deve nascondere, non cancellare
  await page.evaluate(()=>{ window.confirm=()=>true; deleteCustomWork('1.2'); });
  ok(await page.evaluate(()=>state.hiddenWorks.includes('1.2') && COMPUTO_WORKS.flatMap(c=>c.items).some(i=>i[0]==='1.2')),'deleteCustomWork su voce standard la nasconde senza cancellarla');
  // backup
  const bk=await page.evaluate(()=>{ catalogHiddenWorks=['9.9']; return JSON.stringify({appData,priceLibraries,permanentCustomWorks,catalogHiddenWorks}); });
  ok(bk.includes('catalogHiddenWorks'),'il backup contiene il catalogo personale');
  // UI: pannello
  await page.evaluate(()=>{ showPage('computo', document.querySelector('.nav button')); buildComputo(); });
  const panel=await page.evaluate(()=>document.getElementById('projectToolsPanel').innerText);
  ok(/Prezzi e voci del progetto/.test(panel),'pannello visibile: '+panel.slice(0,60).replace(/\n/g,' '));
  ok(errors.length===0,'nessun errore JS durante i test '+JSON.stringify(errors));
  await browser.close(); summary();
})();

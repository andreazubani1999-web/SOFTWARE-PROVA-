const {open,ok,summary}=require('./lib');
// Consuntivo lavori: stima fotografata, spese reali, scostamenti, aggiornamento libreria Prezzi Reali
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));

  await page.evaluate(()=>{
    window.__answers=[]; window.__msgs=[];
    window.confirm=(m)=>{ window.__msgs.push(m); return window.__answers.length?window.__answers.shift():true; };
  });
  const answer=(list)=>page.evaluate((list)=>{ window.__answers=list.slice(); window.__msgs=[]; },list);

  // progetto: 1.1 ×10 (18 €), 7.1 ×50 (38 €), 1.2 ×20 coperta da un preventivo di 1.500 €, imprevisti 10%
  await page.evaluate(()=>{
    const p=blankProject('Cantiere'); COMPUTTO_WORKS_FIX(p);
    p.computo['1.1'].qty=10; p.computo['7.1'].qty=50; p.computo['1.2'].qty=20;
    p.business.contingency=10;
    appData.projects.push(p); appData.activeId=p.id; state=p; saveApp();
    artisanAdd(); const a=artisanData.artisans[0]; artisanSet(a.id,'name','Mario Edile');
    quoteAdd(a.id); const q=a.quotes[0]; quoteSet(a.id,q.id,'title','Demolizioni'); quoteSet(a.id,q.id,'amount','1500'); quoteToggleCover(a.id,q.id,'1.2',true);
    quoteUseInProject(a.id,q.id);
    showPage('actuals',document.querySelector('.nav button[onclick*="actuals"]'));
  });
  ok(/Avvia consuntivo/.test(await page.evaluate(()=>document.getElementById('actuals').innerText)),'senza consuntivo: tasto "Avvia consuntivo"');

  // 1) avvio: stima fotografata
  await page.evaluate(()=>startActuals());
  const a=await page.evaluate(()=>state.actuals);
  ok(a.rows['1.1'].estimate===180 && a.rows['7.1'].estimate===1900,'stima per voce: 180 e 1.900');
  ok(!a.rows['1.2'],'voce coperta dal preventivo non duplicata');
  const qid=Object.keys(a.quotes)[0];
  ok(Object.keys(a.quotes).length===1 && a.quotes[qid].estimate===1500 && /Mario Edile/.test(a.quotes[qid].label),'preventivo in consuntivo: 1.500');
  ok(Math.abs(a.contingency-358)<0.01,'imprevisti in stima: 358');

  // 2) spese reali
  await page.evaluate((qid)=>{
    setActualField('row','1.1','actual','250');
    setActualField('row','7.1','actual','1.710');
    setActualField('quote',qid,'actual','1.600');
  },qid);
  await page.waitForTimeout(50);
  const s1=await page.evaluate(()=>({sum:actualsSummary(state.actuals),u11:actualUnitPrice(state.actuals.rows['1.1']),u71:actualUnitPrice(state.actuals.rows['7.1'])}));
  ok(s1.sum.entered===3 && s1.sum.count===3,'3 voci su 3 inserite');
  ok(s1.sum.estimateOfEntered===3580 && s1.sum.actual===3560 && s1.sum.difference===-20,'stima 3.580, reale 3.560, scostamento −20');
  ok(s1.u11===25 && s1.u71===34.2,'prezzi reali: 25 €/mq e 34,20 €/mq');
  let txt=await page.evaluate(()=>document.getElementById('actuals').innerText);
  ok(/\+70,00\s*€ \(\+38,9%\)/.test(txt),'scostamento per voce: +70 € (+38,9%)');

  // 3) quantità reale diversa dalla stimata
  await page.evaluate(()=>setActualField('row','7.1','actualQty','45'));
  await page.waitForTimeout(50);
  ok(await page.evaluate(()=>actualUnitPrice(state.actuals.rows['7.1']))===38,'con 45 mq reali il prezzo reale è 38 €/mq');

  // 4) spese non previste confrontate con gli imprevisti
  await page.evaluate(()=>{ addActualExtra(); const x=state.actuals.extras[0]; setActualExtra(x.id,'desc','Rifacimento colonna scarico'); setActualExtra(x.id,'actual','500'); });
  await page.waitForTimeout(50);
  txt=await page.evaluate(()=>document.getElementById('actuals').innerText);
  ok(await page.evaluate(()=>actualsSummary(state.actuals).extrasTotal)===500,'spese non previste: 500');
  ok(/Supera gli imprevisti messi in stima di 122,00/.test(txt),'sforamento netto −20 + 500 = 480 supera gli imprevisti (358) di 122');

  // 5) la stima non cambia se cambia la libreria
  await page.evaluate(()=>setGlobalPrice('1.1','30'));
  ok(await page.evaluate(()=>state.actuals.rows['1.1'].estimate===180),'stima fotografata non cambia col listino');

  // 6) aggiornamento libreria Prezzi Reali: annullato
  await answer([false]);
  await page.evaluate(()=>applyActualPrices(['1.1','7.1']));
  ok(await page.evaluate(()=>!('1.1' in priceLibraries.reale) && !('7.1' in priceLibraries.reale)),'annullato: libreria Prezzi Reali invariata');
  // confermato
  await answer([true]);
  const n=await page.evaluate(()=>applyActualPrices(['1.1','7.1']));
  const m=await page.evaluate(()=>window.__msgs[0]);
  ok(n===2 && /1\.1 .*→ 25,00/.test(m) && /7\.1 .*→ 38,00/.test(m),'conferma con prezzi vecchi e nuovi');
  const lib=await page.evaluate(()=>({r11:priceLibraries.reale['1.1'],r71:priceLibraries.reale['7.1'],s11:priceLibraries.standard['1.1'],def11:COMPUTO_WORKS.flatMap(c=>c.items).find(i=>i[0]==='1.1')[3],def71:COMPUTO_WORKS.flatMap(c=>c.items).find(i=>i[0]==='7.1')[3]}));
  ok(lib.r11===25 && lib.r71===38,'libreria Prezzi Reali aggiornata: 25 e 38');
  ok(lib.s11===30,'libreria Standard non toccata');
  ok(lib.def11===18 && lib.def71===38,'prezzi di default del catalogo invariati');
  await page.evaluate(()=>switchPriceLibrary('reale'));
  ok(await page.evaluate(()=>getProjectPrice(state,'1.1'))===25,'con la libreria Prezzi Reali attiva il computo usa 25');
  txt=await page.evaluate(()=>document.getElementById('actuals').innerText);
  ok(/già in libreria/.test(txt),'voce già allineata segnalata');

  // 7) aggiorna stima dal computo: tiene le spese reali
  await page.evaluate(()=>{ state.computo['1.3'].qty=5; state.computo['7.1'].qty=0; saveApp(); });
  await answer([true]);
  await page.evaluate(()=>startActuals());
  const b=await page.evaluate(()=>state.actuals);
  ok(!!b.rows['1.3'] && b.rows['1.3'].actual===null,'voce nuova aggiunta');
  ok(b.rows['1.1'].actual===250,'spese reali conservate');
  ok(b.rows['7.1'] && b.rows['7.1'].removedFromEstimate===true && b.rows['7.1'].actual===1710,'voce tolta dal computo ma pagata: resta segnalata');
  ok(b.extras.length===1,'spese non previste conservate');

  // 8) passaggio da un campo all'altro senza perdere il cursore
  await page.fill('[data-af="row|1.3|actual"]','90');
  await page.click('[data-af="row|1.1|actualQty"]');
  await page.waitForTimeout(100);
  ok(await page.evaluate(()=>state.actuals.rows['1.3'].actual)===90,'valore salvato uscendo dal campo');
  ok(await page.evaluate(()=>document.activeElement?.dataset?.af)==='row|1.1|actualQty','il campo toccato resta attivo dopo il ridisegno');

  // 9) persistenza e backup
  await page.reload(); await page.waitForTimeout(500);
  ok(await page.evaluate(()=>state.actuals?.rows?.['1.1']?.actual===250 && JSON.stringify(appData).includes('"actuals"')),'consuntivo salvato e incluso nei dati del backup');

  // 10) eliminazione
  await page.evaluate(()=>{ window.confirm=()=>true; deleteActuals(); });
  ok(await page.evaluate(()=>!state.actuals),'consuntivo eliminato');

  ok(errors.length===0,'nessun errore JS '+JSON.stringify(errors));
  await browser.close(); summary();
})();

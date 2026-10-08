const {open,ok,summary}=require('./lib');
// Preventivo cancellato ma ancora usato (come copia) in uno o più progetti
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));

  // risposte programmate per confirm() e registro dei messaggi
  await page.evaluate(()=>{
    window.__answers=[]; window.__msgs=[];
    window.confirm=(m)=>{ window.__msgs.push(m); return window.__answers.length?window.__answers.shift():true; };
  });
  const answer=(list)=>page.evaluate((list)=>{ window.__answers=list.slice(); window.__msgs=[]; },list);
  const msgs=()=>page.evaluate(()=>window.__msgs);

  // setup: artigiano con due preventivi; Q1 usato in A e B, Q2 usato in C
  const ids=await page.evaluate(()=>{
    const mk=(name)=>{ const p=blankProject(name); COMPUTTO_WORKS_FIX(p); p.computo['1.1'].qty=10; p.computo['1.2'].qty=20; appData.projects.push(p); return p; };
    const A=mk('Progetto Alfa'), B=mk('Progetto Beta'), C=mk('Progetto Gamma');
    artisanAdd(); const a=artisanData.artisans[0]; artisanSet(a.id,'name','Mario Edile');
    quoteAdd(a.id); const q1=a.quotes[0]; quoteSet(a.id,q1.id,'title','Demolizioni'); quoteSet(a.id,q1.id,'amount','1500'); quoteToggleCover(a.id,q1.id,'1.1',true);
    quoteAdd(a.id); const q2=a.quotes[0]; quoteSet(a.id,q2.id,'title','Massetti'); quoteSet(a.id,q2.id,'amount','900'); quoteToggleCover(a.id,q2.id,'1.2',true);
    for(const P of [A,B]){ appData.activeId=P.id; state=P; quoteUseInProject(a.id,q1.id); }
    appData.activeId=C.id; state=C; quoteUseInProject(a.id,q2.id);
    saveApp();
    return {a:a.id,q1:q1.id,q2:q2.id,A:A.id,B:B.id,C:C.id};
  });
  const uses=(pid)=>page.evaluate((pid)=>(appData.projects.find(p=>p.id===pid).quoteUses||[]).length,pid);
  ok(await uses(ids.A)===1 && await uses(ids.B)===1 && await uses(ids.C)===1,'setup: Q1 in Alfa e Beta, Q2 in Gamma');

  // "usato in" nella scheda del preventivo
  await page.evaluate((a)=>{ showPage('artisans',document.querySelector('.nav button[onclick*="artisans"]')); artisanOpenId=a; renderArtisans(); },ids.a);
  const txt=await page.evaluate(()=>document.getElementById('artisans').innerText);
  ok(/Usato in:\s*Progetto Alfa · Progetto Beta/.test(txt),'scheda: "Usato in: Progetto Alfa · Progetto Beta"');
  ok(/Usato in:\s*Progetto Gamma/.test(txt),'scheda: Q2 usato in Progetto Gamma');

  // 1) annullo l'eliminazione: non cambia nulla
  await answer([false]);
  await page.evaluate((x)=>quoteDelete(x.a,x.q1),ids);
  let m=await msgs();
  ok(m.length===1 && m[0].includes('Progetto Alfa') && m[0].includes('Progetto Beta') && !m[0].includes('Gamma'),'avviso con l\'elenco dei progetti che lo usano');
  ok(await page.evaluate((x)=>!!findQuote(findArtisan(x.a),x.q1),ids),'annullato: preventivo ancora presente');
  ok(await uses(ids.A)===1 && await uses(ids.B)===1,'annullato: progetti invariati');

  // 2) elimino ma lascio le copie nei progetti
  const tA=await page.evaluate((pid)=>calculateProjectTotals(appData.projects.find(p=>p.id===pid)).worksTotal,ids.A);
  await answer([true,false]);
  await page.evaluate((x)=>quoteDelete(x.a,x.q1),ids);
  m=await msgs();
  ok(m.length===2 && /anche da questi progetti/.test(m[1]),'seconda domanda: togliere anche dai progetti?');
  ok(await page.evaluate((x)=>!findQuote(findArtisan(x.a),x.q1),ids),'preventivo eliminato dalla scheda');
  ok(await uses(ids.A)===1 && await uses(ids.B)===1,'copie conservate nei progetti');

  // 3) rimetto un preventivo usato in due progetti, poi elimino togliendolo anche da lì
  const q3=await page.evaluate((x)=>{
    const a=findArtisan(x.a); quoteAdd(a.id); const q=a.quotes[0]; quoteSet(a.id,q.id,'amount','700'); quoteToggleCover(a.id,q.id,'1.2',true);
    for(const pid of [x.A,x.B]){ const P=appData.projects.find(p=>p.id===pid); appData.activeId=P.id; state=P; quoteUseInProject(a.id,q.id); }
    return q.id;
  },ids);
  ok(await uses(ids.A)===2 && await uses(ids.B)===2,'nuovo preventivo usato in Alfa e Beta');
  await answer([true,true]);
  await page.evaluate(({x,q})=>quoteDelete(x.a,q),{x:ids,q:q3});
  ok(await uses(ids.A)===1 && await uses(ids.B)===1,'tolto da entrambi i progetti, l\'altra copia resta');
  const tA2=await page.evaluate((pid)=>calculateProjectTotals(appData.projects.find(p=>p.id===pid)).worksTotal,ids.A);
  ok(Math.abs(tA2-tA)<0.01,`totale di Alfa torna com'era (${tA2} = ${tA})`);
  ok(await uses(ids.C)===1,'Gamma non toccato');

  // 4) preventivo non usato: una sola domanda
  const q4=await page.evaluate((x)=>{ const a=findArtisan(x.a); quoteAdd(a.id); return a.quotes[0].id; },ids);
  await answer([true]);
  await page.evaluate(({x,q})=>quoteDelete(x.a,q),{x:ids,q:q4});
  m=await msgs();
  ok(m.length===1 && !/progetto/i.test(m[0]),'preventivo non usato: nessun elenco di progetti');

  // 5) persistenza
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(()=>{ window.__answers=[]; window.__msgs=[]; window.confirm=(m)=>{ window.__msgs.push(m); return window.__answers.length?window.__answers.shift():true; }; });
  ok(await uses(ids.A)===1 && await uses(ids.B)===1 && await uses(ids.C)===1,'dopo ricarica i progetti sono come previsto');

  // 6) eliminazione dell'artigiano: stesso avviso, toglie le copie se confermo
  await answer([true,true]);
  await page.evaluate((x)=>artisanDelete(x.a),ids);
  m=await msgs();
  ok(m[0].includes('Progetto Alfa') && m[0].includes('Progetto Gamma'),'eliminazione artigiano: elenco progetti');
  ok(await uses(ids.A)===0 && await uses(ids.B)===0 && await uses(ids.C)===0,'eliminazione artigiano: copie tolte da tutti i progetti');
  ok(await page.evaluate(()=>artisanData.artisans.length)===0,'artigiano eliminato');

  ok(errors.length===0,'nessun errore JS '+JSON.stringify(errors));
  await browser.close(); summary();
})();

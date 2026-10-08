const {open,ok,summary}=require('./lib');
// Imposte della società: IVA, IRES, IRAP, dividendi, compatibilità col vecchio campo capitalGainsTax
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));

  // Caso calcolato a mano: lavori 40.000 come preventivo, imprevisti a zero,
  // interessi 3.000 = 100.000 al 3% per 12 mesi
  const calc=(over)=>page.evaluate((over)=>{
    const p=blankProject('Caso');
    p.computo={};
    p.quoteUses=[{id:'u1',snapshot:{amount:40000}}];
    Object.assign(p.project,{purchase:100000,sell:200000},over.project||{});
    Object.assign(p.business,{
      contingency:0,notary:12000,tech:4000,agencySale:6000,
      loanAmount:100000,loanRate:3,loanMonths:12,loanFees:0,
      holdingUtilities:2000
    },over.business||{});
    const t=calculateProjectTotals(p);
    return {
      worksTotal:t.worksTotal,worksVatCost:t.worksVatCost,revenue:t.revenue,saleVat:t.saleVat,
      costs:Math.round((t.investment+t.saleCosts)*100)/100,margin:t.margin,ires:t.ires,
      irapBase:t.irapBase,irap:t.irap,net:t.companyNetProfit,divTax:t.dividendTax,
      pocket:t.netToShareholders,scenario:t.taxSettings.vatScenario,mao:t.mao,
      targetMargin:t.targetMargin
    };
  },over);
  const eq=(a,b)=>Math.abs(a-b)<0.005;

  // 1) caso del commercialista: IVA lavori recuperabile, prezzo IVA esclusa
  const a=await calc({business:{vatScenario:'taxable',salePriceIncludesVat:false,distributeDividends:true}});
  ok(eq(a.costs,167000),'costi totali 167.000 ('+a.costs+')');
  ok(eq(a.margin,33000),'utile ante imposte 33.000 ('+a.margin+')');
  ok(eq(a.ires,7920),'IRES 24% = 7.920 ('+a.ires+')');
  ok(eq(a.irapBase,36000),'base IRAP 36.000 ('+a.irapBase+')');
  ok(eq(a.irap,1404),'IRAP 3,9% = 1.404 ('+a.irap+')');
  ok(eq(a.net,23676),'utile netto in società 23.676 ('+a.net+')');
  ok(eq(a.divTax,6155.76),'imposta dividendi 6.155,76 ('+a.divTax+')');
  ok(eq(a.pocket,17520.24),'netto in tasca 17.520,24 ('+a.pocket+')');
  ok(a.worksVatCost===0 && a.saleVat===0,'nessuna IVA a costo in questo scenario');

  // 2) senza distribuzione: nessuna imposta sui dividendi
  const a2=await calc({business:{vatScenario:'taxable',salePriceIncludesVat:false}});
  ok(a2.divTax===0 && a2.pocket===0 && eq(a2.net,23676),'senza distribuzione resta in società');

  // 3) vendita esente: IVA lavori non recuperabile 10% su 40.000
  const b=await calc({business:{vatScenario:'exempt'}});
  ok(eq(b.worksVatCost,4000),'IVA lavori non recuperabile 4.000 ('+b.worksVatCost+')');
  ok(eq(b.margin,29000),'esente: utile ante imposte 29.000 ('+b.margin+')');
  ok(eq(b.ires,6960) && eq(b.irapBase,32000) && eq(b.irap,1248),'esente: IRES 6.960, IRAP 1.248 su 32.000');
  ok(eq(b.net,20792),'esente: utile netto 20.792 ('+b.net+')');

  // 4) valore iniziale "da definire" = caso esente con IVA lavori 10%
  const c=await calc({});
  ok(c.scenario==='tbd','scenario iniziale: da definire');
  ok(eq(c.worksVatCost,4000) && eq(c.margin,29000),'da definire calcolato come esente (prudente)');

  // 5) vendita soggetta, prezzo IVA inclusa: ricavo senza IVA
  const d=await calc({business:{vatScenario:'taxable',salePriceIncludesVat:true}});
  ok(eq(d.revenue,181818.18) && eq(d.saleVat,18181.82),'IVA inclusa: ricavo 181.818,18, IVA 18.181,82');
  ok(eq(d.margin,14818.18),'IVA inclusa: utile ante imposte 14.818,18 ('+d.margin+')');
  ok(eq(d.ires,3556.36) && eq(d.irap,694.91),'IVA inclusa: IRES 3.556,36, IRAP 694,91');
  ok(eq(d.net,10566.91),'IVA inclusa: utile netto 10.566,91 ('+d.net+')');

  // 6) perdita: IRES e IRAP mai negative
  const e=await calc({project:{sell:150000},business:{vatScenario:'taxable',salePriceIncludesVat:false,distributeDividends:true}});
  ok(eq(e.margin,-17000),'perdita: utile ante imposte −17.000');
  ok(e.ires===0 && e.irap===0,'perdita: IRES e IRAP a zero');
  ok(eq(e.net,-17000) && e.divTax===0 && e.pocket===0,'perdita: nessun dividendo, netto −17.000');

  // 7) piccola perdita ma base IRAP positiva (gli interessi non sono deducibili ai fini IRAP)
  const f=await calc({project:{sell:165000},business:{vatScenario:'taxable',salePriceIncludesVat:false}});
  ok(eq(f.margin,-2000) && f.ires===0,'perdita −2.000: IRES zero');
  ok(eq(f.irapBase,1000) && eq(f.irap,39),'base IRAP 1.000 → IRAP 39');
  ok(eq(f.net,-2039),'netto −2.039');

  // 8) le spese di istruttoria escono dalla base IRAP come gli interessi
  const g=await calc({business:{vatScenario:'taxable',salePriceIncludesVat:false,loanFees:1000}});
  ok(eq(g.margin,32000) && eq(g.irapBase,36000),'istruttoria esclusa dalla base IRAP');

  // 9) MAO coerente: acquistando al MAO il margine è il margine obiettivo
  const h=await calc({business:{vatScenario:'exempt'}});
  const h2=await calc({project:{purchase:h.mao},business:{vatScenario:'exempt'}});
  ok(eq(h2.margin,h.targetMargin),'al MAO il margine è il target ('+h2.margin+')');

  // 10) vecchio campo: conservato, non usato nel calcolo, avviso visibile
  const old=await calc({business:{vatScenario:'exempt',capitalGainsTax:5000}});
  ok(eq(old.margin,29000),'il vecchio campo non entra nel calcolo');
  await page.evaluate(()=>{
    const p=blankProject('Vecchio');
    COMPUTTO_WORKS_FIX(p);
    p.business.capitalGainsTax=5000;
    appData.projects.push(p); appData.activeId=p.id; state=p; saveApp();
    showPage('business',document.querySelector('.nav button[onclick*="business"]'));
    renderBusinessPlan();
  });
  const panel=await page.evaluate(()=>document.getElementById('companyTaxPanel').innerText);
  ok(/vecchio campo/i.test(panel) && /5\.000/.test(panel),'avviso vecchio campo con il valore');
  ok(/da confermare con il commercialista/i.test(panel),'avviso scenario da definire');
  ok(/Stima semplificata, da verificare con il commercialista/.test(panel),'dicitura per il commercialista');
  ok(await page.evaluate(()=>!document.getElementById('capitalGainsTax')),'il campo vecchio non è più nel modulo');

  // il salvataggio del modulo non cancella il vecchio valore
  await page.evaluate(()=>saveAll());
  ok(await page.evaluate(()=>state.business.capitalGainsTax===5000),'vecchio valore conservato dopo il salvataggio');

  // 11) cambio scenario dall'interfaccia
  await page.evaluate(()=>{ state.project.sell=200000; setCompanyTaxField('vatScenario','taxable'); setCompanyTaxField('distributeDividends','true'); });
  const panel2=await page.evaluate(()=>document.getElementById('companyTaxPanel').innerText);
  ok(/IVA inclusa/.test(panel2) && /Netto in tasca se distribuito/.test(panel2),'scenario soggetta: scelta IVA inclusa/esclusa e netto in tasca');
  ok(await page.evaluate(()=>state.business.vatScenario==='taxable' && state.business.distributeDividends===true),'scelte salvate nel progetto');
  const hint=await page.evaluate(()=>document.getElementById('sellPriceVatHint').textContent);
  ok(/IVA inclusa/.test(hint),'il prezzo di vendita dice se è IVA inclusa: '+hint.slice(0,40));
  await page.evaluate(()=>setCompanyTaxField('salePriceIncludesVat','false'));
  ok(/IVA esclusa/.test(await page.evaluate(()=>document.getElementById('sellPriceVatHint').textContent)),'…o IVA esclusa');

  // 12) report
  const rep=await page.evaluate(()=>reportHTML());
  ok(rep.includes('Imposte della società') && rep.includes('Utile netto in società'),'report con le imposte della società');
  ok(!/plusvalenza/i.test(rep),'report senza "imposta su plusvalenza"');

  // 13) import di un vecchio backup (con capitalGainsTax, senza i campi nuovi)
  const oldBackup=await page.evaluate(()=>{
    const p=blankProject('Backup vecchio');
    COMPUTTO_WORKS_FIX(p);
    p.business.capitalGainsTax=3000;
    return JSON.stringify({version:'1.4',appData:{projects:[p],activeId:p.id},priceLibraries,permanentCustomWorks,catalogHiddenWorks});
  });
  await page.evaluate(()=>localStorage.clear());
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate((s)=>{ importBackup({target:{files:[new File([s],'b.json',{type:'application/json'})],value:''}}); },oldBackup);
  await page.waitForTimeout(600);
  const imp=await page.evaluate(()=>{
    const p=appData.projects.find(x=>x.project?.name==='Backup vecchio'||x.name==='Backup vecchio');
    return p ? {cgt:p.business.capitalGainsTax,scenario:p.business.vatScenario,net:calculateProjectTotals(p).companyNetProfit} : null;
  });
  ok(imp && imp.cgt===3000,'vecchio backup: valore conservato ('+JSON.stringify(imp)+')');
  ok(imp && imp.scenario==='tbd' && Number.isFinite(imp.net),'vecchio backup: campi nuovi con valori iniziali');

  // 14) persistenza dopo ricarica
  await page.evaluate(()=>{ setCompanyTaxField('iresRate','25'); });
  await page.reload(); await page.waitForTimeout(400);
  ok(await page.evaluate(()=>state.business.iresRate===25),'aliquota modificata sopravvive alla ricarica');

  ok(errors.length===0,'nessun errore JS '+JSON.stringify(errors));
  await browser.close(); summary();
})();

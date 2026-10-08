const {open,ok,summary}=require('./lib');
// ROI annuo, prova di resistenza e prezzo di pareggio
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));

  // stesso caso di t4: lavori 40.000, interessi 3.000 (100.000 al 3% per 12 mesi), gestione 2.000
  const mk=(over={})=>page.evaluate((over)=>{
    const p=blankProject('Stress');
    p.computo={};
    p.quoteUses=[{id:'u1',snapshot:{amount:40000,covers:[],artisanName:'Test',title:'Lavori'}}];
    Object.assign(p.project,{purchase:100000,sell:200000});
    Object.assign(p.business,{
      contingency:0,notary:12000,tech:4000,agencySale:6000,
      loanAmount:100000,loanRate:3,loanMonths:12,loanFees:0,holdingUtilities:2000,
      vatScenario:'taxable',salePriceIncludesVat:false,targetMargin:25000
    },over);
    window.__p=p;
    const pick=t=>({margin:t.margin,net:t.companyNetProfit,roi:t.roi,netRoi:t.netRoi,annual:t.annualRoi,annualNet:t.annualNetRoi,be:t.breakEvenArv,months:t.durationMonths});
    const sc=stressScenarios(p).map(x=>({key:x.key,label:x.label,...pick(x.totals)}));
    return {base:pick(calculateProjectTotals(p)),sc};
  },over);
  const eq=(a,b,t=0.01)=>Math.abs(a-b)<t;

  const r=await mk();
  ok(eq(r.base.margin,33000) && eq(r.base.net,23676),'base invariata: 33.000 ante, 23.676 netto');
  ok(eq(r.base.annual,r.base.roi) && eq(r.base.annualNet,23676/161000*100),'12 mesi: ROI annuo = ROI ('+r.base.annualNet.toFixed(2)+'%)');
  const by=k=>r.sc.find(x=>x.key===k);
  ok(r.sc.length===5 && eq(by('base').net,23676),'5 scenari, il primo è quello previsto');
  ok(eq(by('arv').margin,13000) && eq(by('arv').net,9256),'vendita −10%: 13.000 ante, 9.256 netto');
  ok(eq(by('works').margin,27000) && eq(by('works').net,19350),'lavori +15%: 27.000 ante, 19.350 netto');
  ok(eq(by('delay').margin,30500) && eq(by('delay').net,21815),'ritardo 6 mesi: +1.500 interessi, +1.000 gestione → 30.500 ante, 21.815 netto');
  ok(by('delay').months===18 && eq(by('delay').annualNet,21815/163500*100*12/18),'ritardo: ROI annuo su 18 mesi ('+by('delay').annualNet.toFixed(2)+'%)');
  ok(eq(by('all').margin,4500) && eq(by('all').net,3069),'tutto insieme: 4.500 ante, 3.069 netto');

  // 6 mesi: il ROI annuo raddoppia
  const r6=await mk({loanMonths:6});
  ok(eq(r6.base.annualNet,r6.base.netRoi*2),'6 mesi: ROI annuo = doppio del ROI');

  // durata non inserita
  const r0=await mk({loanMonths:0,loanAmount:0});
  ok(r0.base.annual===null && r0.base.annualNet===null,'senza durata il ROI annuo non viene inventato');

  // prezzo di pareggio nei tre scenari IVA
  ok(eq(r.base.be,167000),'pareggio, prezzo IVA esclusa: 167.000');
  const ri=await mk({salePriceIncludesVat:true});
  ok(eq(ri.base.be,183700),'pareggio, prezzo IVA inclusa 10%: 183.700');
  const re=await mk({vatScenario:'exempt'});
  ok(eq(re.base.be,171000),'pareggio, vendita esente con IVA lavori: 171.000');
  const chk=await page.evaluate(()=>{ const p=window.__p; p.project.sell=171000; return calculateProjectTotals(p).margin; });
  ok(Math.abs(chk)<0.01,'vendendo al prezzo di pareggio l\'utile è zero');

  // parametri modificabili
  const rp=await mk({stressArvDrop:5,stressWorksIncrease:20,stressDelayMonths:3});
  ok(/−5%/.test(rp.sc[1].label) && /\+20%/.test(rp.sc[2].label) && /3 mesi/.test(rp.sc[3].label),'percentuali e mesi modificabili');
  ok(eq(rp.sc[1].margin,23000),'vendita −5%: 23.000 ante');

  // interfaccia
  await page.evaluate(()=>{
    const p=blankProject('UI'); COMPUTTO_WORKS_FIX(p);
    p.quoteUses=[{id:'u1',snapshot:{amount:40000,covers:[],artisanName:'Test',title:'Lavori'}}];
    Object.assign(p.project,{purchase:100000,sell:200000});
    Object.assign(p.business,{contingency:0,notary:12000,tech:4000,agencySale:6000,loanAmount:100000,loanRate:3,loanMonths:12,holdingUtilities:2000,vatScenario:'taxable',salePriceIncludesVat:false,targetMargin:25000});
    appData.projects.push(p); appData.activeId=p.id; state=p; saveApp();
    showPage('business',document.querySelector('.nav button[onclick*="business"]'));
    syncToInputs(); renderTotals();
  });
  const ui=await page.evaluate(()=>({
    panel:document.getElementById('stressTestPanel').innerText,
    summary:document.getElementById('businessSummary').innerText,
    rows:document.querySelectorAll('#stressTestPanel [data-scenario]').length,
    inGeneral:!!document.getElementById('loanMonths') && document.getElementById('loanMonths').closest('.grid').querySelector('#contingencyPerc')!==null
  }));
  ok(ui.rows===5 && /Prezzo di vendita di pareggio/.test(ui.panel),'riquadro con 5 scenari e pareggio');
  ok(/✅ regge/.test(ui.panel) && /❌ in perdita|⚠️ sotto il margine minimo/.test(ui.panel),'esito colorato per scenario');
  ok(/ROI annuo netto \(su 12 mesi\)/.test(ui.summary),'riepilogo con ROI annuo netto');
  ok(ui.inGeneral,'durata spostata in Parametri generali');

  // la durata si salva ancora dal modulo
  await page.evaluate(()=>{ document.getElementById('loanMonths').value='9'; saveAll(); });
  ok(await page.evaluate(()=>state.business.loanMonths===9),'durata salvata dal modulo');

  // modifica di un parametro dal riquadro e persistenza
  await page.evaluate(()=>setCompanyTaxField('stressArvDrop','7'));
  ok(/Vendita a −7%/.test(await page.evaluate(()=>document.getElementById('stressTestPanel').innerText)),'parametro aggiornato nel riquadro');
  await page.reload(); await page.waitForTimeout(500);
  ok(await page.evaluate(()=>state.business.stressArvDrop===7),'parametro salvato dopo la ricarica');

  // report
  const rep=await page.evaluate(()=>reportHTML());
  ok(rep.includes('Prova di resistenza') && rep.includes('Prezzo di vendita di pareggio'),'report con prova di resistenza');

  // progetto vecchio senza i campi nuovi: valori iniziali
  ok(await page.evaluate(()=>{ const p=blankProject('Vecchio'); delete p.business.stressArvDrop; const s=stressSettings(p); return s.arvDrop===10&&s.worksIncrease===15&&s.delayMonths===6; }),'valori iniziali 10% / 15% / 6 mesi');

  ok(errors.length===0,'nessun errore JS '+JSON.stringify(errors));
  await browser.close(); summary();
})();

const {open,ok,summary}=require('./lib');
const fs=require('fs'), path=require('path');
// Import da AZ Annunci Analyzer: formati diversi, sola lettura, "usa questo valore", foto escluse
const FIX=path.join(__dirname,'fixtures');
const v15=fs.readFileSync(path.join(FIX,'analyzer-1.5-aquileia.json'),'utf8');
const ai=fs.readFileSync(path.join(FIX,'analyzer-andrea-ai-aquileia.json'),'utf8');
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));

  // risposte programmate per confirm()/alert()
  await page.evaluate(()=>{
    window.__answers=[]; window.__msgs=[]; window.__alerts=[];
    window.confirm=(m)=>{ window.__msgs.push(m); return window.__answers.length?window.__answers.shift():true; };
    window.alert=(m)=>{ window.__alerts.push(m); };
  });
  const answer=(list)=>page.evaluate((list)=>{ window.__answers=list.slice(); window.__msgs=[]; window.__alerts=[]; },list);

  // progetto con Business Plan già compilato
  await page.evaluate(()=>{
    const p=blankProject('Mio progetto'); COMPUTTO_WORKS_FIX(p);
    Object.assign(p.project,{askingPrice:110000,purchase:105000,sell:210000,mq:90});
    p.computo['7.1'].qty=50;
    appData.projects.push(p); appData.activeId=p.id; state=p; saveApp(); syncToInputs();
  });
  const snap=()=>page.evaluate(()=>JSON.stringify({p:state.project,b:state.business,t:calculateProjectTotals(state).margin}));
  const before=await snap();

  // 1) formato 1.5 (esportazione vera)
  ok(await page.evaluate((s)=>applyAnalyzerImport(JSON.parse(s),'Aquileia_esportato_.json'),v15),'import 1.5 riuscito');
  const d=await page.evaluate(()=>state.analyzer);
  ok(d.data.askingPrice===119900 && d.data.arv===227500 && d.data.mao===130500 && d.data.mq===91,'1.5: prezzo, ARV, MAO, mq');
  ok(d.data.decision==='DA APPROFONDIRE' && d.data.score===90,'1.5: decisione e punteggio');
  ok(d.data.works===50000 && d.data.targetMargin===30000,'1.5: stime preliminari');
  ok(d.data.zoneScores.quality===8 && d.data.zoneScores.resale===8,'1.5: punteggi zona');
  ok(d.data.comparables.length===3 && d.data.comparables[2].price===null,'1.5: 3 comparabili, prezzo vuoto tollerato');
  ok(d.data.checklist.length===6 && d.data.sources.length===5,'1.5: checklist e fonti');
  ok(d.version==='1.5-no-photos' && !!d.importedAt && d.fileName==='Aquileia_esportato_.json','1.5: versione, data e nome file');
  ok(await snap()===before,'il Business Plan NON è stato toccato dall\'import');

  // pagina in sola lettura
  await page.evaluate(()=>showPage('analysis',document.querySelector('.nav button[onclick*="analysis"]')));
  let txt=await page.evaluate(()=>document.getElementById('analysis').innerText);
  ok(/Importata il \d{2}\/\d{2}\/\d{4}/.test(txt),'data dell\'importazione mostrata');
  ok(txt.includes('Trilocale Via Aquileia 2') && txt.includes('DA APPROFONDIRE') && txt.includes('Via Camillo Biseo'),'dati e comparabili visibili');
  ok(await page.evaluate(()=>document.querySelectorAll('#analysisContent input, #analysisContent textarea').length)===0,'nessun campo modificabile: sola lettura');
  ok(await page.evaluate(()=>[...document.querySelectorAll('#analysisContent a')].every(a=>/^https?:/.test(a.getAttribute('href')) && a.rel.includes('noopener'))),'link esterni sicuri');

  // 2) "usa questo valore": annullato → nulla cambia
  await answer([false]);
  ok(await page.evaluate(()=>useAnalyzerValue('sell','arv'))===false && await snap()===before,'conferma annullata: ARV invariato');
  // confermato → cambia solo quel campo
  await answer([true]);
  ok(await page.evaluate(()=>useAnalyzerValue('sell','arv'))===true,'ARV dell\'Analyzer usato');
  const m=await page.evaluate(()=>window.__msgs[0]);
  ok(/Attuale: 210\.000,00/.test(m) && /Nuovo \(dall'Analyzer\): 227\.500,00/.test(m),'la conferma mostra valore attuale e nuovo');
  ok(await page.evaluate(()=>state.project.sell===227500 && state.project.askingPrice===110000),'cambia solo il prezzo di rivendita');
  ok(/227\.500/.test(await page.evaluate(()=>document.getElementById('sellPrice').value)),'campo ARV del progetto aggiornato');
  await answer([true]);
  await page.evaluate(()=>useAnalyzerValue('askingPrice','askingPrice'));
  ok(await page.evaluate(()=>state.project.askingPrice===119900),'prezzo richiesto usato');

  // 3) import dal tasto vero (file input), sostituendo l'analisi esistente
  await answer([true]);
  await page.setInputFiles('#analysis input[type=file]',{name:'v3.json',mimeType:'application/json',buffer:Buffer.from(ai)});
  await page.waitForTimeout(400);
  const e=await page.evaluate(()=>({d:state.analyzer.data,f:state.analyzer.fileName,m:window.__msgs[0]||''}));
  ok(/già un'analisi importata/.test(e.m) && e.f==='v3.json','chiede prima di sostituire l\'analisi esistente');
  ok(e.d.arv===245700 && e.d.arvRange.mid===245700 && e.d.arvRange.omi===177000,'formato "Andrea AI": ARV e forchetta');
  ok(e.d.comparables.length===3 && e.d.checklist.length===6 && e.d.sources.length===5,'formato "Andrea AI": comparabili, checklist, fonti');
  ok(e.d.zoneScores.quality===7.5 && /locato/.test(e.d.texts.description) && /NON è un flip/.test(e.d.decision),'formato "Andrea AI": zona, descrizione, decisione');
  txt=await page.evaluate(()=>document.getElementById('analysis').innerText);
  ok(/Forchetta ARV/.test(txt) && /Valore OMI/.test(txt),'forchetta ARV e OMI visibili');

  // 4) versione vecchia con pochi campi (0.6) e numeri come testo
  await answer([true]);
  ok(await page.evaluate(()=>applyAnalyzerImport({source:'AZ Annunci Analyzer',version:'0.6',project:{name:'Bilocale',askingPrice:'95.000'}},'old.json')),'import 0.6 minimale');
  const o=await page.evaluate(()=>state.analyzer.data);
  ok(o.askingPrice===95000 && o.arv===null && o.comparables.length===0,'0.6: campi mancanti tollerati');
  ok(await page.evaluate(()=>!document.querySelector('#analysisContent button[onclick*="\'sell\'"]')),'nessun tasto ARV se il valore manca');

  // 5) foto: mai salvate
  await answer([true]);
  await page.evaluate(()=>applyAnalyzerImport({version:'1.3',project:{name:'Con foto'},listingPhotos:['data:image/jpeg;base64,AAAA','data:image/jpeg;base64,BBBB'],comparables:[{title:'C',photo:'data:image/png;base64,CCCC'}]},'f.json'));
  const ph=await page.evaluate(()=>({s:JSON.stringify(state.analyzer),n:state.analyzer.photosSkipped,t:document.getElementById('analysis').innerText}));
  ok(!ph.s.includes('data:image'),'nessuna immagine salvata nel progetto');
  ok(ph.n===3 && /3 foto dell'annuncio non importate/.test(ph.t),'avvisa quante foto non sono state importate');

  // 6) file sbagliato (un backup) rifiutato
  await answer([]);
  ok(await page.evaluate(()=>applyAnalyzerImport({version:'1.4',appData:{projects:[]}},'backup.json'))===false,'backup di AZ Flipping rifiutato');
  ok(await page.evaluate(()=>/Importa backup/.test(window.__alerts[0]||'')),'messaggio che indica il tasto giusto');

  // 7) testo malevolo nel file: mostrato come testo, non eseguito
  await answer([true]);
  await page.evaluate(()=>applyAnalyzerImport({project:{name:'<img src=x onerror="window.__xss=1">',link:'javascript:alert(1)'}},'x.json'));
  ok(await page.evaluate(()=>!document.querySelector('#analysisContent img') && !window.__xss),'HTML nel file non viene eseguito');
  ok(await page.evaluate(()=>!document.querySelector('#analysisContent a[href^="javascript"]')),'link non http scartati');

  // 8) persistenza, backup e rimozione
  await answer([true]);
  await page.evaluate((s)=>applyAnalyzerImport(JSON.parse(s),'Aquileia.json'),v15);
  await page.reload(); await page.waitForTimeout(500);
  ok(await page.evaluate(()=>state.analyzer?.data?.arv===227500),'analisi conservata dopo la ricarica');
  ok(await page.evaluate(()=>JSON.stringify(appData).includes('"analyzer"')),'l\'analisi è nei dati del backup');
  await page.evaluate(()=>{ window.confirm=()=>true; removeAnalyzerImport(); });
  ok(await page.evaluate(()=>!state.analyzer && state.project.sell===227500),'analisi tolta, Business Plan invariato');

  ok(errors.length===0,'nessun errore JS '+JSON.stringify(errors));
  await browser.close(); summary();
})();

const {open,ok,summary}=require('./lib');
// Spazio di memoria, avviso di salvataggio fallito, riepilogo del backup (planimetria inclusa)
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));

  // immagine JPEG "rumorosa" di circa 0,8 MB, come una planimetria vera
  await page.evaluate(()=>{
    const c=document.createElement('canvas'); c.width=2400; c.height=1700; const x=c.getContext('2d');
    for(let i=0;i<4000;i++){ x.fillStyle=`hsl(${i%360},60%,${30+i%50}%)`; x.fillRect((i*733)%2400,(i*397)%1700,40,40); }
    window.__img=c.toDataURL('image/jpeg',.82);
  });

  await page.evaluate(()=>{ showPage('home',document.querySelector('.nav button[onclick*="home"]')); renderStorageUsage(); });
  let usage=await page.evaluate(()=>document.getElementById('storageUsage').innerText);
  ok(/Memoria usata dal software/.test(usage) && /su circa 5 MB/.test(usage),'indicatore memoria visibile: '+usage.split('\n')[0]);

  // planimetria nel progetto attivo
  await page.evaluate(()=>{ state.planImage=window.__img; saveApp(); renderStorageUsage(); });
  usage=await page.evaluate(()=>document.getElementById('storageUsage').innerText);
  ok(/Planimetrie 0,\d+ MB \(1\)/.test(usage),'indicatore conta la planimetria: '+usage.replace(/\n/g,' ').slice(0,120));

  // backup: contiene la planimetria e mostra il riepilogo
  const bk=await page.evaluate(()=>{
    let text=null; const OB=window.Blob;
    window.Blob=function(parts,opts){ text=parts.join(''); return new OB(parts,opts); };
    try{ exportBackup(); } finally { window.Blob=OB; }
    return {hasPlan:!!text && text.includes(window.__img.slice(100,400)), box:document.getElementById('storageUsage').innerText, toast:document.getElementById('toast').textContent};
  });
  ok(bk.hasPlan,'il backup contiene l\'immagine della planimetria');
  ok(/Ultimo backup esportato: \d+ progetti, 1 planimetrie e 0 foto incluse/.test(bk.box),'riepilogo backup: '+bk.box.split('\n').pop());
  ok(/1 planimetrie/.test(bk.toast),'messaggio di esportazione con le planimetrie');

  // progetto con misure ma senza immagine: segnalato nel riepilogo
  await page.evaluate(()=>{
    const p=blankProject('Solo misure'); COMPUTTO_WORKS_FIX(p);
    p.rooms=[{id:'r1',name:'Soggiorno',layer:'fatto',points:[]}];
    appData.projects.push(p); saveApp();
    const OB=window.Blob; window.Blob=function(a,b){return new OB(a,b)}; exportBackup(); window.Blob=OB;
  });
  ok(/1 progetto\/i con misure ma senza immagine/.test(await page.evaluate(()=>document.getElementById('storageUsage').innerText)),'segnala progetti con misure ma senza immagine');

  // salvataggio fallito simulato: avviso ben visibile, poi sparisce quando torna a salvare
  await page.evaluate(()=>{
    window.__realSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(){ throw new DOMException('pieno','QuotaExceededError'); };
    saveApp();
  });
  let warn=await page.evaluate(()=>document.getElementById('storageWarning')?.innerText||'');
  ok(/Memoria del browser piena/.test(warn) && /NON sono state salvate/.test(warn),'avviso di salvataggio fallito visibile');
  ok(await page.evaluate(()=>!!document.querySelector('#storageWarning button[onclick*="exportBackup"]')),'avviso con tasto "Esporta backup ora"');
  // anche artigiani e catalogo passano dallo stesso controllo
  await page.evaluate(()=>{ Storage.prototype.setItem=window.__realSet; saveApp(); });
  ok(await page.evaluate(()=>!document.getElementById('storageWarning')),'avviso tolto quando il salvataggio riesce');
  await page.evaluate(()=>{ Storage.prototype.setItem=function(){ throw new DOMException('pieno','QuotaExceededError'); }; saveArtisanData(); });
  ok(await page.evaluate(()=>!!document.getElementById('storageWarning')),'avviso anche se fallisce il salvataggio degli artigiani');
  await page.evaluate(()=>{ Storage.prototype.setItem=window.__realSet; saveCatalogHidden(); });
  ok(await page.evaluate(()=>!document.getElementById('storageWarning')),'…e sparisce al salvataggio successivo riuscito');

  // memoria piena davvero: 10 foto da 0,8 MB superano il limite del browser
  const real=await page.evaluate(()=>{
    for(let i=0;i<10;i++) state.photos.push({id:'f'+i,name:'foto',data:window.__img,room:''});
    saveApp();
    return {failed:storageSaveFailed, banner:!!document.getElementById('storageWarning')};
  });
  ok(real.failed && real.banner,'limite reale del browser superato: avviso mostrato');
  await page.waitForTimeout(600);
  usage=await page.evaluate(()=>document.getElementById('storageUsage').innerText);
  ok(/salvataggio non è riuscito/.test(usage) && /esporta un backup/i.test(usage),'indicatore segnala il salvataggio fallito e suggerisce il backup');

  // nessun errore JS a parte l'avviso previsto in console (console.warn non conta)
  ok(errors.length===0,'nessun errore JS '+JSON.stringify(errors));
  await browser.close(); summary();
})();

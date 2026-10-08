const {open,ok,summary}=require('./lib');
(async()=>{
  const {browser,page,errors}=await open();
  await page.evaluate(()=>{
    window.confirm=()=>true;
    const p=blankProject('Z'); COMPUTTO_WORKS_FIX(p); appData.projects.push(p); appData.activeId=p.id; state=p;
    p.computo['7.1'].qty=20; saveApp();
    lockProjectPrices(); hideWorkInProject('1.3');
  });
  // addCustomWork non deve riscrivere progetto bloccato
  const before=await page.evaluate(()=>JSON.stringify(state.lockedPrices['7.1']));
  const backupStr=await page.evaluate(()=>JSON.stringify({version:APP_VERSION,appData,priceLibraries,permanentCustomWorks,catalogHiddenWorks}));
  ok(backupStr.includes('"lockedPrices"') && backupStr.includes('"hiddenWorks"'),'backup contiene blocco prezzi e voci nascoste');
  // import
  await page.evaluate(()=>{ localStorage.clear(); });
  await page.reload(); await page.waitForTimeout(400);
  ok(await page.evaluate(()=>!appData.projects.some(p=>p.name==='Z'||p.project?.name==='Z')),'dopo clear il progetto Z non c\'è');
  await page.evaluate((s)=>{
    const file=new File([s],'b.json',{type:'application/json'});
    importBackup({target:{files:[file],value:''}});
  },backupStr);
  await page.waitForTimeout(600);
  const res=await page.evaluate(()=>{ const p=appData.projects.find(x=>x.lockedPrices && x.hiddenWorks.includes('1.3')); return !!p; });
  ok(res,'import ripristina progetto con prezzi bloccati e voce nascosta');
  await page.evaluate(()=>{ showPage('computo', document.querySelector('.nav button')); });
  await page.waitForTimeout(300);
  await page.screenshot({path:'shot_computo.png',fullPage:false});
  ok(errors.length===0,'nessun errore '+JSON.stringify(errors));
  await browser.close(); summary();
})();

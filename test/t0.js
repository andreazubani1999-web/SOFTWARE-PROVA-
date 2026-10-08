const {open,ok,summary}=require('./lib');
(async()=>{
  const {browser,page,errors}=await open();
  ok(errors.length===0,'nessun errore al caricamento '+JSON.stringify(errors));
  const n=await page.evaluate(()=>COMPUTO_WORKS.flatMap(c=>c.items).length);
  ok(n=== 128,'128 voci nel catalogo, trovate '+n);
  const info=await page.evaluate(()=>({projects:appData.projects.length, ver:APP_VERSION}));
  console.log(info);
  await browser.close(); summary();
})();

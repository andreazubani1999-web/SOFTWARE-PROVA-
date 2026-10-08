const { chromium } = require('playwright');
const path = require('path');
const FILE = process.env.APP || path.resolve(__dirname,'..','index.html');
async function open(opts={}){
  const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox']}).catch(async()=>chromium.launch({args:['--no-sandbox']}));
  const ctx = await browser.newContext(opts.context||{});
  const page = await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
  page.on('dialog',d=>d.accept(opts.promptValue||undefined).catch(()=>{}));
  await page.goto('file://'+FILE);
  await page.waitForTimeout(500);
  return {browser,ctx,page,errors};
}
let pass=0, fail=0;
function ok(cond,msg){ if(cond){pass++;console.log('  ok  '+msg);}else{fail++;console.log('  FAIL '+msg);} }
function summary(){ console.log(`\n${pass} ok, ${fail} falliti`); process.exit(fail?1:0); }
module.exports={open,ok,summary};

// Local fictional fixtures only; block external database requests.
const {chromium}=require(process.env.FETS_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const out=process.env.FETS_PREVIEW_OUTPUT || '/tmp/fets-shift-preview';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const results=[];
 for(const width of [1440,768,393,320]){
  const context=await browser.newContext({viewport:{width,height:width>800?1000:852}});
  await context.route('https://*.supabase.co/**',r=>r.abort());
  await context.addInitScript(()=>{const ActualDate=Date;const fixed=ActualDate.parse('2026-10-08T04:07:00Z');window.Date=class extends ActualDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3010/shift-preview.html');await page.getByRole('region',{name:'My duties'}).waitFor();
  const overflow=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));assert.ok(overflow.body<=overflow.viewport,`Staff view overflow at ${width}: ${JSON.stringify(overflow)}`);
  await page.getByRole('button',{name:/Prepare the exam lab/}).click();
  await page.screenshot({path:path.join(out,`staff-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Submit result'}).click();assert.ok(await page.getByRole('button',{name:'Send for independent review'}).isDisabled());
  await page.getByLabel('What result did you achieve?').fill('All active stations checked; one faulty headset replaced.');
  await page.screenshot({path:path.join(out,`submit-${width}.png`),fullPage:true});
  await page.getByLabel('Preview role').selectOption('manager');await page.getByRole('region',{name:'Team duties'}).waitFor();
  await page.screenshot({path:path.join(out,`team-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Review & development'}).click();await page.getByLabel('Colleague').selectOption('p1');await page.getByText('Feedback & follow-up',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,`management-${width}.png`),fullPage:true});
  const managementOverflow=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));assert.ok(managementOverflow.body<=width,`Management overflow at ${width}`);
  await page.getByRole('button',{name:'Team day',exact:true}).click();await page.getByRole('button',{name:'Assign a duty',exact:true}).click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByLabel('Duty',{exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.screenshot({path:path.join(out,`assignment-${width}.png`),fullPage:true});
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(errors,[]);results.push({width,overflow,managementOverflow,errors,journeys:['staff agreement','required result','team allocation','management evidence','assignment modal focus and escape']});
  await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

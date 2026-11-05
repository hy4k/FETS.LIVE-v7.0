/** ISOLATED_BROWSER_FIXTURE_ONLY: local fixture assertions; no real services. */
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const out=process.env.FETS_INTELLIGENCE_FIXTURE_DIR||'/tmp/fets-ai-browser-fixture';
const modulePath=process.env.FETS_PUPPETEER_MODULE||'/home/pptruser/node_modules/puppeteer/lib/puppeteer/puppeteer.js';
const {default:puppeteer}=await import(pathToFileURL(modulePath).href);
const html=await readFile(out+'/index.html');
assert(html.includes('ISOLATED_BROWSER_FIXTURE_ONLY'),'Missing isolated fixture marker');
assert(html.includes("connect-src 'none'"),'Fixture must disable outbound connections');
await mkdir(out,{recursive:true});
const server=createServer((request,response)=>{if(request.url?.startsWith('/?')||request.url==='/'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(html);}else{response.writeHead(404);response.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;const results=[];
try{
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run']});
 for(const width of [1440,768,390,320]){
  const context=await browser.createBrowserContext();const page=await context.newPage();await page.setViewport({width,height:1000});page.setDefaultTimeout(10000);
  const errors=[],externalRequests=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',request=>{if(request.url().startsWith(base+'/')||request.url().startsWith('data:'))request.continue();else{externalRequests.push(request.url());request.abort();}});
  const check=(name,condition)=>{assert(condition,name);checks.push(name);};
  const text=async value=>page.waitForFunction(value=>document.body.innerText.toLowerCase().includes(value.toLowerCase()),{},value);
  const button=label=>page.locator(`xpath///button[normalize-space(.)=${JSON.stringify(label)}]`);
  const overflow=async tab=>{const dimensions=await page.evaluate(()=>({body:document.body.scrollWidth,document:document.documentElement.scrollWidth,width:innerWidth}));check(`${tab}: no body overflow`,dimensions.body<=dimensions.width+1&&dimensions.document<=dimensions.width+1);};
  try{
   await page.goto(base+'/?news=1',{waitUntil:'load'});await text('Operations Copilot · Connected');
   check('isolated fixture marker',await page.evaluate(()=>window.intelligenceFixture.marker==='ISOLATED_BROWSER_FIXTURE_ONLY'));
   await overflow('Assistant initial');
   await button('Control').click();await text('fixture-gemini-model');
   check('Control reads initial writes disabled',await page.$eval('[role="switch"]',e=>e.getAttribute('aria-checked')==='false'));
   await page.locator('[role="switch"]').click();await page.waitForFunction(()=>document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='true');await text('Live — writes enabled');
   check('Control writes acknowledged by fixture API',await page.evaluate(()=>window.intelligenceFixture.readState().settings.autonomous_enabled&&!window.intelligenceFixture.readState().settings.kill_switch));
   await overflow('Control');await page.screenshot({path:`${out}/control-${width}.png`,fullPage:true});
   await button('Knowledge').click();await text('Fixture legacy reference');await text('Fixture approved guide');
   await page.locator('[aria-label="Edit Fixture approved guide"]').click();
   check('Approved source URL loaded',await page.$eval('[aria-label="Source link · optional"]',e=>e.value==='https://example.invalid/approved-guide'));
   await page.locator('[aria-label="Reference content"]').fill('Reviewed approved reference content for this isolated fixture.');await button('Save knowledge').click();
   await page.waitForFunction(()=>window.intelligenceFixture.readState().documents.find(d=>d.id==='fixture-guide').version===5);
   const savedDoc=await page.evaluate(()=>window.intelligenceFixture.readState().documents.find(d=>d.id==='fixture-guide'));
   check('Approved document preserves source/version',savedDoc.source==='approved'&&savedDoc.version===5&&savedDoc.source_url==='https://example.invalid/approved-guide');
   await button('Pinned Memory').click();await page.locator('[aria-label="Memory key"]').fill('Answer language');await page.locator('[aria-label="Memory value"]').fill('English and India time.');await button('Save memory').click();await text('English and India time.');
   check('Pinned memory created with personal scope',await page.evaluate(()=>window.intelligenceFixture.readState().memories.some(m=>m.mem_key==='Answer language'&&m.scope==='user'&&m.is_active)));
   await page.locator('[aria-label="Edit Answer language"]').click();await page.locator('[aria-label="Memory value"]').fill('English, India time, cite references.');await button('Save memory').click();await text('English, India time, cite references.');
   check('Pinned memory edited',await page.evaluate(()=>window.intelligenceFixture.readState().memories[0].mem_value==='English, India time, cite references.'));
   await page.locator('[aria-label="Disable Answer language"]').click();await text('Inactive');check('Pinned memory soft-disabled',await page.evaluate(()=>window.intelligenceFixture.readState().memories.length===1&&!window.intelligenceFixture.readState().memories[0].is_active));
   await overflow('Knowledge');await page.screenshot({path:`${out}/memory-${width}.png`,fullPage:true});
   await button('Assistant').click();await page.locator('input[placeholder^="Message FETS AI"]').fill('Create a fixture task');await page.focus('input[placeholder^="Message FETS AI"]');await page.keyboard.press('Enter');await text('fixture-task-receipt');await text('Fixture Current Shift');await text('For review only. Nothing has been submitted.');
   check('Actual receipt links to module without detail claim',await page.$eval('a[href="/actionables"]',e=>e.textContent.trim()==='Open module'));
   check('Chat sends request UUID and no caller history',await page.evaluate(()=>{const call=window.intelligenceFixture.calls.find(c=>c.action==='chat');return /^[a-f0-9-]{36}$/.test(call.requestId)&&!Object.hasOwn(call,'history');}));
   const conversationId=await page.$eval('select[aria-label="Conversation history"]',e=>e.value);check('Selected conversation saved',Boolean(conversationId));
   await button('New chat').click();await page.waitForFunction(()=>!document.body.innerText.includes('fixture-task-receipt'));check('New chat clears messages',await page.$eval('body',element=>!element.innerText.includes('Fixture task saved with a confirmed receipt.')));
   await page.select('select[aria-label="Conversation history"]',conversationId);await text('fixture-task-receipt');check('Conversation history selection restores receipt',await page.$eval('select[aria-label="Conversation history"]',e=>Boolean(e.value)));
   await page.reload({waitUntil:'load'});await text('fixture-task-receipt');check('Reload restores selected durable conversation',await page.$eval('select[aria-label="Conversation history"]',e=>e.value)===conversationId);
   await overflow('Assistant restored');await page.screenshot({path:`${out}/chat-${width}.png`,fullPage:true});
   await button('Control').click();await text('Live — writes enabled');check('Control reload reads saved switch',await page.$eval('[role="switch"]',e=>e.getAttribute('aria-checked')==='true'));
   await button('Telemetry').click();await text('Your AI activity');await text('Writes Executed');await overflow('Telemetry');
   await button('Broadcasts').click();await text('Updated pre-session checklist');check('Broadcasts tab retained (isolated placeholder)',true);await overflow('Broadcasts');
   check('No React render errors',await page.evaluate(()=>window.intelligenceBrowserErrors.length===0));check('No page errors',errors.length===0);check('No external request attempts',externalRequests.length===0);
  }catch(e){errors.push(e.stack||e.message);await page.screenshot({path:`${out}/failure-${width}.png`,fullPage:true}).catch(()=>{});}
  results.push({width,checks:checks.length,passed:checks,errors,externalRequests});await writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({width,checks:checks.length,errors:errors.length}));await context.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
const summary={viewports:results.length,checks:results.reduce((n,r)=>n+r.checks,0),failedViewports:results.filter(r=>r.errors.length).length,output:out};
console.log(JSON.stringify(summary));if(summary.failedViewports)process.exitCode=1;

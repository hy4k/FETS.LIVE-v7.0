// Browser-only synthetic account and intercepted backend; never bypasses authentication in application code.
const { chromium } = require(process.env.FETS_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const output = path.resolve(__dirname, '../../release/play-store');
fs.mkdirSync(output, {recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.FETS_CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:360,height:640},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 await context.route('**/src/hooks/useAuth.ts*',route=>route.fulfill({contentType:'application/javascript',body:`export function useAuth(){return {user:{id:'demo-user',email:'demo@example.invalid'},profile:{id:'demo-profile',user_id:'demo-user',full_name:'Demo Staff',email:'demo@example.invalid',role:'super_admin',branch_assigned:'calicut',permissions:{}},loading:false,hasPermission:()=>true,signOut:async()=>{},signIn:async()=>({})}}`}));
 await context.route('https://*.supabase.co/**',route=>{
 const u=route.request().url(); const data=u.includes('/auth/')?{id:'demo-user',email:'demo@example.invalid'}:u.includes('fets_workspace_capabilities')?{version:3,desk:true,duties:true,blueprint:true}:[];
 route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.FETS_PREVIEW_URL || 'http://127.0.0.1:3000/');
 await page.getByRole('navigation',{name:'Mobile workspace'}).waitFor({timeout:60000});
 await page.screenshot({path:path.join(output,'phone-home.png')});
 console.log('mobile nav visible',await page.getByRole('navigation',{name:'Mobile workspace'}).isVisible());
 console.log('right-edge',await page.evaluate(()=>document.elementsFromPoint(innerWidth-2,400).map(e=>({class:e.className,position:getComputedStyle(e).position,filter:getComputedStyle(e).filter}))));
 if(await page.evaluate(()=>document.body.scrollWidth>innerWidth)) throw new Error('Phone body overflows horizontally');
 await page.getByRole('button',{name:'More workspace tools'}).click();
 await page.getByRole('dialog').waitFor();
 await page.screenshot({path:path.join(output,'phone-tools.png')});
 console.log('tool labels',await page.locator('dialog[open] .workspace-menu-grid strong').allTextContents());
 await page.getByRole('button',{name:'Close workspace menu'}).click();
 for(const name of ['Calendar','Roster','My Desk']){
  await page.getByRole('navigation',{name:'Mobile workspace'}).getByRole('button',{name,exact:true}).click();
  await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(output,`phone-${name.toLowerCase().replace(' ','-')}.png`)});
  const expected = {'Calendar':'/calendar','Roster':'/roster','My Desk':'/my-desk'}[name]; if(new URL(page.url()).pathname!==expected) throw new Error(`Wrong ${name} route`); console.log(name,'route passed');
 }
for(const width of [320,393,767]) {
  await page.setViewportSize({width,height:740});
  if(!await page.getByRole('navigation',{name:'Mobile workspace'}).isVisible()) throw new Error(`No mobile navigation at ${width}px`);
  if(await page.evaluate(()=>document.body.scrollWidth>innerWidth)) throw new Error(`Overflow at ${width}px`);
 }
 await page.setViewportSize({width:1280,height:900});
 if(await page.getByRole('navigation',{name:'Mobile workspace'}).isVisible()) throw new Error('Mobile navigation visible on desktop');
 console.log('Phone widths 320, 360, 393, 767 and desktop 1280 checked');
 console.log('page errors',errors);
 if(errors.length) throw new Error(errors.join('\n'));
 const loginContext=await browser.newContext({viewport:{width:360,height:640},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const login=await loginContext.newPage(); await login.goto(process.env.FETS_PREVIEW_URL || 'http://127.0.0.1:3000/'); await login.getByLabel('Work email').waitFor({timeout:30000}); await login.screenshot({path:path.join(output,'phone-sign-in.png')});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

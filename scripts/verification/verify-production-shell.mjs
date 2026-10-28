// Load the actual production lazy module: reaching the login page alone does not
// evaluate it. This test uses no credentials and blocks all external requests.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const spec = process.env.FETS_PUPPETEER_MODULE;
const { default: puppeteer } = await import(spec ? pathToFileURL(spec).href : 'puppeteer');
const base = process.argv[2];
assert.ok(base, 'Pass the candidate or production origin');
const origin = new URL(base).origin;
const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox'], ...(process.env.FETS_CHROME_PATH ? {executablePath:process.env.FETS_CHROME_PATH} : {})});
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    new URL(request.url()).origin === origin ? request.continue() : request.abort();
  });
  await page.goto(origin, {waitUntil:'domcontentloaded',timeout:60000});
  const result = await page.evaluate(async () => {
    const entry = Array.from(document.querySelectorAll('script[type="module"][src]')).find(s => s.src.includes('/assets/'));
    if (!entry) throw Error('Production module entry not found');
    const code = await (await fetch(entry.src)).text();
    const shell = code.match(/RedesignShell-[\w-]+\.js/)?.[0];
    if (!shell) throw Error('Lazy application shell not found');
    // Reference errors thrown during evaluation reject this import.
    const module = await import('/assets/' + shell);
    const names = ['MyDeskPage','CalendarPage','RosterPage','RaiseCasePage','FieldLabel','ChipRow','ShiftHandoverPage'];
    const missing = names.filter(name => typeof window[name] !== 'function');
    if (typeof module.default !== 'function' || missing.length) throw Error('Application exports missing: ' + missing.join(', '));
    return {shell, defaultComponent:true, sharedComponents:names, moduleLoaded:true};
  });
  console.log(JSON.stringify(result));
} finally { await browser.close(); }

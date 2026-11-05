/** ISOLATED_BROWSER_FIXTURE_ONLY. This script never builds a production entry. */
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const {build}=await import('../../fets-point/node_modules/vite/dist/node/index.js');
const root=fileURLToPath(new URL('../../fets-point/',import.meta.url));
const out=process.env.FETS_INTELLIGENCE_FIXTURE_DIR||'/tmp/fets-ai-browser-fixture';
if(!path.resolve(out).startsWith('/tmp/'))throw Error('Fixture output must stay under /tmp.');
await mkdir(out,{recursive:true});process.chdir(root);
await build({configFile:false,root,publicDir:false,plugins:[{name:'isolated-intelligence-browser-fixture',enforce:'pre',resolveId(source,importer){
 const resolved=source.startsWith('.')&&importer?path.resolve(path.dirname(importer),source):source;
 const normalized=resolved.replace(/\.(tsx?|jsx?)$/,'');
 if(normalized.endsWith('/fets-ai/fets-ai-api'))return root+'src/test/intelligence-browser-mocks.ts';
 if(['/hooks/useAuth','/hooks/useBranch'].some(s=>normalized.endsWith(s)))return root+'src/test/intelligence-browser-mocks.ts';
 if(['/components/NewsManager','/components/Chat/GeminiLiveStudio'].some(s=>normalized.endsWith(s)))return root+'src/test/intelligence-browser-mocks.ts';
}}],define:{'process.env.NODE_ENV':'"production"'},build:{outDir:out+'/bundle',emptyOutDir:true,cssCodeSplit:false,lib:{entry:root+'src/test/intelligence-browser-preview.tsx',name:'IsolatedIntelligenceFixture',formats:['iife'],fileName:'preview'},rollupOptions:{output:{inlineDynamicImports:true},onwarn(w,warn){if(w.code!=='MODULE_LEVEL_DIRECTIVE')warn(w);}}}});
const css=await readFile(out+'/bundle/preview.css','utf8'),js=(await readFile(out+'/bundle/preview.iife.js','utf8')).replace(/<\/script/gi,'<\\/script');
await writeFile(out+'/index.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'"><meta name="fixture" content="ISOLATED_BROWSER_FIXTURE_ONLY"><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
console.log('Isolated Intelligence fixture: '+out+'/index.html');

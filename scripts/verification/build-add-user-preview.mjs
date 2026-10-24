import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { build } = await import(
  "../../fets-point/node_modules/vite/dist/node/index.js"
);
const root = fileURLToPath(new URL("../../fets-point/", import.meta.url));
const out = "/workspace/fets-add-user-preview";
await mkdir(out, { recursive: true });
process.chdir(root);
await build({
  configFile: false,
  root,
  publicDir: false,
  plugins: [
    {
      name: "isolated-staff-preview",
      enforce: "pre",
      resolveId(s) {
        if (s.endsWith("/hooks/useAuth")) return "\0auth";
        if (s.endsWith("/hooks/useStaffManagement")) return "\0staff";
        if (s.endsWith("/lib/supabase")) return "\0db";
      },
      load(id) {
        if (id === "\0auth")
          return `export const useAuth=()=>({profile:{email:'mithun@fets.in',role:new URLSearchParams(location.search).get('role')==='staff'?'staff':'super_admin',...(new URLSearchParams(location.search).get('role')==='staff'?{email:'sample@example.test'}:{})}});`;
        if (id === "\0db") return "export const supabase={};";
        if (id === "\0staff")
          return `const people=[{id:'sample',full_name:'Sample Staff',email:'sample@example.test',role:'fetsian',branch_assigned:'calicut',is_active:true}];export const useStaff=()=>({data:people});export const useStaffMutations=()=>({updateStaff:async v=>v,archiveStaff:async()=>{},addStaff:async v=>{if(window.failStaffCreation)throw Error('Could not save. Please retry.');const {password,...safe}=v;window.lastCreatedStaff=safe;const p={...safe,id:'created-sample',user_id:'created-login',is_active:true};people.push(p);return {success:true,data:{profile:p}};}});`;
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: out + "/bundle",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: root + "src/test/add-user-preview.tsx",
      name: "AddUserPreview",
      formats: ["iife"],
      fileName: "preview",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
      onwarn(w, warn) {
        if (w.code !== "MODULE_LEVEL_DIRECTIVE") warn(w);
      },
    },
  },
});
const css = await readFile(out + "/bundle/preview.css", "utf8"),
  js = (await readFile(out + "/bundle/preview.iife.js", "utf8")).replace(
    /<\/script/gi,
    "<\\/script",
  );
await writeFile(
  out + "/index.html",
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'"><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
);

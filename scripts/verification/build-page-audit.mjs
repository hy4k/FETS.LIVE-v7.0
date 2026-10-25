import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const { build } = await import(
  "../../fets-point/node_modules/vite/dist/node/index.js"
);
const root = fileURLToPath(new URL("../../fets-point/", import.meta.url)),
  out = process.env.FETS_AUDIT_DIR || path.resolve(root, "../.page-audit");
await mkdir(out, { recursive: true });
process.chdir(root); // Resolve the app Tailwind configuration and content paths.
await build({
  configFile: false,
  root,
  publicDir: false,
  plugins: [
    {
      name: "read-only-page-audit",
      enforce: "pre",
      resolveId(s, importer) {
        if(s.endsWith("/fets-ai/FetsAIAgent"))return root+"src/test/agent-audit-mock.tsx";
        const resolved =
          s.startsWith(".") && importer
            ? path.resolve(path.dirname(importer), s)
            : s;
        if (
          [
            "/hooks/useAuth",
            "/hooks/useBranch",
            "/hooks/useTheme",
            "/contexts/ChatContext",
            "/contexts/CallContext",
            "/calls/CallCenter",
            "/lib/supabase",
          ].some((x) => resolved.replace(/\.(tsx?|jsx?)$/, "").endsWith(x))
        )
          return root + "src/test/page-audit-mocks.ts";
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: out + "/bundle",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: root + "src/test/" + (process.env.FETS_AUDIT_APP ? "app-navigation-preview.tsx" : "page-audit-preview.tsx"),
      name: "PageAudit",
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

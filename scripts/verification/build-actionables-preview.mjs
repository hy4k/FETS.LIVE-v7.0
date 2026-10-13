// Build a portable review artifact. Its actual source records and all edits are local.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { build } = await import(
  process.env.FETS_VITE_MODULE ||
    new URL(
      "../../fets-point/node_modules/vite/dist/node/index.js",
      import.meta.url,
    ).href
);
const frontend = fileURLToPath(new URL("../../fets-point/", import.meta.url));
const output = resolve(
  process.env.FETS_PREVIEW_OUTPUT || "/tmp/fets-actionables-preview",
);
const bundle = resolve(output, "standalone");
await build({
  configFile: false,
  root: frontend,
  publicDir: false,
  plugins: [
    {
      name: "offline-review-only",
      enforce: "pre",
      resolveId(source) {
        if (source.endsWith("/hooks/useAuth")) return "\0preview-auth";
        if (source.endsWith("/lib/supabase")) return "\0preview-db";
      },
      load(id) {
        // The injected preview repository/identity supplies these; never initialize a live client.
        if (id === "\0preview-auth")
          return 'export function useAuth(){throw new Error("Preview uses supplied identity")};';
        if (id === "\0preview-db") return "export const supabase={};";
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: bundle,
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(frontend, "src/test/actionables-preview.tsx"),
      name: "FetsActionablesPreview",
      formats: ["iife"],
      fileName: "preview",
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
      },
      output: { inlineDynamicImports: true },
    },
  },
});
let html = await readFile(
  resolve(frontend, "actionables-preview.html"),
  "utf8",
);
const css = await readFile(resolve(bundle, "preview.css"), "utf8");
const js = (await readFile(resolve(bundle, "preview.iife.js"), "utf8")).replace(
  /<\/script/gi,
  "<\\/script",
);
html = html.replace(
  "<head>",
  `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none';">`,
);
html = html.replace("</head>", () => `<style>${css}</style></head>`);
// A replacement callback preserves literal dollar sequences inside the JS bundle.
html = html.replace(
  '<script type="module" src="/src/test/actionables-preview.tsx"></script>',
  () => `<script>${js}</script>`,
);
const artifact = resolve(output, "Actionables-Interactive-Preview.html");
await writeFile(artifact, html);
console.log(`Portable preview: ${artifact}`);

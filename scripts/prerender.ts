import { build } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generatePublicDocuments } from "./seo-documents";

const directory = path.resolve("dist/client");
const template = await readFile(path.join(directory, "index.html"), "utf8");
await build({
  configFile: false,
  publicDir: false,
  plugins: [react()],
  build: {
    ssr: "src/entry-marketing.tsx",
    outDir: "dist/ssr",
    emptyOutDir: true,
  },
});
const { renderMarketingPage } = await import(
  pathToFileURL(path.resolve("dist/ssr/entry-marketing.js")).href
);
await generatePublicDocuments(directory, template, renderMarketingPage);
await copyFile(
  "src/assets/aatmyam-logo.webp",
  path.join(directory, "aatmyam-logo.webp"),
);
console.log(
  "Prerendered public marketing/legal pages and search discovery documents.",
);

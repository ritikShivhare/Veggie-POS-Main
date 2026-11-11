import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PUBLIC_PAGES,
  replaceSeoHead,
  buildRobots,
  buildSitemap,
  buildLlms,
} from "../shared/marketing-seo";

export async function generatePublicDocuments(
  directory: string,
  template: string,
  renderPage: (path: string) => string,
) {
  if (
    !template.includes("<!-- seo:start -->") ||
    !template.includes('<div id="root"></div>')
  ) {
    throw new Error(
      "SEO build requires the head markers and empty application root",
    );
  }
  // The authenticated client shell stays outside the publicly served directory.
  await writeFile(path.join(directory, "..", "server-shell.html"), template);
  for (const page of PUBLIC_PAGES) {
    const file =
      page.path === "/"
        ? path.join(directory, "index.html")
        : path.join(directory, page.path.slice(1), "index.html");
    await mkdir(path.dirname(file), { recursive: true });
    const html = replaceSeoHead(template, page.path).replace(
      '<div id="root"></div>',
      () => '<div id="root">' + renderPage(page.path) + "</div>",
    );
    await writeFile(file, html);
  }
  for (const [file, content] of Object.entries({
    "robots.txt": buildRobots(),
    "sitemap.xml": buildSitemap(),
    "llms.txt": buildLlms(),
  })) {
    await writeFile(path.join(directory, file), content);
  }
}

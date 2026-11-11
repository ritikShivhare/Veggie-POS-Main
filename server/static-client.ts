import express, { type Express } from "express";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { getPageSeo, replaceSeoHead } from "../shared/marketing-seo";

export function mountStaticClient(app: Express, directory: string) {
  const shellFile = path.join(directory, "..", "server-shell.html");
  const shell = readFileSync(
    existsSync(shellFile) ? shellFile : path.join(directory, "index.html"),
    "utf8",
  );
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-cache");
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.set("X-Robots-Tag", "noindex").sendStatus(400);
      return;
    }
    if (/\.(?:map|cjs|mjs|ts|tsx)$/i.test(decoded)) {
      res.set("X-Robots-Tag", "noindex").sendStatus(404);
      return;
    }
    next();
  });
  app.get("*", (req, res, next) => {
    const seo = getPageSeo(req.originalUrl);
    if (
      (seo.indexable || seo.appPage) &&
      req.path !== seo.path &&
      (req.path !== "/index.html" || seo.appPage)
    ) {
      if (seo.appPage) res.set("X-Robots-Tag", "noindex, follow");
      const query = req.originalUrl.includes("?")
        ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
        : "";
      res.redirect(301, seo.path + query);
      return;
    }
    if (seo.appPage) {
      res
        .set("X-Robots-Tag", "noindex, follow")
        .type("html")
        .send(replaceSeoHead(shell, req.originalUrl));
      return;
    }
    if (!seo.indexable) {
      next();
      return;
    }
    const file =
      seo.path === "/"
        ? path.join(directory, "index.html")
        : path.join(directory, seo.path.slice(1), "index.html");
    res.sendFile(file, (err) => {
      if (err && !res.headersSent)
        res.set("X-Robots-Tag", "noindex").sendStatus(404);
    });
  });
  app.use(
    express.static(directory, {
      index: false,
      redirect: false,
      dotfiles: "deny",
      setHeaders: (res, file) => {
        const relative = path
          .relative(directory, file)
          .split(path.sep)
          .join("/");
        const immutable = /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(
          relative,
        );
        res.setHeader(
          "Cache-Control",
          immutable ? "public, max-age=31536000, immutable" : "no-cache",
        );
        if (relative === "sitemap.xml")
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
      },
    }),
  );
  app.use((_req, res) => {
    res.set("X-Robots-Tag", "noindex").sendStatus(404);
  });
}

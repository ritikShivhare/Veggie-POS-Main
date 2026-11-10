import express from "express";
import path from "node:path";

export function configureProductionStatic(
  app: express.Express,
  distPath: string,
): void {
  // Never expose backend outputs or source maps, including maps inside assets/.
  app.use((req, res, next) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      res.sendStatus(400);
      return;
    }
    if (/\.(?:map|cjs|mjs|ts|tsx)$/i.test(pathname)) {
      res.sendStatus(404);
      return;
    }
    next();
  });
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      index: false,
      dotfiles: "deny",
    }),
  );
  app.use("/assets", (_req, res) => {
    res.sendStatus(404);
  });

  // Only explicitly public root files may be read outside assets/.
  app.get(
    ["/favicon.ico", "/robots.txt", "/manifest.webmanifest"],
    (req, res) => {
      res.sendFile(path.join(distPath, req.path), (err) => {
        if (err && !res.headersSent) res.sendStatus(404);
      });
    },
  );
  app.get("*", (req, res) => {
    if (path.extname(decodeURIComponent(req.path)) || !req.accepts("html")) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

import express from "express";

export const STRIPE_WEBHOOK_PATHS = [
  "/api/stripe/webhook",
  "/api/webhooks/stripe",
];

// Register raw parsers before JSON parsing: Stripe signatures cover the exact bytes.
export function configureRequestParsing(app: express.Express): void {
  app.use(
    STRIPE_WEBHOOK_PATHS,
    express.raw({ type: "application/json", limit: "2mb" }),
  );
  app.use("/api/sync", express.json({ limit: "10mb" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
}

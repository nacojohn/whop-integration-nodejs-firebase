/**
 * Checkout backend — one HTTPS function ("api") served under /api by Hosting.
 *
 * STATUS: scaffold only. Every route validates input and returns 501 until
 * payments are wired up. The intended Whop calls are written out (commented)
 * next to each TODO so wiring is a fill-in, not a redesign.
 *
 * Routes
 *   POST /api/checkout-configurations   hosted + (optional) embedded styles
 *   POST /api/payments/confirm          custom payment-elements style
 *   POST /api/webhooks/whop             fulfilment (payment.succeeded etc.)
 *
 * Secrets (never in browser code):
 *   firebase functions:secrets:set WHOP_API_KEY
 *   firebase functions:secrets:set WHOP_WEBHOOK_SECRET
 *
 * Non-secret settings live in functions/.env: WHOP_ENVIRONMENT, WHOP_COMPANY_ID.
 */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";

const WHOP_API_KEY = defineSecret("WHOP_API_KEY");
const WHOP_WEBHOOK_SECRET = defineSecret("WHOP_WEBHOOK_SECRET");
/** Whop account (biz_…), from functions/.env. Public — also served to the browser. */
const WHOP_COMPANY_ID = process.env.WHOP_COMPANY_ID;

/**
 * Must match the environment the API key came from (and config.whop.environment
 * in the browser). Set WHOP_ENVIRONMENT in functions/.env: "sandbox" | "production".
 * The SDK defaults to production, so a sandbox key without this → 401.
 */
const WHOP_ENV = process.env.WHOP_ENVIRONMENT === "sandbox" ? WhopEnvironment.Sandbox : WhopEnvironment.Production;

const whopClient = () => new WhopClient({ token: WHOP_API_KEY.value(), environment: WHOP_ENV });

/** Plans the browser may request. Keep in sync with public/js/products.js. */
const ALLOWED_PLANS = new Set([
  "plan_WHlnHCCHxozxz",
  "plan_Rmt5wwmZFF1ED",
  "plan_ljhES69BLZbEK",
  "plan_rv79K9EDdchoj",
  "plan_vecTtqcsVxaB5",
  "plan_jL2vyolHhyjEl",
]);

const json = (res, status, body) => res.status(status).json(body);

/** Validates and normalises the checkout request built by public/js/checkout/request.js. */
function parseRequest(body) {
  const r = body?.request;
  if (!r || typeof r !== "object") throw new Error("Missing request.");
  if (!ALLOWED_PLANS.has(r.plan)) throw new Error("Unknown plan.");
  const quantity = Math.max(1, Math.min(10, Number(r.quantity) || 1));
  const metadata = Object.fromEntries(
    Object.entries(r.metadata || {})
      .slice(0, 40)
      .map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 500)])
  );
  return { ...r, quantity, metadata };
}

/* ---------------- Route handlers ---------------- */

async function createCheckoutConfiguration(req, res) {
  const request = parseRequest(req.body);

  const config = await whopClient().checkoutConfigurations.create({
    variant_id: request.plan,
    metadata: request.metadata,
    redirect_url: request.returnUrl,
    affiliate_code: request.affiliateCode,
    mode: "payment",
  });
  logger.info("checkout configuration created", { id: config.id, plan: request.plan });
  return json(res, 200, { id: config.id, purchaseUrl: config.purchase_url });
}

async function confirmPayment(req, res) {
  const request = parseRequest(req.body);
  const { confirmationToken } = req.body;
  if (!/^ctok_/.test(confirmationToken || "")) return json(res, 400, { error: "Missing confirmationToken." });

  // Price comes from the plan (variant) — never from the browser.
  const purchase =
    request.quantity > 1
      ? { line_items: [{ variant_id: request.plan, quantity: request.quantity }] }
      : { variant_id: request.plan };

  const payment = await whopClient().payments.create({
    account_id: WHOP_COMPANY_ID,
    ...purchase,
    confirmation_token: confirmationToken,
    email: request.metadata.email || undefined,
    return_url: request.returnUrl,
    metadata: request.metadata,
    promo_code: request.promoCode || undefined,
    affiliate_code: request.affiliateCode || undefined,
    ip_address: String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim() || undefined,
  });

  const result = toBrowserResult(payment);
  logger.info("payment created", { id: payment.id, status: payment.status, substatus: payment.substatus, result: result.status });
  return json(res, 200, result);
}

/**
 * Whop Payment → what the browser needs.
 *   succeeded  — paid; show the return page (fulfil from the webhook, not here)
 *   requires_action — run handleNextAction(clientSecret) for 3-D Secure
 *   processing — accepted, settling asynchronously
 *   failed     — show message
 */
function toBrowserResult(payment) {
  const base = { paymentId: payment.id };
  if (payment.status === "paid" || payment.substatus === "succeeded") return { ...base, status: "succeeded" };
  if (["failed", "blocked", "canceled", "price_too_low"].includes(payment.substatus) || ["void", "uncollectible"].includes(payment.status)) {
    return { ...base, status: "failed", message: payment.failure_message || "Your payment was declined." };
  }
  if (payment.client_secret) return { ...base, status: "requires_action", clientSecret: payment.client_secret };
  return { ...base, status: "processing" };
}

async function whopWebhook(req, res) {
  // TODO(payments):
  // const event = unwrapWebhook(req.rawBody.toString("utf8"), {
  //   headers: req.headers, key: WHOP_WEBHOOK_SECRET.value(),
  // });
  // Dedupe on headers["webhook-id"] (delivery is at-least-once), then:
  // switch (event.type) {
  //   case "payment.succeeded":  /* grant access using event.data.metadata */ break;
  //   case "payment.failed":     break;
  //   case "membership.activated": break;
  //   case "refund.created":     /* revoke access */ break;
  // }
  // Respond 2xx within 5 seconds.

  logger.info("webhook received (stub)", { id: req.headers["webhook-id"] });
  return json(res, 200, { received: true, handled: false });
}

/* ---------------- Router ---------------- */

/** Public, non-secret settings the browser needs. Never add keys or secrets here. */
function publicConfig(req, res) {
  res.set("Cache-Control", "public, max-age=300");
  return json(res, 200, {
    accountId: WHOP_COMPANY_ID || null,
    environment: process.env.WHOP_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
  });
}

const routes = {
  "GET /api/public-config": publicConfig,
  "POST /api/checkout-configurations": createCheckoutConfiguration,
  "POST /api/payments/confirm": confirmPayment,
  "POST /api/webhooks/whop": whopWebhook,
};

export const api = onRequest(
  { region: "us-central1", secrets: [WHOP_API_KEY, WHOP_WEBHOOK_SECRET] },
  async (req, res) => {
    const handler = routes[`${req.method} ${req.path.replace(/\/$/, "")}`];
    if (!handler) return json(res, 404, { error: "Not found." });
    try {
      await handler(req, res);
    } catch (err) {
      logger.warn("api error", { path: req.path, message: err.message });
      if (!res.headersSent) json(res, 400, { error: err.message });
    }
  }
);

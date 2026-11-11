/**
 * Client for our own backend (functions/index.js, served under /api).
 * Never put a Whop API key in browser code — anything that needs one goes here.
 * In mock mode every call resolves with a realistic fake so the UI flow is complete.
 */
import { config } from "../config.js";

const isMock = () => config.mode !== "live";
const fakeId = (prefix) => `${prefix}_mock${Math.random().toString(36).slice(2, 10)}`;

async function post(path, body) {
  const res = await fetch(`${config.api.base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let publicConfigPromise = null;

/**
 * Public settings from functions/.env (via GET /api/public-config):
 *   { accountId: "biz_…" | null, environment: "sandbox" | "production" }
 * Fetched once. If the backend isn't running (hosting-only deploy), falls back to
 * config.whop.environment with no accountId — embedded/popup/express still work.
 */
export function getPublicConfig() {
  if (isMock()) return Promise.resolve({ accountId: null, environment: config.whop.environment });
  publicConfigPromise ??= fetch(`${config.api.base}/public-config`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`public-config ${res.status}`))))
    .catch((err) => {
      console.warn("[api] using local Whop settings:", err.message);
      return { accountId: null, environment: config.whop.environment };
    });
  return publicConfigPromise;
}

/**
 * Server creates a Whop Checkout Configuration (POST /api/v1/checkout_configurations).
 * Returns { id: "ch_…", purchaseUrl } — id feeds embedded checkout, purchaseUrl feeds hosted.
 */
export async function createCheckoutConfiguration(request) {
  if (isMock()) {
    const id = fakeId("ch");
    return { id, purchaseUrl: `https://whop.com/checkout/${id}/`, mock: true };
  }
  return post("/checkout-configurations", { request });
}

/**
 * Custom payment-elements flow: server charges the confirmation token.
 * Returns { status: "succeeded" | "requires_action" | "failed", paymentId, nextAction? }
 */
export async function confirmPayment({ confirmationToken, request }) {
  if (isMock()) return { status: "succeeded", paymentId: fakeId("pay"), mock: true };
  return post("/payments/confirm", { confirmationToken, request });
}

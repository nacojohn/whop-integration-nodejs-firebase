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

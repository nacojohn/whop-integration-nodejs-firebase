/**
 * Builds the provider-agnostic "checkout request" that every style consumes.
 * Field names mirror Whop Elements' checkout options so live mode can pass
 * them straight through (plan, quantity, promoCode, affiliateCode,
 * attribution, metadata, returnUrl).
 */
import { config } from "../config.js";

const UTM_MAP = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_term: "utmTerm",
  utm_content: "utmContent",
};

/** Captures UTM params + affiliate code from the landing URL (persisted for the session). */
export function captureAttribution() {
  const params = new URLSearchParams(location.search);
  let stored = {};
  try { stored = JSON.parse(sessionStorage.getItem("fc.attribution") || "{}"); } catch { /* ignore */ }

  const attribution = { ...(stored.attribution || {}) };
  for (const [param, key] of Object.entries(UTM_MAP)) {
    if (params.get(param)) attribution[key] = params.get(param);
  }
  const affiliateCode = params.get("a") || params.get("ref") || stored.affiliateCode || undefined;

  const result = { attribution, affiliateCode };
  try { sessionStorage.setItem("fc.attribution", JSON.stringify(result)); } catch { /* ignore */ }
  return result;
}

export function buildCheckoutRequest({ product, quantity, promoCode, customer, style }) {
  const { attribution, affiliateCode } = captureAttribution();
  const returnUrl = new URL(config.returnPath, location.origin);
  returnUrl.searchParams.set("product", product.id);
  returnUrl.searchParams.set("style", style);

  return {
    plan: product.whopPlanId,
    quantity: product.allowQuantity ? quantity : 1,
    promoCode: promoCode || undefined,
    affiliateCode,
    attribution: Object.keys(attribution).length ? attribution : undefined,
    // Whop metadata: string values only, max 40 pairs. Read back on the payment + webhooks.
    metadata: {
      product_id: product.id,
      checkout_style: style,
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      stage: customer.stage,
      ...(customer.country ? { country: customer.country } : {}),
    },
    returnUrl: returnUrl.toString(),
  };
}

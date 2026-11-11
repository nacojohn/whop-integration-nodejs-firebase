/**
 * Whop Elements adapter — the ONLY file that touches the Whop browser SDK.
 * Loaded lazily, and only in live mode.
 *
 * Reference: https://docs.whop.com/elements/latest/checkout/overview
 *   <script src="https://cdn.whop.com/elements/amber/elements.js" data-whop-elements>
 *   const checkout = window.WhopElements({...}).checkout.create({ plan, ... });
 *   checkout.create("checkout").mount("#el");
 *
 * Lines marked VERIFY are inferred from the docs and should be checked against
 * the current @whop/elements reference when payments are wired up.
 */
import { config } from "../config.js";
import { getPublicConfig } from "./api.js";

let loaderPromise = null;
let elementsInstance = null;

function loadScript() {
  if (window.WhopElements) return Promise.resolve(window.WhopElements);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = config.whop.scriptUrl;
    s.async = true;
    s.setAttribute("data-whop-elements", "");
    s.onload = () =>
      window.WhopElements ? resolve(window.WhopElements) : reject(new Error("Whop Elements failed to initialise."));
    s.onerror = () => { loaderPromise = null; reject(new Error("Could not load Whop Elements.")); };
    document.head.appendChild(s);
  });
  return loaderPromise;
}

/**
 * Returns the shared WhopElements instance (global appearance/locale/environment).
 * Environment comes from the server (functions/.env WHOP_ENVIRONMENT) so the
 * browser and the API key can never point at different Whop environments.
 */
export async function getWhopElements() {
  if (elementsInstance) return elementsInstance;
  const [WhopElements, { environment }] = await Promise.all([loadScript(), getPublicConfig()]);
  elementsInstance ??= WhopElements({
    appearance: config.whop.appearance,
    locale: config.whop.locale,
    environment,
  });
  return elementsInstance;
}

/** Strips undefined so Whop's option validation doesn't trip on empty keys. */
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/**
 * Creates a checkout group and mounts one element into `target`.
 * elementType: "checkout" (full checkout) | "expressCheckout" (wallet buttons — VERIFY name)
 */
export async function mountCheckoutElement(target, request, { elementType = "checkout", checkoutConfiguration, onComplete, onLoadingChange } = {}) {
  if (!checkoutConfiguration && !/^plan_/.test(request.plan || "")) {
    throw new Error(
      `"${request.plan}" isn't a Whop plan ID. Use the plan_… ID of a price under your product, not the product's prod_… ID.`
    );
  }
  const elements = await getWhopElements();
  console.log(checkoutConfiguration ? "Using server checkout configuration" : "Using plan id directly", request);
  const checkout = elements.checkout.create(
    clean({
      plan: checkoutConfiguration ? undefined : request.plan,
      checkoutConfiguration, // ch_… from the server, seeds metadata/redirect/affiliate
      quantity: request.quantity,
      promoCode: request.promoCode,
      affiliateCode: request.affiliateCode,
      attribution: request.attribution,
      metadata: checkoutConfiguration ? undefined : request.metadata,
      returnUrl: request.returnUrl,
      onComplete, // documented: callbacks go in create() options
      onLoadingChange, // receives { loading: boolean }
    })
  );
  target.replaceChildren(); // clear the "Loading…" placeholder
  checkout.create(elementType).mount(target);
  return { destroy: () => checkout.destroy() };
}

/**
 * Custom payment form: PaymentElement + EmailElement + AddressElement + BrandingElement.
 * The browser only produces a confirmation token (ctok_…); the server charges it.
 * Ref: https://docs.whop.com/elements/latest/payments/overview
 *
 * The handle needs a "charge config": accountId + plan (Whop resolves currency,
 * amount and allowed methods from the plan). The server must charge the same plan.
 */
export async function mountPaymentElements(targets, request) {
  if (!/^plan_/.test(request.plan || "")) {
    throw new Error(`"${request.plan}" isn't a Whop plan ID (plan_…).`);
  }
  const { accountId } = await getPublicConfig();
  if (!accountId?.startsWith("biz_")) {
    throw new Error("Whop account ID unavailable. Set WHOP_COMPANY_ID in functions/.env and make sure the API is running.");
  }
  const elements = await getWhopElements();
  const payments = elements.payments.create({
    accountId,
    plan: request.plan,
    returnUrl: request.returnUrl, // where full-page 3DS / bank steps land
  });
  // Branding is required: other elements wait for it and payments can't confirm without it.
  payments.create("branding").mount(targets.branding);
  payments.create("email").mount(targets.email); // feeds email into the confirmation token
  payments.create("payment").mount(targets.payment);
  payments.create("address").mount(targets.address); // cards need billing line1 + country

  return {
    /** → { confirmationToken: "ctok_…", type } */
    createConfirmationToken: (billingDetails) => payments.createConfirmationToken({ billingDetails }),
    /**
     * 3-D Secure etc. Static on elements.payments. Inline steps open a dialog and
     * resolve { status, redirected: false, lastPaymentError }; full-page steps
     * redirect to returnUrl (redirected: true).
     */
    handleNextAction: (clientSecret) =>
      elements.payments.handleNextAction({ clientSecret, returnUrl: request.returnUrl }),
    destroy: () => payments.destroy?.(),
  };
}

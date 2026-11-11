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

/** Returns the shared WhopElements instance (global appearance/locale/environment). */
export async function getWhopElements() {
  if (elementsInstance) return elementsInstance;
  const WhopElements = await loadScript();
  elementsInstance = WhopElements({
    appearance: config.whop.appearance,
    locale: config.whop.locale,
    environment: config.whop.environment,
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
  const elements = await getWhopElements();
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
      onComplete, // VERIFY: documented on <Checkout>; assumed to be a create() option in vanilla JS
      onLoadingChange,
    })
  );
  checkout.create(elementType).mount(target);
  return { destroy: () => checkout.destroy() };
}

/**
 * Custom payment form: PaymentElement + EmailElement + AddressElement + BrandingElement.
 * The browser only produces a confirmation token (ctok_…); the server charges it.
 * VERIFY: group/element names and createConfirmationToken/handleNextAction signatures.
 */
export async function mountPaymentElements(targets) {
  const elements = await getWhopElements();
  const payments = elements.payments.create({});
  payments.create("email").mount(targets.email);
  payments.create("address").mount(targets.address);
  payments.create("payment").mount(targets.payment);
  payments.create("branding").mount(targets.branding); // required by Whop when using payment elements
  return {
    createConfirmationToken: () => payments.createConfirmationToken(),
    handleNextAction: (action) => payments.handleNextAction(action),
    destroy: () => payments.destroy?.(),
  };
}

/**
 * Express checkout — one-tap Apple Pay / Google Pay / PayPal buttons
 * (Whop ExpressCheckoutElement). Mounts in the same checkout group slot as the
 * full checkout; we offer the full element as a fallback below the wallets.
 *
 * Apple Pay on a non-whop.com domain requires registering the domain via
 * Whop's Domains API first.
 */
import { config } from "../../config.js";
import { mountCheckoutElement } from "../whop.js";
import { handleWhopComplete } from "../complete.js";
import { mockFrame, checkoutSkeleton, h } from "../mock.js";

export default {
  id: "express",
  label: "Express wallets",
  description: "Apple Pay, Google Pay and PayPal buttons for one-tap checkout, with card checkout as a fallback.",
  chips: [],
  paymentSub: "Pay in one tap, or use a card.",

  async start({ mount, request }) {
    if (config.mode !== "live") {
      mount.replaceChildren(
        mockFrame({
          title: "Whop Express Checkout",
          request,
          body: `
            <div class="wallet-btns">
              <div class="wallet-btn wallet-apple">Apple Pay</div>
              <div class="wallet-btn wallet-google">G Pay</div>
              <div class="wallet-btn wallet-paypal">PayPal</div>
            </div>
            <div class="divider">or pay with card</div>
            ${checkoutSkeleton(request)}`,
          note: 'Live: <code>checkout.create("expressCheckout")</code> above a full <code>"checkout"</code> element.',
        })
      );
      return;
    }

    const wallets = h(`<div></div>`);
    const fallback = h(`<div></div>`);
    mount.replaceChildren(wallets, h(`<div class="divider">or pay with card</div>`), fallback);

    const onComplete = handleWhopComplete(request);
    const a = await mountCheckoutElement(wallets, request, { elementType: "expressCheckout", onComplete });
    const b = await mountCheckoutElement(fallback, request, { elementType: "checkout", onComplete });
    return { destroy: () => { a.destroy(); b.destroy(); } };
  },
};

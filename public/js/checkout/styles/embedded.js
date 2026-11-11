/**
 * Embedded checkout — Whop's full Checkout Element mounted inline in the card.
 * No server required: the session is created in the browser from the plan id.
 * Optionally seeded by a server-created checkout configuration (ch_…).
 */
import { config } from "../../config.js";
import { mountCheckoutElement } from "../whop.js";
import { createCheckoutConfiguration } from "../api.js";
import { handleWhopComplete } from "../complete.js";
import { mockFrame, checkoutSkeleton, esc } from "../mock.js";

export default {
  id: "embedded",
  label: "Embedded checkout",
  description: "Whop's full checkout renders inline, right here in the card. Buyers never leave the page.",
  chips: [],
  paymentSub: "Complete your purchase below.",

  async start({ mount, request }) {
    if (config.mode !== "live") {
      mount.replaceChildren(
        mockFrame({
          title: "Whop Checkout Element",
          request,
          body: checkoutSkeleton(request),
          note: `Live: <code>WhopElements().checkout.create({ plan: "${esc(request.plan)}" }).create("checkout").mount(…)</code>`,
        })
      );
      return;
    }

    const checkoutConfiguration = config.whop.useServerCheckoutConfiguration
      ? (await createCheckoutConfiguration(request)).id
      : undefined;

    return mountCheckoutElement(mount, request, {
      elementType: "checkout",
      checkoutConfiguration,
      onComplete: handleWhopComplete(request),
    });
  },
};

/**
 * Hosted checkout — redirect to Whop's own checkout page.
 * Server creates a checkout configuration (keeps metadata + redirect_url
 * tamper-proof) and returns its purchase_url; the browser redirects there.
 */
import { config } from "../../config.js";
import { createCheckoutConfiguration } from "../api.js";
import { mockFrame, h, esc } from "../mock.js";

export default {
  id: "hosted",
  label: "Hosted checkout page",
  description: "Redirects to a Whop-hosted checkout page, then back to this site. Simplest to maintain.",
  chips: ["Needs server"],
  paymentSub: "You'll finish checkout on Whop's secure page.",

  async start({ mount, request }) {
    const { purchaseUrl } = await createCheckoutConfiguration(request);

    if (config.mode !== "live") {
      mount.replaceChildren(
        mockFrame({
          title: "Redirect to Whop",
          request,
          payLabel: "Simulate return from Whop",
          body: `<div class="mock-skel">
                   <div class="skel">↗ ${esc(purchaseUrl)}</div>
                   <div class="skel">↩ back to ${esc(new URL(request.returnUrl).pathname)}</div>
                 </div>`,
          note: "Live: <code>POST /api/checkout-configurations</code> → <code>purchase_url</code> → <code>location.assign()</code>",
        })
      );
      return;
    }

    mount.replaceChildren(h(`<p class="form-note">Redirecting to Whop…</p>`));
    location.assign(purchaseUrl);
  },
};

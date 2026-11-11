/**
 * Custom payment form — individual Whop Payment Elements (email, address,
 * card) laid out in our own design. The browser creates a confirmation token
 * (ctok_…); our server charges it via the Payments API and returns any
 * 3-D Secure next action for the browser to handle.
 *
 * Most control over the UI, most code to own.
 */
import { config } from "../../config.js";
import { mountPaymentElements } from "../whop.js";
import { confirmPayment } from "../api.js";
import { goToReturnPage } from "../complete.js";
import { mockFrame, h, esc } from "../mock.js";
import { formatPrice } from "../../products.js";

export default {
  id: "elements",
  label: "Custom payment form",
  description: "Individual Whop payment fields styled into our own form. Full design control, server confirms the charge.",
  chips: ["Needs server", "Most control"],
  paymentSub: "Enter your payment details.",

  async start({ mount, request, product }) {
    const payLabel = `Pay ${formatPrice(product.price, request.quantity)}`;

    if (config.mode !== "live") {
      mount.replaceChildren(
        mockFrame({
          title: "Whop Payment Elements",
          request,
          payLabel,
          body: `
            <div class="mock-skel">
              <div class="skel">EmailElement · ${esc(request.metadata.email)}</div>
              <div class="skel">PaymentElement · card number</div>
              <div class="skel-row"><div class="skel">MM / YY</div><div class="skel">CVC</div></div>
              <div class="skel">AddressElement · billing address</div>
              <div class="skel" style="justify-content:center">BrandingElement · Powered by Whop</div>
            </div>`,
          note: "Live: <code>createConfirmationToken()</code> → <code>POST /api/payments/confirm</code> → <code>handleNextAction()</code> for 3DS",
        })
      );
      return;
    }

    const form = h(`
      <form class="beta-form">
        <div data-el="email"></div>
        <div data-el="payment"></div>
        <div data-el="address"></div>
        <div data-el="branding"></div>
        <div data-el="alert"></div>
        <button class="submit-btn" type="submit">${esc(payLabel)}</button>
      </form>`);
    mount.replaceChildren(form);
    const el = (k) => form.querySelector(`[data-el="${k}"]`);

    const payments = await mountPaymentElements({
      email: el("email"), payment: el("payment"), address: el("address"), branding: el("branding"),
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      el("alert").replaceChildren();
      try {
        const { confirmationToken } = await payments.createConfirmationToken(); // VERIFY return shape
        let result = await confirmPayment({ confirmationToken, request });
        if (result.status === "requires_action") {
          await payments.handleNextAction(result.nextAction);
          result = { ...result, status: "succeeded" }; // server webhook is the source of truth
        }
        goToReturnPage(request, { paymentId: result.paymentId, status: result.status });
      } catch (err) {
        el("alert").replaceChildren(h(`<div class="form-alert form-alert-error">${esc(err.message)}</div>`));
        btn.disabled = false;
      }
    });

    return { destroy: () => payments.destroy() };
  },
};

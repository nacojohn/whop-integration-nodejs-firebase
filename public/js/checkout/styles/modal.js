/**
 * Popup checkout — the same Whop Checkout Element, hosted in an on-brand modal.
 * Whop has no native popup mode, so the modal is ours; the element inside is Whop's.
 */
import { config } from "../../config.js";
import { mountCheckoutElement } from "../whop.js";
import { createCheckoutConfiguration } from "../api.js";
import { handleWhopComplete } from "../complete.js";
import { mockFrame, checkoutSkeleton, h, esc } from "../mock.js";

function openModal(title) {
  const backdrop = h(`
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal">
        <div class="modal-head">
          <h3 class="beta-form-title" style="margin:0">${esc(title)}</h3>
          <button class="modal-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="modal-body"></div>
        <p class="secure-note">🔒 Secured by Whop</p>
      </div>
    </div>`);
  const close = () => { backdrop.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => e.key === "Escape" && close();
  backdrop.addEventListener("click", (e) => e.target === backdrop && close());
  backdrop.querySelector(".modal-close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(backdrop);
  backdrop.querySelector(".modal-close").focus();
  return { body: backdrop.querySelector(".modal-body"), close };
}

export default {
  id: "modal",
  label: "Popup checkout",
  description: "Checkout opens in an overlay on top of the page. Good for one-click buy buttons.",
  chips: [],
  paymentSub: "Checkout opens in a secure window.",

  async start({ mount, request, product }) {
    let handle = null;
    let modal = null;

    const open = async () => {
      modal?.close();
      handle?.destroy?.();
      modal = openModal(product.name);
      if (config.mode !== "live") {
        modal.body.appendChild(mockFrame({ title: "Whop Checkout Element", request, body: checkoutSkeleton(request) }));
        return;
      }
      const checkoutConfiguration = config.whop.useServerCheckoutConfiguration
        ? (await createCheckoutConfiguration(request)).id
        : undefined;
      handle = await mountCheckoutElement(modal.body, request, {
        checkoutConfiguration,
        onComplete: handleWhopComplete(request),
      });
    };

    const reopen = h(`<button class="submit-btn" type="button">Open checkout</button>`);
    reopen.addEventListener("click", open);
    mount.replaceChildren(reopen);
    await open();

    return { destroy: () => { handle?.destroy?.(); modal?.close(); } };
  },
};

/**
 * Mock-mode rendering helpers: placeholders that show where Whop will mount
 * and what it will contain. No real payment fields are ever rendered here.
 */
import { simulateSuccess, goToReturnPage } from "./complete.js";

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Skeleton of Whop's full checkout element (order summary + email + card + pay). */
export const checkoutSkeleton = (request) => `
  <div class="mock-skel">
    <div class="skel">✉ ${esc(request.metadata.email)}</div>
    <div class="skel">Card number</div>
    <div class="skel-row"><div class="skel">MM / YY</div><div class="skel">CVC</div></div>
    <div class="skel">Promo code${request.promoCode ? ` · <strong style="color:var(--bright)">${esc(request.promoCode)}</strong>` : ""}</div>
  </div>`;

/**
 * Builds a dashed "this is where Whop mounts" frame with simulate buttons.
 * @param {{title:string, body:string, note?:string, request:object, payLabel?:string}} opts
 */
export function mockFrame({ title, body, note, request, payLabel = "Simulate successful payment" }) {
  const el = h(`
    <div class="mock-frame">
      <div class="mock-head">
        <span class="mock-title">${esc(title)}</span>
        <span class="chip warm">Preview</span>
      </div>
      ${body}
      <button class="submit-btn" type="button" data-sim="ok">${esc(payLabel)}</button>
      <button class="back-link" type="button" data-sim="fail" style="margin:.8rem auto 0;display:flex">Simulate a failed payment</button>
      ${note ? `<p class="mock-note">${note}</p>` : ""}
    </div>`);
  el.querySelector('[data-sim="ok"]').addEventListener("click", () => simulateSuccess(request));
  el.querySelector('[data-sim="fail"]').addEventListener("click", () =>
    goToReturnPage(request, { status: "failed", paymentId: "pay_mockfailed" })
  );
  return el;
}

export function showError(container, err) {
  container.replaceChildren(
    h(`<div class="form-alert form-alert-error">${esc(err?.message || "Something went wrong starting checkout.")}</div>`)
  );
}

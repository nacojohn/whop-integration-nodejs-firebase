/**
 * Store page controller: renders products, order summary, checkout-style
 * picker and the two-step checkout card. Payment UI is delegated to the
 * selected style (js/checkout/styles/*).
 */
import { config } from "./config.js";
import { products, findProduct, formatPrice } from "./products.js";
import { getState, setState, subscribe } from "./state.js";
import { checkoutStyles, getCheckoutStyle } from "./checkout/registry.js";
import { buildCheckoutRequest, captureAttribution } from "./checkout/request.js";
import { h, esc, showError } from "./checkout/mock.js";

const $ = (sel) => document.querySelector(sel);

/* ---------------- Products ---------------- */
function priceHtml(p) {
  const { price } = p;
  return `
    <div class="product-price">
      <span class="amount">${esc(formatPrice(price))}</span>
      ${price.interval ? `<span class="interval">/ ${esc(price.interval)}</span>` : ""}
      ${price.compareAt ? `<span class="compare">${esc(formatPrice({ ...price, amount: price.compareAt }))}</span>` : ""}
    </div>`;
}

function renderProducts() {
  const { productId } = getState();
  $("#product-grid").replaceChildren(
    ...products.map((p, i) => {
      const selected = p.id === productId;
      const card = h(`
        <article class="product-card fade-in d${i % 3} ${selected ? "selected" : ""}" data-id="${esc(p.id)}">
          <div class="product-top">
            <span class="card-arrow">${esc(p.icon)}</span>
            <span class="product-tag">${esc(p.tag)}</span>
          </div>
          <h3 class="card-title">${esc(p.name)}</h3>
          <p class="card-desc">${esc(p.description)}</p>
          ${priceHtml(p)}
          <ul class="bullet-list">
            ${p.features.map((f) => `<li><span class="arr">→</span>${esc(f)}</li>`).join("")}
          </ul>
          <button class="ghost-btn" type="button">${selected ? "Selected ✓" : p.price.amount === 0 ? "Get it free →" : "Select →"}</button>
        </article>`);
      card.querySelector("button").addEventListener("click", () => {
        setState({ productId: p.id, quantity: 1 });
        $("#checkout").scrollIntoView({ behavior: "smooth" });
      });
      return card;
    })
  );
  observeFadeIns();
}

/* ---------------- Order summary ---------------- */
function renderSummary() {
  const { productId, quantity, promoCode } = getState();
  const p = findProduct(productId);
  const box = $("#order-summary");
  if (!p) {
    box.replaceChildren(h(`<p class="summary-empty">No product selected yet — <a href="#products" class="footer-link">browse the toolkit</a>.</p>`));
    return;
  }
  box.replaceChildren(
    h(`<div>
      <div class="summary-line">
        <div>
          <div class="summary-name">${esc(p.name)}</div>
          <div class="summary-meta">${esc(p.tag)}${p.price.interval ? ` · billed per ${esc(p.price.interval)}` : ""}</div>
        </div>
        <div class="summary-amount">${esc(formatPrice(p.price))}</div>
      </div>
      <div class="summary-controls">
        ${p.allowQuantity ? `
          <div class="qty" aria-label="Quantity">
            <button type="button" data-q="-1" aria-label="Decrease">−</button>
            <span>${quantity}</span>
            <button type="button" data-q="1" aria-label="Increase">+</button>
          </div>` : ""}
        ${p.price.amount > 0 ? `
          <form class="promo" data-promo>
            <input name="promo" placeholder="Promo code" value="${esc(promoCode)}" autocomplete="off" />
            <button class="ghost-btn" type="submit" style="padding:8px 14px">Apply</button>
          </form>` : ""}
      </div>
      <div class="summary-total">
        <span>Total</span>
        <span style="text-align:right">${esc(formatPrice(p.price, quantity))}${p.price.interval ? ` / ${esc(p.price.interval)}` : ""}
          <small>${promoCode ? `Code “${esc(promoCode)}” applied at checkout` : "Taxes calculated at checkout"}</small></span>
      </div>
    </div>`)
  );
  box.querySelectorAll("[data-q]").forEach((b) =>
    b.addEventListener("click", () => setState({ quantity: Math.max(1, Math.min(10, quantity + Number(b.dataset.q))) }))
  );
  box.querySelector("[data-promo]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    setState({ promoCode: e.target.promo.value.trim().toUpperCase() });
  });
}

/* ---------------- Style picker ---------------- */
function renderStylePicker() {
  const wrap = $("#style-picker-wrap");
  if (!config.allowStyleSwitching) { wrap.hidden = true; return; }
  const { checkoutStyle } = getState();
  $("#style-picker").replaceChildren(
    ...checkoutStyles.map((s) => {
      const opt = h(`
        <button type="button" class="style-option" role="radio" aria-checked="${s.id === checkoutStyle}" data-style="${s.id}">
          <span class="style-radio"></span>
          <span>
            <span class="style-name">${esc(s.label)} ${s.chips.map((c, i) => `<span class="chip ${i === 0 ? "warm" : ""}">${esc(c)}</span>`).join("")}</span>
            <span class="style-desc" style="display:block">${esc(s.description)}</span>
          </span>
        </button>`);
      opt.addEventListener("click", () => setState({ checkoutStyle: s.id }));
      return opt;
    })
  );
}

function renderModeBanner() {
  const live = config.mode === "live";
  $("#mode-banner").innerHTML = live
    ? `<span>●</span><span><strong>Live mode.</strong> Payments go through Whop.</span>`
    : `<span>◎</span><span><strong>Preview mode.</strong> No payments are taken. Each style shows where Whop will mount.
       Switch <code>mode</code> to <code>"live"</code> in <code>js/config.js</code> once plan IDs are set.
       Share a style with <code>?style=${esc(getState().checkoutStyle)}</code>.</span>`;
}

/* ---------------- Checkout card ---------------- */
let activeHandle = null;
let runId = 0;

function setStep(step) {
  setState({ step });
  $("#details-form").hidden = step !== 1;
  $("#payment-step").hidden = step !== 2;
  document.querySelectorAll(".step").forEach((el) => el.classList.toggle("on", Number(el.dataset.step) <= step));
}

function teardown() {
  activeHandle?.destroy?.();
  activeHandle = null;
}

async function startPayment() {
  const { productId, quantity, promoCode, customer, checkoutStyle } = getState();
  const product = findProduct(productId);
  const style = getCheckoutStyle(checkoutStyle);
  const mount = $("#payment-mount");
  const thisRun = ++runId;

  teardown();
  setStep(2);
  $("#payment-sub").textContent = style.paymentSub;
  $("#payment-alert").replaceChildren();
  mount.replaceChildren(h(`<p class="form-note">Loading secure checkout…</p>`));

  const request = buildCheckoutRequest({ product, quantity, promoCode, customer, style: style.id });
  try {
    const handle = await style.start({ mount, request, product });
    if (thisRun !== runId) handle?.destroy?.(); // superseded by a newer start
    else activeHandle = handle;
  } catch (err) {
    console.error(err);
    if (thisRun === runId) showError($("#payment-alert"), err);
  }
}

function readDetails(form) {
  const data = Object.fromEntries(new FormData(form));
  const errors = [];
  const mark = (name, bad) => { form.elements[name].closest(".field").classList.toggle("invalid", bad); if (bad) errors.push(name); };
  mark("firstName", !data.firstName.trim());
  mark("lastName", !data.lastName.trim());
  mark("email", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()));
  mark("stage", !data.stage);
  return { errors, customer: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v).trim()])) };
}

function wireCheckoutCard() {
  const form = $("#details-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const alert = $("#details-alert");
    alert.replaceChildren();
    if (!getState().productId) {
      alert.replaceChildren(h(`<div class="form-alert form-alert-warning">Pick a product above to continue.</div>`));
      $("#products").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const { errors, customer } = readDetails(form);
    if (errors.length) {
      alert.replaceChildren(h(`<div class="form-alert form-alert-error">Please enter a valid email address and complete all required fields.</div>`));
      return;
    }
    setState({ customer });
    startPayment();
  });
  form.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("invalid"));

  $("#back-btn").addEventListener("click", () => { teardown(); runId++; setStep(1); });
}

/* ---------------- Fade-ins (same behaviour as foundacompass.com) ---------------- */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("visible"), io.unobserve(e.target))),
  { threshold: 0.12 }
);
function observeFadeIns() {
  document.querySelectorAll(".fade-in:not(.visible)").forEach((el) => io.observe(el));
}

/* ---------------- Boot ---------------- */
subscribe((state, patch) => {
  if ("productId" in patch) renderProducts();
  if ("productId" in patch || "quantity" in patch || "promoCode" in patch) renderSummary();
  if ("checkoutStyle" in patch) { renderStylePicker(); renderModeBanner(); }
  // Order or style changed mid-payment → restart the payment step with fresh options.
  const affectsPayment = ["productId", "quantity", "promoCode", "checkoutStyle"].some((k) => k in patch);
  if (affectsPayment && state.step === 2) {
    if (state.productId) startPayment(); else { teardown(); setStep(1); }
  }
});

captureAttribution();
const preselect = new URLSearchParams(location.search).get("product");
if (findProduct(preselect)) setState({ productId: preselect });
renderProducts();
renderSummary();
renderStylePicker();
renderModeBanner();
wireCheckoutCard();
observeFadeIns();

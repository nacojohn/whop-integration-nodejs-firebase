/**
 * Tiny observable store for the store page. No framework needed.
 */
import { config } from "./config.js";

const STYLE_KEY = "fc.checkoutStyle";

function initialStyle() {
  const fromUrl = new URLSearchParams(location.search).get("style");
  if (fromUrl && config.enabledStyles.includes(fromUrl)) return fromUrl;
  if (config.allowStyleSwitching) {
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      if (saved && config.enabledStyles.includes(saved)) return saved;
    } catch { /* storage blocked — ignore */ }
  }
  return config.defaultCheckoutStyle;
}

const state = {
  productId: null,
  quantity: 1,
  promoCode: "",
  checkoutStyle: initialStyle(),
  customer: null, // set after step 1 validates
  step: 1,
};

const listeners = new Set();

export const getState = () => state;

export function setState(patch) {
  Object.assign(state, patch);
  if ("checkoutStyle" in patch) {
    try { localStorage.setItem(STYLE_KEY, patch.checkoutStyle); } catch { /* ignore */ }
  }
  listeners.forEach((fn) => fn(state, patch));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

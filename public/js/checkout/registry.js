/**
 * Checkout style registry. To add a style: create styles/<id>.js exporting
 * { id, label, description, chips, paymentSub, start(ctx) } and list it here
 * and in config.enabledStyles.
 *
 * start(ctx) receives { mount, request, product } and may return { destroy() }.
 */
import { config } from "../config.js";
import embedded from "./styles/embedded.js";
import modal from "./styles/modal.js";
import hosted from "./styles/hosted.js";
import express from "./styles/express.js";
import elements from "./styles/elements.js";

const all = { embedded, modal, hosted, express, elements };

export const checkoutStyles = config.enabledStyles.map((id) => all[id]).filter(Boolean);

export const getCheckoutStyle = (id) => all[id] ?? all[config.defaultCheckoutStyle];

/**
 * Store configuration — the one file you edit to change behaviour.
 *
 * mode
 *   "mock" — no Whop calls. Every checkout style renders a faithful placeholder
 *            of what Whop will mount, and "Simulate payment" walks the full
 *            return-URL flow. Safe for a public preview.
 *   "live" — loads Whop Elements from the CDN and talks to /api (Cloud Functions).
 *            Requires real plan IDs in products.js and the functions deployed.
 */
export const config = {
  mode: "live",

  /** Style used when the visitor hasn't picked one (and the only one if switching is off). */
  defaultCheckoutStyle: "embedded",

  /** Show the style picker on the page. Turn off once you've chosen your style. */
  allowStyleSwitching: true,

  /** Which styles appear in the picker, in order. Ids match js/checkout/styles/*.js */
  enabledStyles: ["embedded", "modal", "hosted", "express", "elements"],

  whop: {
    /** Loader from docs.whop.com/elements — loaded lazily, only in live mode. */
    scriptUrl: "https://cdn.whop.com/elements/amber/elements.js",
    environment: "sandbox", // "production" | "sandbox"
    /**
     * Embedded/popup styles normally start checkout from the plan id alone.
     * Set true to have the server create a checkout configuration (ch_…) first,
     * so metadata/redirect/affiliate are set server-side and can't be tampered with.
     */
    useServerCheckoutConfiguration: false,
    locale: "en",
    /**
     * Whop Elements appearance — mapped to the FoundaCompass palette.
     * accentColor must be one of Whop's named scales; "amber" is the closest to #e6a020.
     */
    appearance: {
      theme: { appearance: "dark", accentColor: "amber", grayColor: "sand" },
      variables: { "--radius": "9px" },
    },
  },

  /** Backend (Firebase Cloud Functions, rewritten under /api by firebase.json). */
  api: { base: "/api" },

  /** Where Whop sends the buyer after an off-site step (3DS, hosted checkout). */
  returnPath: "/checkout/return", // cleanUrls → public/checkout/return.html
};

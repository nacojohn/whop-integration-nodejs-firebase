# FoundaCompass Store · Whop Checkout

A static product page and checkout in the foundacompass.com design (same tokens, Inter, amber accent, components). Every Whop checkout style is built in and can be switched at runtime. **Payments aren't wired up yet.** The site runs in `mock` mode, which shows exactly where and how each Whop element will mount.

## Run and deploy

```bash
npm install                     # installs firebase-tools locally
npx firebase login
# put your project id in .firebaserc (or: npx firebase use --add)

npm run dev                     # http://localhost:5000  (site + /api functions)
npm run dev:static              # site only, no functions
npm run deploy:preview          # temporary preview URL (30 days)
npm run deploy                  # live hosting
```

Hosting-only deploys need no paid plan. The `functions/` backend is only needed for live payments (see below).

## Choosing a checkout style

| id | Style | Server? | What it is |
|---|---|---|---|
| `embedded` | Embedded checkout | No | Whop's full Checkout Element inline in the card |
| `modal` | Popup checkout | No | The same element inside an on-brand overlay (Whop has no native popup mode) |
| `hosted` | Hosted checkout page | Yes | Server creates a checkout configuration, then the browser redirects to its `purchase_url` |
| `express` | Express wallets | No | Apple Pay / Google Pay / PayPal buttons plus card fallback (Apple Pay needs domain registration) |
| `elements` | Custom payment form | Yes | Individual Payment Elements in our own form. The server charges the confirmation token |

- **Preview any style:** `?style=modal` (also `?product=pro-monthly`)
- **Lock in one style:** in `public/js/config.js` set `defaultCheckoutStyle` and `allowStyleSwitching: false`.
- **Limit the picker:** edit `enabledStyles`.

## Layout

```
public/
  index.html                  product list + 2-step checkout card
  checkout/return.html        Whop returnUrl landing (?payment=&status=)
  css/styles.css              design tokens ported from foundacompass.com
  js/
    config.js                 ← mode, styles, Whop appearance, API base
    products.js               ← catalog + Whop plan ids
    state.js                  tiny store (product, qty, promo, style)
    main.js                   page controller
    checkout/
      registry.js             style registry
      request.js              builds the checkout request (metadata, UTM, affiliate, returnUrl)
      whop.js                 the ONLY file touching the Whop browser SDK
      api.js                  calls to /api (mocked in mock mode)
      complete.js             return-page handoff
      mock.js                 preview placeholders
      styles/*.js             one module per checkout style
functions/index.js            /api backend: checkout configs, payment confirm, webhook (stubs → 501)
```

Each style module exports `{ id, label, description, chips, paymentSub, start({ mount, request, product }) }`. To add a style, add a file and register it in `registry.js`.

## Going live (later)

1. Create the products and plans in Whop. Replace each `plan_REPLACE_ME_*` in `public/js/products.js` and `ALLOWED_PLANS` in `functions/index.js`.
2. For `embedded` / `modal` / `express`, set `mode: "live"` in `config.js`. That's all these styles need.
3. For `hosted` / `elements` / webhooks:
   - locally: copy `functions/.secret.local.example` → `functions/.secret.local` and fill it in (the emulator reads `defineSecret` values from there)
   - production: `firebase functions:secrets:set WHOP_API_KEY` (and `WHOP_WEBHOOK_SECRET`, `WHOP_COMPANY_ID`)
   - fill in the `TODO(payments)` blocks in `functions/index.js`, and put your real plan ids in its `ALLOWED_PLANS`
   - `npm run deploy:all` (Functions require the Blaze plan). `firebase.json` already routes `/api/**` to the function.
   - in the Whop dashboard, point a webhook at `https://<site>/api/webhooks/whop` for `payment.succeeded` etc.
4. Check the lines marked `VERIFY` in `public/js/checkout/whop.js` against the current `@whop/elements` docs.
5. If you add a CSP, allow `https://cdn.whop.com` (script/frame) and `https://api.whop.com` (connect).

**Fulfil from the `payment.succeeded` webhook, never from the return page.** The return page's query params are display-only.

## Products

*Founder Validation Guide* and *Founding Member Beta* are FoundaCompass's real offerings. The other four are marked `placeholder: true` and are only there so the checkout has paid items. Rename, reprice or delete them.

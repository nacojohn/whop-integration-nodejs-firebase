/**
 * Shared completion handling. Mirrors Whop's returnUrl contract so the return
 * page works identically for every style: ?payment=pay_…&status=succeeded|failed|canceled
 *
 * Display only — fulfilment must come from the payment.succeeded webhook.
 */
export function goToReturnPage(request, { paymentId, status = "succeeded", sessionId, setupIntentId } = {}) {
  const url = new URL(request.returnUrl);
  if (paymentId || setupIntentId) url.searchParams.set("payment", paymentId || setupIntentId);
  url.searchParams.set("status", status);
  if (sessionId) url.searchParams.set("session", sessionId);
  location.assign(url.toString());
}

/**
 * Whop onComplete payload → return page.
 * Payload: { sessionId: "chs_…", result: "payment" | "waitlist_entry" | "setup",
 *            paymentId?: "pay_…", entryId?: "ent_…", setupIntentId?: "sint_…" }
 *
 * Whop itself redirects the tab to returnUrl after a finished checkout, and
 * onComplete fires just before that. So we don't navigate immediately (that
 * would race Whop's redirect); we only step in if no redirect has started.
 */
export function handleWhopComplete(request) {
  return (payload) => {
    console.info("[whop] checkout complete", payload);
    let leaving = false;
    addEventListener("pagehide", () => { leaving = true; }, { once: true });
    setTimeout(() => {
      if (leaving) return;
      goToReturnPage(request, {
        paymentId: payload?.paymentId || payload?.entryId,
        setupIntentId: payload?.setupIntentId,
        sessionId: payload?.sessionId,
        status: "succeeded",
      });
    }, 2000);
  };
}

export function simulateSuccess(request) {
  goToReturnPage(request, {
    paymentId: `pay_mock${Math.random().toString(36).slice(2, 10)}`,
    sessionId: `chs_mock${Math.random().toString(36).slice(2, 8)}`,
  });
}

/**
 * Product catalog.
 *
 * whopPlanId — the plan_… id from your Whop dashboard (Products → Plans).
 *              Replace every "plan_REPLACE_ME_*" before switching config.mode to "live".
 * price      — display only. Whop is the source of truth for what's charged.
 *
 * The first two items are FoundaCompass's real offerings (foundacompass.com/download
 * and /beta). Items marked `placeholder: true` are sample paid products so the
 * checkout has something to charge for — rename, reprice or delete them.
 */
export const products = [
  {
    id: "founder-guide",
    icon: "→",
    tag: "Free guide",
    name: "Founder Validation Guide",
    description:
      "The validation playbook most founders follow wasn't designed to find the truth. This one was.",
    features: ["The Double Gap", "False Positives Decoded", "Who Is Your Customer?"],
    price: { amount: 0, currency: "usd" },
    whopPlanId: "plan_REPLACE_ME_GUIDE",
    allowQuantity: false,
  },
  {
    id: "founding-beta",
    icon: "⊕",
    tag: "Limited spots",
    name: "Founding Member Beta",
    description:
      "Join a small founding cohort getting AI-powered validation feedback before we launch publicly.",
    features: [
      "Free during the entire beta",
      "Weekly founder check-ins",
      "Founding member pricing — forever",
    ],
    price: { amount: 0, currency: "usd", label: "Free during beta" },
    whopPlanId: "plan_REPLACE_ME_BETA",
    allowQuantity: false,
  },
  {
    id: "signal-report",
    icon: "◎",
    tag: "One-time",
    name: "Validation Signal Report",
    description:
      "Get a signal score on your idea in minutes — not weeks of customer interviews.",
    features: ["AI-powered validation scoring", "False-positive audit", "PDF report"],
    price: { amount: 49, currency: "usd" },
    whopPlanId: "plan_REPLACE_ME_REPORT",
    allowQuantity: true,
    placeholder: true,
  },
  {
    id: "pro-monthly",
    icon: "✦",
    tag: "Most popular",
    name: "FoundaCompass Pro",
    description:
      "Continuous validation as you build. Locked-in founding member pricing after public launch.",
    features: ["Unlimited signal scores", "Customer-fit tracking", "Priority access"],
    price: { amount: 29, currency: "usd", interval: "month", compareAt: 49 },
    whopPlanId: "plan_REPLACE_ME_PRO",
    allowQuantity: false,
    placeholder: true,
  },
  {
    id: "review-session",
    icon: "⊞",
    tag: "1:1",
    name: "Founder Review Session",
    description:
      "Direct access to the FoundaCompass team. We review your validation together.",
    features: ["60-minute session", "Async follow-up notes", "Recording included"],
    price: { amount: 149, currency: "usd" },
    whopPlanId: "plan_REPLACE_ME_SESSION",
    allowQuantity: true,
    placeholder: true,
  },
  {
    id: "sprint-bundle",
    icon: "→",
    tag: "Bundle",
    name: "Validation Sprint Bundle",
    description:
      "Report, review session and three months of Pro — everything to get from idea to real signal.",
    features: ["Signal Report", "Founder Review Session", "3 months of Pro"],
    price: { amount: 199, currency: "usd", compareAt: 285 },
    whopPlanId: "plan_REPLACE_ME_BUNDLE",
    allowQuantity: false,
    placeholder: true,
  },
];

export const findProduct = (id) => products.find((p) => p.id === id) ?? null;

export function formatPrice(price, quantity = 1) {
  if (price.label && price.amount === 0) return price.label;
  if (price.amount === 0) return "Free";
  const total = price.amount * quantity;
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    maximumFractionDigits: Number.isInteger(total) ? 0 : 2,
  });
  return fmt.format(total);
}

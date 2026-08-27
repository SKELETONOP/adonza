import type { authenticate } from "../shopify.server";
import type { PlanName } from "./plans";

type Billing = Awaited<ReturnType<typeof authenticate.admin>>["billing"];

// Whether to use Shopify's test-charge flow (no real money moves) instead of
// a live charge. Real merchants in production should always be billed for
// real; only our own dev/test stores should use test charges.
export function isTestBilling() {
  return process.env.NODE_ENV !== "production";
}

// Looks at this shop's active Shopify-billed subscriptions (Pro/Advanced)
// to work out its effective plan. No active subscription = Basic (the free
// tier), since Basic isn't a real billed plan.
export async function getCurrentPlan({
  billing,
}: {
  billing: Billing;
}): Promise<{ plan: PlanName; subscriptionId: string | null }> {
  const { appSubscriptions } = await billing.check({
    plans: ["Pro", "Advanced"],
    isTest: isTestBilling(),
  });

  const advanced = appSubscriptions.find((s) => s.name === "Advanced");
  if (advanced) return { plan: "Advanced", subscriptionId: advanced.id };

  const pro = appSubscriptions.find((s) => s.name === "Pro");
  if (pro) return { plan: "Pro", subscriptionId: pro.id };

  return { plan: "Basic", subscriptionId: null };
}

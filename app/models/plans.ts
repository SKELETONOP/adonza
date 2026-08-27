// Plain plan data - safe to import from both server code and client-rendered
// components. Anything that touches billing.check()/process.env lives in
// billing.server.ts instead, since that file can only be imported by
// loaders/actions.
export type PlanName = "Basic" | "Pro" | "Advanced";

export const PLAN_DETAILS: Record<
  PlanName,
  {
    priceAmount: number;
    ruleLimit: number;
    description: string;
    features: string[];
    recommended?: boolean;
  }
> = {
  Basic: {
    priceAmount: 0,
    ruleLimit: 1,
    description: "Good for trying the app out.",
    features: ["1 active rule", "Free gift popup", "Email support"],
  },
  Pro: {
    priceAmount: 5,
    ruleLimit: 15,
    description: "For most growing stores.",
    features: ["Up to 15 rules", "Popup customization", "Priority support"],
    recommended: true,
  },
  Advanced: {
    priceAmount: 15,
    ruleLimit: Infinity,
    description: "For stores running lots of promotions.",
    features: ["Unlimited rules", "Popup customization", "Priority support"],
  },
};

export function ruleLimitFor(plan: PlanName) {
  return PLAN_DETAILS[plan].ruleLimit;
}

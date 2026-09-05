import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import RuleForm, { type RuleFormValues } from "../components/RuleForm";
import { ensureAutomaticDiscount } from "../models/discount.server";
import { getCurrentPlan } from "../models/billing.server";
import { ruleLimitFor } from "../models/plans";
import { UpgradeBanner } from "../components/ui";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);

  const { plan } = await getCurrentPlan({ billing });
  const limit = ruleLimitFor(plan);
  const existingCount = await db.rule.count({ where: { shop: session.shop } });

  if (existingCount >= limit) {
    return json(
      {
        error: `Your ${plan} plan allows ${
          limit === Infinity ? "unlimited" : `up to ${limit}`
        } rule${limit === 1 ? "" : "s"}. Upgrade to add more.`,
      },
      { status: 403 },
    );
  }

  const values = (await request.json()) as RuleFormValues;

  // Makes sure the free gift line is actually free at checkout via our
  // discount Function, without ever changing the product's real price.
  await ensureAutomaticDiscount(admin, session.shop);

  await db.rule.create({
    data: {
      shop: session.shop,
      title: values.title,
      active: values.active,
      triggerMode: values.triggerMode,
      triggerBasis: values.triggerBasis,
      triggerQuantity: values.triggerQuantity,
      triggerAmount:
        values.triggerBasis === "amount"
          ? Math.round(values.triggerAmount * 100)
          : null,
      freeQuantity: values.freeQuantity,
      triggerItems:
        values.triggerMode === "specific"
          ? {
              create: values.triggerItems.map((item) => ({
                productId: item.productId,
                productTitle: item.productTitle,
                variantId: item.variantId,
                variantTitle: item.variantTitle,
                imageUrl: item.imageUrl ?? null,
              })),
            }
          : undefined,
      freeOptions: {
        create: values.freeOptions.map((option) => ({
          productId: option.productId,
          productTitle: option.productTitle,
          variantId: option.variantId,
          variantTitle: option.variantTitle,
          imageUrl: option.imageUrl ?? null,
        })),
      },
    },
  });

  return redirect("/app/rules");
};

export default function NewRule() {
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();

  return (
    <RuleForm
      submitLabel="Create rule"
      onSubmit={(values) =>
        submit(values as any, { method: "post", encType: "application/json" })
      }
      banner={
        actionData?.error ? (
          <UpgradeBanner message={actionData.error} actionUrl="/app/billing" />
        ) : undefined
      }
    />
  );
}

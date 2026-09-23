import { redirect } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import RuleForm from "../components/RuleForm";
import { ensureAutomaticDiscount } from "../models/discount.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);

  const rule = await db.rule.findFirst({
    where: { id: params.id, shop: session.shop },
  });

  if (!rule) {
    throw new Response("Rule not found", { status: 404 });
  }

  return { rule };
};

export const action = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const id = String(params.id);

  const existing = await db.rule.findFirst({
    where: { id, shop: session.shop },
  });
  if (!existing) {
    throw new Response("Rule not found", { status: 404 });
  }

  const values = await request.json();

  await ensureAutomaticDiscount(admin, session.shop);

  await db.rule.update({
    where: { id },
    data: {
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
      // Embedded composite arrays - assigning replaces the whole array, no
      // deleteMany/create relation dance needed like the old Postgres schema.
      triggerItems:
        values.triggerMode === "specific"
          ? values.triggerItems.map((item) => ({
              productId: item.productId,
              productTitle: item.productTitle,
              variantId: item.variantId,
              variantTitle: item.variantTitle,
              imageUrl: item.imageUrl ?? null,
            }))
          : [],
      freeOptions: values.freeOptions.map((option) => ({
        productId: option.productId,
        productTitle: option.productTitle,
        variantId: option.variantId,
        variantTitle: option.variantTitle,
        imageUrl: option.imageUrl ?? null,
      })),
    },
  });

  return redirect("/app/rules");
};

export default function EditRule() {
  const { rule } = useLoaderData();
  const submit = useSubmit();

  return (
    <RuleForm
      submitLabel="Save rule"
      initialValues={{
        ...rule,
        triggerAmount: (rule.triggerAmount ?? 0) / 100,
      }}
      onSubmit={(values) =>
        submit(values, { method: "post", encType: "application/json" })
      }
    />
  );
}

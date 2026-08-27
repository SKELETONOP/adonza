import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import RuleForm, { type RuleFormValues } from "../components/RuleForm";
import { ensureAutomaticDiscount } from "../models/discount.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const rule = await db.rule.findFirst({
    where: { id: params.id, shop: session.shop },
    include: { triggerItems: true, freeOptions: true },
  });

  if (!rule) {
    throw new Response("Rule not found", { status: 404 });
  }

  return { rule };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const id = String(params.id);

  const existing = await db.rule.findFirst({
    where: { id, shop: session.shop },
  });
  if (!existing) {
    throw new Response("Rule not found", { status: 404 });
  }

  const values = (await request.json()) as RuleFormValues;

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
      triggerItems: {
        deleteMany: {},
        create:
          values.triggerMode === "specific"
            ? values.triggerItems.map((item) => ({
                productId: item.productId,
                productTitle: item.productTitle,
                variantId: item.variantId,
                variantTitle: item.variantTitle,
                imageUrl: item.imageUrl ?? null,
              }))
            : [],
      },
      freeOptions: {
        deleteMany: {},
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

export default function EditRule() {
  const { rule } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  return (
    <RuleForm
      submitLabel="Save rule"
      initialValues={{
        ...rule,
        triggerAmount: (rule.triggerAmount ?? 0) / 100,
      } as any}
      onSubmit={(values) =>
        submit(values as any, { method: "post", encType: "application/json" })
      }
    />
  );
}

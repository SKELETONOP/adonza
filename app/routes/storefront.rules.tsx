import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Called by the storefront (extensions/bogo-free-gift/assets/bogo.js) through
// Shopify's App Proxy. The storefront calls
// https://<shop>/apps/bogo/storefront/rules ([app_proxy] prefix="apps",
// subpath="bogo" in shopify.app.toml); Shopify strips the "/apps/bogo" part
// and forwards the remainder ("/storefront/rules") to this app's URL - which
// is why this route file's path (storefront.rules.tsx -> /storefront/rules)
// must match the remainder, not the full public-facing path.
// authenticate.public.appProxy verifies Shopify's request signature for us.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return json({ rules: [] });
  }

  const rules = await db.rule.findMany({
    where: { shop: session.shop, active: true },
    select: {
      id: true,
      triggerMode: true,
      triggerBasis: true,
      triggerQuantity: true,
      triggerAmount: true,
      freeQuantity: true,
      triggerItems: {
        select: { productId: true, variantId: true },
      },
      freeOptions: {
        select: {
          productId: true,
          variantId: true,
          variantTitle: true,
          productTitle: true,
          imageUrl: true,
        },
      },
    },
  });

  return json(
    { rules },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
};

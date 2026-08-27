import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getDesignSettings } from "../models/design.server";
import { DEFAULT_DESIGN } from "../models/design";

// Same App Proxy mechanics as storefront.rules.tsx: the storefront calls
// /apps/bogo/storefront/design, and Shopify forwards the remainder
// ("/storefront/design") to this route.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return Response.json(DEFAULT_DESIGN);
  }

  const design = await getDesignSettings(session.shop);

  return Response.json(design, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
};

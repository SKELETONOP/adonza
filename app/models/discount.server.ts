import db from "../db.server";

// Must match the `handle` in extensions/bogo-free-discount/shopify.extension.toml.
const FUNCTION_HANDLE = "bogo-free-discount";

type AdminGraphqlClient = {
  graphql: (query: string, options?: { variables?: any }) => Promise<Response>;
};

/**
 * Makes sure this shop has an active Shopify automatic discount wired up to
 * our discount Function (extensions/bogo-free-discount). That Function
 * looks for cart lines tagged with the `_bogo_rule_id` property (set by the
 * storefront script when it auto-adds a free gift) and makes only those
 * lines 100% off - the product's real catalog price is never touched.
 *
 * Idempotent: the created discount's id is cached on ShopSettings, so this
 * only calls the Admin API once per shop, no matter how many rules are
 * created/edited afterwards.
 */
export async function ensureAutomaticDiscount(
  admin: AdminGraphqlClient,
  shop: string,
): Promise<string | null> {
  const existing = await db.shopSettings.findUnique({ where: { shop } });
  if (existing?.automaticDiscountId) {
    return existing.automaticDiscountId;
  }

  const response = await admin.graphql(
    `#graphql
      mutation CreateBogoAutomaticDiscount($input: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $input) {
          automaticAppDiscount {
            discountId
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          title: "Buy X Get Y Free — free gift",
          functionHandle: FUNCTION_HANDLE,
          discountClasses: ["PRODUCT"],
          startsAt: new Date().toISOString(),
          combinesWith: {
            orderDiscounts: true,
            productDiscounts: true,
            shippingDiscounts: true,
          },
        },
      },
    },
  );

  const json = await response.json();
  const result = json?.data?.discountAutomaticAppCreate;
  const userErrors = result?.userErrors ?? [];

  if (userErrors.length > 0) {
    console.error("Failed to create automatic discount", userErrors);
    return null;
  }

  const discountId: string | null = result?.automaticAppDiscount?.discountId ?? null;

  if (discountId) {
    await db.shopSettings.upsert({
      where: { shop },
      create: { shop, automaticDiscountId: discountId },
      update: { automaticDiscountId: discountId },
    });
  }

  return discountId;
}

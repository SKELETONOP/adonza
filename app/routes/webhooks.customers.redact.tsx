import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Mandatory GDPR compliance webhook: a shop has asked to have a specific
// customer's data erased. This app never stores any Shopify customer data
// (only shop-level rules/settings and the app's own OAuth session for shop
// staff) - there's nothing to redact, so this just verifies the webhook
// and acknowledges it.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  return new Response();
};

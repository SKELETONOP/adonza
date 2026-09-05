import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Mandatory GDPR compliance webhook: a customer has asked a shop for the
// data an app stores about them. This app never stores any Shopify
// customer data (only shop-level rules/settings and the app's own OAuth
// session for shop staff) - there's nothing to collect or return, so this
// just verifies the webhook and acknowledges it.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  return new Response();
};

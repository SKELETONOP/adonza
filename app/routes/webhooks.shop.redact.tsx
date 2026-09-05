import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory GDPR compliance webhook, sent ~48 hours after a shop uninstalls
// the app: erase any data still held for that shop. Our uninstall webhook
// (webhooks.app.uninstalled.tsx) already deletes everything on uninstall,
// so this is mostly a safety net for any shop whose uninstall webhook
// didn't fire - all deletes are safe to repeat.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await db.session.deleteMany({ where: { shop } });
  await db.rule.deleteMany({ where: { shop } });
  await db.shopSettings.deleteMany({ where: { shop } });
  await db.feedback.deleteMany({ where: { shop } });

  return new Response();
};

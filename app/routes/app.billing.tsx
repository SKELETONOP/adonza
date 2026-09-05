import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Icon,
  Divider,
  Box,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getCurrentPlan, isTestBilling } from "../models/billing.server";
import { PLAN_DETAILS, type PlanName } from "../models/plans";
import { Pill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  const [{ plan }, ruleCount] = await Promise.all([
    getCurrentPlan({ billing }),
    db.rule.count({ where: { shop: session.shop } }),
  ]);

  return { currentPlan: plan, ruleCount };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const targetPlan = String(formData.get("plan")) as PlanName;
  const isTest = isTestBilling();

  const { plan: currentPlan, subscriptionId } = await getCurrentPlan({
    billing,
  });

  if (targetPlan === currentPlan) {
    return null;
  }

  // Switching away from a paid plan (to Basic, or to the other paid plan)
  // means the old subscription has to be cancelled first.
  if (subscriptionId) {
    await billing.cancel({ subscriptionId, isTest, prorate: true });
  }

  if (targetPlan === "Basic") {
    return null;
  }

  const returnUrl = `${new URL(request.url).origin}/app/billing`;

  // billing.request redirects the merchant to Shopify's charge-approval
  // page and never returns normally on success.
  await billing.request({ plan: targetPlan, isTest, returnUrl });

  return null;
};

export default function Billing() {
  const { currentPlan, ruleCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const plans: PlanName[] = ["Basic", "Pro", "Advanced"];

  return (
    <Page
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
      title="Plans & billing"
      subtitle={`You currently have ${ruleCount} rule${ruleCount === 1 ? "" : "s"} saved.`}
    >
      <BlockStack gap="400">
        <Banner tone="info" title={`You're on the ${currentPlan} plan`}>
          <p>
            {currentPlan === "Advanced"
              ? "Unlimited rules are included. Change plans at any time."
              : "Change plans at any time - upgrades apply right away."}
          </p>
        </Banner>

        <Layout>
          {plans.map((plan) => {
            const details = PLAN_DETAILS[plan];
            const isCurrent = plan === currentPlan;
            return (
              <Layout.Section variant="oneThird" key={plan}>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        {plan}
                      </Text>
                      {isCurrent ? (
                        <Pill color="green">Current plan</Pill>
                      ) : details.recommended ? (
                        <Pill color="orange">Recommended</Pill>
                      ) : null}
                    </InlineStack>

                    <InlineStack gap="100" blockAlign="baseline">
                      <Text as="span" variant="heading2xl">
                        ${details.priceAmount}
                      </Text>
                      <Text as="span" tone="subdued">
                        /month
                      </Text>
                    </InlineStack>

                    <Divider />

                    <BlockStack gap="200">
                      {details.features.map((feature) => (
                        <InlineStack key={feature} gap="200" blockAlign="center" wrap={false}>
                          <Icon source={CheckIcon} tone="success" />
                          <Text as="span">{feature}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>

                    <Text as="p" tone="subdued" variant="bodySm">
                      {details.description}
                    </Text>

                    <Box>
                      <Button
                        variant={
                          isCurrent ? undefined : details.recommended ? "primary" : undefined
                        }
                        fullWidth
                        disabled={isCurrent}
                        loading={
                          fetcher.state !== "idle" &&
                          fetcher.formData?.get("plan") === plan
                        }
                        onClick={() =>
                          fetcher.submit({ plan }, { method: "post" })
                        }
                      >
                        {isCurrent
                          ? "Current plan"
                          : plan === "Basic"
                            ? "Downgrade to Basic"
                            : `Choose ${plan}`}
                      </Button>
                    </Box>
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>
      </BlockStack>
    </Page>
  );
}

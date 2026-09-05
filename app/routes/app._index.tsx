import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  List,
  Link,
  InlineStack,
  Button,
  InlineGrid,
  Icon,
  TextField,
  Box,
  Divider,
} from "@shopify/polaris";
import {
  GiftCardIcon,
  PaintBrushFlatIcon,
  CreditCardIcon,
  ChatIcon,
  CheckCircleIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getCurrentPlan } from "../models/billing.server";
import { sendFeedbackEmail } from "../models/notify.server";
import { ruleLimitFor } from "../models/plans";
import { IconBadge, Pill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  const [activeCount, totalCount, { plan }] = await Promise.all([
    db.rule.count({ where: { shop: session.shop, active: true } }),
    db.rule.count({ where: { shop: session.shop } }),
    getCurrentPlan({ billing }),
  ]);

  // Deep link straight to activating the app embed block, instead of just
  // the generic theme editor - see shopify.dev's theme app extension
  // deep-linking docs. "bogo-free-gift" is the block's handle (the
  // filename of extensions/bogo-free-gift/blocks/bogo-free-gift.liquid).
  const embedDeepLink = `https://${session.shop}/admin/themes/current/editor?context=apps&activateAppId=${process.env.SHOPIFY_API_KEY}/bogo-free-gift`;

  return {
    activeCount,
    totalCount,
    plan,
    limit: ruleLimitFor(plan),
    embedDeepLink,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const message = String(formData.get("message") || "").trim();

  if (!message) {
    return { ok: false };
  }

  await db.feedback.create({ data: { shop: session.shop, message } });
  await sendFeedbackEmail({ shop: session.shop, message });

  return { ok: true };
};

function QuickActionCard({
  icon,
  color,
  title,
  description,
  buttonLabel,
  url,
}: {
  icon: any;
  color: "orange" | "purple" | "blue";
  title: string;
  description: string;
  buttonLabel: string;
  url: string;
}) {
  const navigate = useNavigate();
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="200" blockAlign="center">
          <IconBadge icon={icon} color={color} />
          <Text as="h3" variant="headingSm">
            {title}
          </Text>
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">
          {description}
        </Text>
        <Box>
          <Button onClick={() => navigate(url)}>{buttonLabel}</Button>
        </Box>
      </BlockStack>
    </Card>
  );
}

function SetupStep({
  done,
  title,
  description,
}: {
  done: boolean;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <InlineStack gap="300" blockAlign="start" wrap={false}>
      <Box paddingBlockStart="050">
        {done ? (
          <Icon source={CheckCircleIcon} tone="success" />
        ) : (
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "2px solid #d1d1d1",
              flexShrink: 0,
            }}
          />
        )}
      </Box>
      <BlockStack gap="050">
        <Text as="p" fontWeight="semibold">
          {title}
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {description}
        </Text>
      </BlockStack>
    </InlineStack>
  );
}

export default function Index() {
  const { activeCount, totalCount, plan, limit, embedDeepLink } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Thanks for the feedback!");
      setFeedback("");
    }
  }, [fetcher.data, shopify]);

  return (
    <Page
      title="Buy X, Get Y Free"
      titleMetadata={<Pill color="blue">{`${plan} plan`}</Pill>}
      subtitle="Automatic free gifts on your storefront — no theme code required."
      primaryAction={{
        content: "Create rule",
        onAction: () => navigate("/app/rules/new"),
      }}
      secondaryActions={[
        { content: "Customize popup", onAction: () => navigate("/app/design") },
        { content: "View plans", onAction: () => navigate("/app/billing") },
      ]}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <InlineGrid columns={3} gap="400">
                    <BlockStack gap="050">
                      <Text as="p" tone="subdued">
                        Active rules
                      </Text>
                      <Text as="p" variant="heading2xl">
                        {activeCount}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text as="p" tone="subdued">
                        Total rules
                      </Text>
                      <Text as="p" variant="heading2xl">
                        {totalCount}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text as="p" tone="subdued">
                        Rule limit
                      </Text>
                      <Text as="p" variant="heading2xl">
                        {limit === Infinity ? "Unlimited" : limit}
                      </Text>
                    </BlockStack>
                  </InlineGrid>
                  <Divider />
                  <InlineStack gap="300">
                    <Button
                      variant="primary"
                      url={totalCount > 0 ? "/app/rules" : "/app/rules/new"}
                    >
                      {totalCount > 0 ? "Manage rules" : "Create your first rule"}
                    </Button>
                    <Button url="/app/design">Customize popup</Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                <QuickActionCard
                  icon={GiftCardIcon}
                  color="orange"
                  title="Free gift rules"
                  description="Create, edit, and manage your Buy X Get Y Free rules."
                  buttonLabel="View rules"
                  url="/app/rules"
                />
                <QuickActionCard
                  icon={PaintBrushFlatIcon}
                  color="purple"
                  title="Popup design"
                  description="Customize how the free-gift-picker popup looks on your store."
                  buttonLabel="Customize"
                  url="/app/design"
                />
                <QuickActionCard
                  icon={CreditCardIcon}
                  color="blue"
                  title="Plans & billing"
                  description="See your plan, rule limits, and upgrade options."
                  buttonLabel="View plans"
                  url="/app/billing"
                />
              </InlineGrid>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={ChatIcon} tone="subdued" />
                      <Text as="h2" variant="headingMd">
                        Send us feedback
                      </Text>
                    </InlineStack>
                  </InlineStack>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Found a bug, or have an idea for a feature? Let us know -
                    we read every message.
                  </Text>
                  <fetcher.Form method="post">
                    <BlockStack gap="300">
                      <TextField
                        label="Your feedback"
                        labelHidden
                        name="message"
                        value={feedback}
                        onChange={setFeedback}
                        multiline={4}
                        autoComplete="off"
                        placeholder="Tell us what's working, what's not, or what you'd like to see..."
                      />
                      <Box>
                        <Button
                          submit
                          variant="primary"
                          loading={fetcher.state !== "idle"}
                          disabled={!feedback.trim()}
                        >
                          Send feedback
                        </Button>
                      </Box>
                    </BlockStack>
                  </fetcher.Form>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Setup guide
                  </Text>
                  <SetupStep
                    done
                    title="Install the app"
                    description="You're all set here."
                  />
                  <SetupStep
                    done={totalCount > 0}
                    title="Create a rule"
                    description="Pick trigger products, the quantity or amount, and the free gift options."
                  />
                  <SetupStep
                    done={false}
                    title="Enable the app embed"
                    description={
                      <>
                        Turn on the "Buy X Get Y Free" embed - this link
                        opens your theme editor with it ready to{" "}
                        <Link url={embedDeepLink} target="_blank" removeUnderline>
                          activate directly
                        </Link>
                        .
                      </>
                    }
                  />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    How it works
                  </Text>
                  <List>
                    <List.Item>
                      A Shopify Function makes the free gift 100% off at
                      checkout, automatically - the product's real price is
                      never changed.
                    </List.Item>
                    <List.Item>
                      Shoppers who meet the condition get the free item
                      added to their cart automatically.
                    </List.Item>
                    <List.Item>
                      With more than one gift option, they choose via the
                      popup.
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  EmptyState,
  useIndexResourceState,
  Button,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getCurrentPlan } from "../models/billing.server";
import { ruleLimitFor } from "../models/plans";
import { Pill, ProductThumb, UpgradeBanner } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  const [rules, { plan }] = await Promise.all([
    db.rule.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      include: { triggerItems: true, freeOptions: true },
    }),
    getCurrentPlan({ billing }),
  ]);

  const limit = ruleLimitFor(plan);

  return { rules, plan, limit, atLimit: rules.length >= limit };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle") {
    const id = String(formData.get("id"));
    const rule = await db.rule.findFirst({ where: { id, shop: session.shop } });
    if (rule) {
      await db.rule.update({
        where: { id },
        data: { active: !rule.active },
      });
    }
  }

  if (intent === "delete") {
    const id = String(formData.get("id"));
    await db.rule.deleteMany({ where: { id, shop: session.shop } });
  }

  return null;
};

function ThumbnailStack({
  items,
}: {
  items: { imageUrl: string | null; productTitle: string }[];
}) {
  const shown = items.slice(0, 3);
  if (shown.length === 0) {
    return <ProductThumb alt="No product" />;
  }
  return (
    <InlineStack gap="100" blockAlign="center">
      {shown.map((item, i) => (
        <ProductThumb
          key={i}
          src={item.imageUrl}
          alt={item.productTitle}
        />
      ))}
    </InlineStack>
  );
}

export default function RulesIndex() {
  const { rules, plan, limit, atLimit } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const resourceName = { singular: "rule", plural: "rules" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(rules as any);

  const activeCount = rules.filter((r) => r.active).length;

  const toggleRule = (id: string) => {
    submit({ intent: "toggle", id }, { method: "post" });
  };

  const deleteRule = (id: string) => {
    if (confirm("Delete this rule? This cannot be undone.")) {
      submit({ intent: "delete", id }, { method: "post" });
    }
  };

  return (
    <Page>
      <TitleBar title="Free gift rules">
        <button
          variant="primary"
          disabled={atLimit}
          onClick={() => navigate("/app/rules/new")}
        >
          Create rule
        </button>
      </TitleBar>
      <BlockStack gap="400">
        {atLimit && (
          <UpgradeBanner
            message={`Your ${plan} plan allows ${
              limit === Infinity ? "unlimited" : `up to ${limit}`
            } rule${limit === 1 ? "" : "s"}. Upgrade to add more.`}
            actionUrl="/app/billing"
          />
        )}

        {rules.length > 0 && (
          <InlineStack gap="200">
            <Pill color="blue">{`${rules.length} total`}</Pill>
            <Pill color="green">{`${activeCount} active`}</Pill>
            <Pill color="gray">{`${plan} plan`}</Pill>
          </InlineStack>
        )}

        <Card padding="0">
          {rules.length === 0 ? (
            <EmptyState
              heading="Create your first Buy X, Get Y Free rule"
              action={{
                content: "Create rule",
                onAction: () => navigate("/app/rules/new"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Example: buy 3 T-Shirts and automatically get 1 Trouser free.
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={rules.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Rule" },
                { title: "Buy" },
                { title: "Get free" },
                { title: "Status" },
                { title: "Actions" },
              ]}
            >
              {rules.map((rule, index) => (
                <IndexTable.Row
                  id={rule.id}
                  key={rule.id}
                  position={index}
                  selected={selectedResources.includes(rule.id)}
                >
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">
                        {rule.title}
                      </Text>
                      <ThumbnailStack items={rule.triggerItems} />
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {(() => {
                      const condition =
                        rule.triggerBasis === "amount"
                          ? `$${((rule.triggerAmount ?? 0) / 100).toFixed(2)} spent`
                          : `${rule.triggerQuantity} items`;
                      const scope =
                        rule.triggerMode === "storewide"
                          ? "any product"
                          : `across ${rule.triggerItems.length} ${
                              rule.triggerItems.length === 1
                                ? "product"
                                : "products"
                            }`;
                      return <Text as="span">{`${condition}, ${scope}`}</Text>;
                    })()}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <BlockStack gap="150">
                      <ThumbnailStack items={rule.freeOptions} />
                      <Text as="span" tone="subdued" variant="bodySm">
                        {rule.freeQuantity} free, choice of{" "}
                        {rule.freeOptions.length}{" "}
                        {rule.freeOptions.length === 1 ? "product" : "products"}
                      </Text>
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Pill color={rule.active ? "green" : "gray"}>
                      {rule.active ? "Active" : "Inactive"}
                    </Pill>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      <Button
                        size="slim"
                        onClick={() => navigate(`/app/rules/${rule.id}`)}
                      >
                        Edit
                      </Button>
                      <Button size="slim" onClick={() => toggleRule(rule.id)}>
                        {rule.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="slim"
                        tone="critical"
                        onClick={() => deleteRule(rule.id)}
                      >
                        Delete
                      </Button>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}

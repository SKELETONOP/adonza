import { useState } from "react";
import { useNavigate, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Select,
  Checkbox,
  Box,
  Icon,
  Divider,
} from "@shopify/polaris";
import { XIcon, ImageIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Pill, ProductThumb } from "./ui";

export type PickedVariant = {
  id: string;
  title: string;
  price?: string;
  imageUrl?: string;
};

export type Item = {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  imageUrl?: string;
  variants?: PickedVariant[];
};

export type TriggerMode = "specific" | "storewide";
export type TriggerBasis = "quantity" | "amount";

export type RuleFormValues = {
  id?: string;
  title: string;
  active: boolean;
  triggerMode: TriggerMode;
  triggerItems: Item[];
  triggerBasis: TriggerBasis;
  triggerQuantity: number;
  /** Dollars (e.g. 30 for $30.00). Converted to cents when saved. */
  triggerAmount: number;
  freeOptions: Item[];
  freeQuantity: number;
};

function ItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: Item;
  onChange: (item: Item) => void;
  onRemove: () => void;
}) {
  const shopify = useAppBridge();

  const pick = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      action: "select",
      multiple: false,
    });
    if (!selected || selected.length === 0) return;
    const chosen: any = selected[0];
    const productImage = chosen.images?.[0]?.originalSrc as string | undefined;
    const variants: PickedVariant[] = (chosen.variants || []).map((v: any) => ({
      id: v.id,
      title: v.title || v.displayName || "Default",
      price: v.price,
      imageUrl: v.image?.originalSrc || productImage,
    }));
    const variant = variants[0] || { id: chosen.id, title: "Default" };
    onChange({
      productId: chosen.id,
      productTitle: chosen.title,
      variantId: variant.id,
      variantTitle: variant.title,
      imageUrl: variant.imageUrl || productImage,
      variants,
    });
  };

  if (!item.productId) {
    return (
      <Box
        borderStyle="dashed"
        borderWidth="025"
        borderColor="border"
        borderRadius="200"
        padding="400"
      >
        <BlockStack gap="200" inlineAlign="center">
          <Icon source={ImageIcon} tone="subdued" />
          <Button onClick={pick}>Choose product</Button>
        </BlockStack>
      </Box>
    );
  }

  return (
    <Box
      borderWidth="025"
      borderColor="border"
      borderRadius="200"
      padding="300"
      background="bg-surface-secondary"
    >
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <ProductThumb src={item.imageUrl} alt={item.productTitle} size={56} />
        <Box width="100%">
          <BlockStack gap="150">
            <Text as="span" fontWeight="semibold">
              {item.productTitle}
            </Text>
            {item.variants && item.variants.length > 1 ? (
              <Select
                label="Variant"
                labelHidden
                options={item.variants.map((v) => ({
                  label: `${v.title}${v.price ? ` — $${v.price}` : ""}`,
                  value: v.id,
                }))}
                value={item.variantId}
                onChange={(value) => {
                  const v = item.variants!.find((v) => v.id === value);
                  if (v)
                    onChange({
                      ...item,
                      variantId: v.id,
                      variantTitle: v.title,
                      imageUrl: v.imageUrl || item.imageUrl,
                    });
                }}
              />
            ) : (
              <Text as="span" tone="subdued" variant="bodySm">
                {item.variantTitle}
              </Text>
            )}
          </BlockStack>
        </Box>
        <InlineStack gap="100" wrap={false}>
          <Button onClick={pick} size="slim">
            Change
          </Button>
          <Button
            icon={XIcon}
            accessibilityLabel="Remove"
            variant="plain"
            tone="critical"
            onClick={onRemove}
          />
        </InlineStack>
      </InlineStack>
    </Box>
  );
}

function ItemList({
  items,
  setItems,
  addLabel,
}: {
  items: Item[];
  setItems: (items: Item[]) => void;
  addLabel: string;
}) {
  return (
    <BlockStack gap="300">
      {items.map((item, index) => (
        <ItemCard
          key={index}
          item={item}
          onChange={(next) => {
            const copy = [...items];
            copy[index] = next;
            setItems(copy);
          }}
          onRemove={() => setItems(items.filter((_, i) => i !== index))}
        />
      ))}
      <Box>
        <Button
          onClick={() =>
            setItems([
              ...items,
              { productId: "", productTitle: "", variantId: "", variantTitle: "" },
            ])
          }
        >
          {addLabel}
        </Button>
      </Box>
    </BlockStack>
  );
}

export default function RuleForm({
  initialValues,
  onSubmit,
  submitLabel,
  banner,
}: {
  initialValues?: Partial<RuleFormValues>;
  onSubmit: (values: RuleFormValues) => void;
  submitLabel: string;
  banner?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [active, setActive] = useState(initialValues?.active ?? true);

  const [triggerMode, setTriggerMode] = useState<TriggerMode>(
    initialValues?.triggerMode ?? "specific",
  );
  const [triggerItems, setTriggerItems] = useState<Item[]>(
    initialValues?.triggerItems ?? [],
  );
  const [triggerBasis, setTriggerBasis] = useState<TriggerBasis>(
    initialValues?.triggerBasis ?? "quantity",
  );
  const [triggerQuantity, setTriggerQuantity] = useState(
    String(initialValues?.triggerQuantity ?? 3),
  );
  const [triggerAmount, setTriggerAmount] = useState(
    String(initialValues?.triggerAmount ?? 30),
  );

  const [freeOptions, setFreeOptions] = useState<Item[]>(
    initialValues?.freeOptions ?? [],
  );
  const [freeQuantity, setFreeQuantity] = useState(
    String(initialValues?.freeQuantity ?? 1),
  );

  const validTriggerItems = triggerItems.filter((i) => i.productId);
  const validFreeOptions = freeOptions.filter((i) => i.productId);

  const canSubmit =
    Boolean(title) &&
    validFreeOptions.length > 0 &&
    (triggerMode === "storewide" || validTriggerItems.length > 0);

  const qty = Number(triggerQuantity) || 0;
  const freeQty = Number(freeQuantity) || 0;
  const conditionText =
    triggerBasis === "amount"
      ? `spends $${(Number(triggerAmount) || 0).toFixed(2)}`
      : `adds ${qty} eligible item${qty === 1 ? "" : "s"}`;
  const summaryText = `When a customer ${conditionText} to their cart, ${freeQty} gift item${
    freeQty === 1 ? "" : "s"
  } added for free.`;

  const isEditing = Boolean(initialValues?.id);

  return (
    <Page
      backAction={{ content: "Rules", onAction: () => navigate("/app/rules") }}
      title={isEditing ? "Edit rule" : "Create rule"}
      titleMetadata={
        <Pill color={active ? "green" : "gray"}>
          {active ? "Active" : "Inactive"}
        </Pill>
      }
      subtitle="Buy X, get Y free"
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {banner}
            <Card>
              <BlockStack gap="400">
                <TextField
                  label="Rule name"
                  autoComplete="off"
                  value={title}
                  onChange={setTitle}
                  placeholder='e.g. "Buy 3 T-Shirts, get a free Trouser"'
                  helpText="Shown only to you, in the app admin."
                />
                <Checkbox
                  label="Active"
                  checked={active}
                  onChange={setActive}
                  helpText="Inactive rules never run on your storefront."
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">
                    1. What the customer needs to buy
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Define which products trigger the free gift.
                  </Text>
                </BlockStack>
                <Divider />
                <Select
                  label="Which products count toward the condition?"
                  options={[
                    { label: "Specific products I choose", value: "specific" },
                    { label: "Any product, storewide", value: "storewide" },
                  ]}
                  value={triggerMode}
                  onChange={(value) => setTriggerMode(value as TriggerMode)}
                />
                {triggerMode === "specific" && (
                  <ItemList
                    items={triggerItems}
                    setItems={setTriggerItems}
                    addLabel="Add eligible product"
                  />
                )}
                <Select
                  label="How is the condition measured?"
                  options={[
                    { label: "Total quantity (number of items)", value: "quantity" },
                    { label: "Total amount spent ($)", value: "amount" },
                  ]}
                  value={triggerBasis}
                  onChange={(value) => setTriggerBasis(value as TriggerBasis)}
                />
                {triggerBasis === "quantity" ? (
                  <Box maxWidth="320px">
                    <TextField
                      label={
                        triggerMode === "specific"
                          ? "Total quantity needed, combined across the products above"
                          : "Total quantity needed, of any products"
                      }
                      type="number"
                      min={1}
                      autoComplete="off"
                      value={triggerQuantity}
                      onChange={setTriggerQuantity}
                      helpText={
                        triggerMode === "specific"
                          ? "e.g. 3 lets the customer mix and match any combination of the products above."
                          : "e.g. 3 means any 3 items anywhere in the cart."
                      }
                    />
                  </Box>
                ) : (
                  <Box maxWidth="320px">
                    <TextField
                      label={
                        triggerMode === "specific"
                          ? "Total amount needed, combined across the products above"
                          : "Total amount needed, of any products"
                      }
                      type="number"
                      min={0}
                      step={0.01}
                      prefix="$"
                      autoComplete="off"
                      value={triggerAmount}
                      onChange={setTriggerAmount}
                      helpText={
                        triggerMode === "specific"
                          ? "e.g. 30 means $30.00 spent across the products above, any combination."
                          : "e.g. 30 means $30.00 spent anywhere in the cart."
                      }
                    />
                  </Box>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">
                    2. Free gift options
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Add one or more products. With more than one, the
                    customer picks their gift in a popup.
                  </Text>
                </BlockStack>
                <Divider />
                <ItemList
                  items={freeOptions}
                  setItems={setFreeOptions}
                  addLabel="Add free gift option"
                />
                <Box maxWidth="220px">
                  <TextField
                    label="Quantity given free"
                    type="number"
                    min={1}
                    autoComplete="off"
                    value={freeQuantity}
                    onChange={setFreeQuantity}
                  />
                </Box>
                <Text as="p" tone="subdued" variant="bodySm">
                  The free gift is made 100% off automatically at checkout -
                  its regular price is never changed.
                </Text>
              </BlockStack>
            </Card>

            <InlineStack gap="300" align="end">
              <Button onClick={() => navigate("/app/rules")}>Cancel</Button>
              <Button
                variant="primary"
                loading={isSaving}
                disabled={!canSubmit}
                onClick={() =>
                  onSubmit({
                    id: initialValues?.id,
                    title,
                    active,
                    triggerMode,
                    triggerItems: validTriggerItems,
                    triggerBasis,
                    triggerQuantity: Number(triggerQuantity) || 1,
                    triggerAmount: Number(triggerAmount) || 0,
                    freeOptions: validFreeOptions,
                    freeQuantity: Number(freeQuantity) || 1,
                  })
                }
              >
                {submitLabel}
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Summary
              </Text>
              <Text as="p" tone="subdued">
                {summaryText}
              </Text>
              <Divider />
              <Text as="p" tone="subdued" variant="bodySm">
                Remember to enable the app embed in your theme editor so
                rules run on the storefront.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

import { useEffect, useState } from "react";
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
  Select,
  TextField,
  Divider,
} from "@shopify/polaris";
import { NoteIcon, PaintBrushFlatIcon, ViewIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getDesignSettings, saveDesignSettings } from "../models/design.server";
import type { DesignSettings, ImageShape } from "../models/design";
import { IconBadge } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const design = await getDesignSettings(session.shop);
  return { design };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = (await request.json()) as DesignSettings;
  await saveDesignSettings(session.shop, settings);
  return { ok: true };
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <BlockStack gap="150">
      <Text as="p" variant="bodyMd">
        {label}
      </Text>
      <InlineStack gap="200" blockAlign="center">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          style={{
            width: 40,
            height: 40,
            padding: 0,
            border: "1px solid #d1d1d1",
            borderRadius: 8,
            cursor: "pointer",
            background: "none",
          }}
        />
        <Text as="span" tone="subdued">
          {value}
        </Text>
      </InlineStack>
    </BlockStack>
  );
}

function PreviewCard({ design }: { design: DesignSettings }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        maxWidth: 320,
        boxShadow: "0 10px 40px rgba(0,0,0,.18)",
        fontFamily: "inherit",
      }}
    >
      <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 17 }}>
        {design.popupHeading || "You've unlocked a free gift!"}
      </p>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#666" }}>
        {design.popupSubheading || "Choose which one you'd like:"}
      </p>
      {["Sample product A", "Sample product B"].map((name) => (
        <div
          key={name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "1px solid #e1e1e1",
            borderRadius: 10,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              background: "#f1f1f1",
              borderRadius: design.imageShape === "rounded" ? "50%" : 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#aaa",
              fontSize: 11,
            }}
          >
            IMG
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: design.titleColor,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {name}
            </div>
          </div>
          <button
            type="button"
            style={{
              background: design.buttonColor,
              color: design.buttonTextColor,
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "default",
              whiteSpace: "nowrap",
            }}
          >
            Select
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Design() {
  const { design: initialDesign } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const [design, setDesign] = useState<DesignSettings>(initialDesign);

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Popup appearance saved");
    }
  }, [fetcher.data, shopify]);

  const save = () => {
    fetcher.submit(design as any, {
      method: "post",
      encType: "application/json",
    });
  };

  return (
    <Page
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
      title="Popup design"
      subtitle='Controls the "choose your free gift" popup whenever a rule offers more than one option.'
      primaryAction={{
        content: "Save",
        loading: fetcher.state !== "idle",
        onAction: save,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <IconBadge icon={NoteIcon} color="purple" />
                  <Text as="h2" variant="headingMd">
                    Content
                  </Text>
                </InlineStack>
                <Divider />
                <TextField
                  label="Popup heading"
                  autoComplete="off"
                  value={design.popupHeading}
                  onChange={(value) =>
                    setDesign((d) => ({ ...d, popupHeading: value }))
                  }
                />
                <TextField
                  label="Popup subheading"
                  autoComplete="off"
                  value={design.popupSubheading}
                  onChange={(value) =>
                    setDesign((d) => ({ ...d, popupSubheading: value }))
                  }
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <IconBadge icon={PaintBrushFlatIcon} color="orange" />
                  <Text as="h2" variant="headingMd">
                    Appearance
                  </Text>
                </InlineStack>
                <Divider />

                <Select
                  label="Product image shape"
                  options={[
                    { label: "Rounded", value: "rounded" },
                    { label: "Square", value: "square" },
                  ]}
                  value={design.imageShape}
                  onChange={(value) =>
                    setDesign((d) => ({ ...d, imageShape: value as ImageShape }))
                  }
                />

                <ColorField
                  label="Product title color"
                  value={design.titleColor}
                  onChange={(value) =>
                    setDesign((d) => ({ ...d, titleColor: value }))
                  }
                />
                <ColorField
                  label="Button color"
                  value={design.buttonColor}
                  onChange={(value) =>
                    setDesign((d) => ({ ...d, buttonColor: value }))
                  }
                />
                <ColorField
                  label="Button text color"
                  value={design.buttonTextColor}
                  onChange={(value) =>
                    setDesign((d) => ({ ...d, buttonTextColor: value }))
                  }
                />

                <InlineStack align="end">
                  <Button
                    variant="primary"
                    loading={fetcher.state !== "idle"}
                    onClick={save}
                  >
                    Save
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <IconBadge icon={ViewIcon} color="blue" />
              <Text as="h3" variant="headingSm">
                Live preview
              </Text>
            </InlineStack>
            <div
              style={{
                position: "relative",
                background:
                  "linear-gradient(160deg, #ede3ff 0%, #f6ecff 55%, #fff0e6 100%)",
                borderRadius: 16,
                padding: "56px 24px 32px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <span style={{ position: "absolute", top: 14, left: 22, fontSize: 18 }}>
                🎉
              </span>
              <span
                style={{ position: "absolute", top: 20, right: 30, fontSize: 16 }}
              >
                ✨
              </span>
              <span
                style={{ position: "absolute", top: 60, left: 12, fontSize: 14 }}
              >
                ⭐
              </span>
              <div
                style={{
                  position: "absolute",
                  top: -18,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 8px 20px rgba(124, 58, 237, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                🎁
              </div>
              <PreviewCard design={design} />
            </div>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

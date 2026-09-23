import { Icon, InlineStack, Text, Button, BlockStack, Box } from "@shopify/polaris";
import { GiftCardIcon } from "@shopify/polaris-icons";

export function IconBadge({ icon, color }) {
  return (
    <div className={`bogo-icon-badge bogo-icon-badge--${color}`}>
      <Icon source={icon} />
    </div>
  );
}

export function Pill({ color, children }) {
  return <span className={`bogo-pill bogo-pill--${color}`}>{children}</span>;
}

export function UpgradeBanner({ message, actionUrl }) {
  return (
    <div className="bogo-upgrade-banner">
      <span className="bogo-upgrade-banner__crown">👑</span>
      <span className="bogo-upgrade-banner__spark" style={{ top: 8, right: 100 }}>
        ✨
      </span>
      <span
        className="bogo-upgrade-banner__spark"
        style={{ bottom: 10, right: 130 }}
      >
        ⭐
      </span>
      <InlineStack gap="300" blockAlign="start" wrap={false}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>⚠️</div>
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            Rule limit reached
          </Text>
          <Text as="p" tone="subdued">
            {message}
          </Text>
          <Box>
            <Button url={actionUrl}>View plans</Button>
          </Box>
        </BlockStack>
      </InlineStack>
    </div>
  );
}

export function ProductThumb({ src, alt, size = 40, rounded = 10 }) {
  const style = {
    width: size,
    height: size,
    borderRadius: rounded,
  };
  if (src) {
    return (
      <div className="bogo-product-thumb" style={style}>
        <img src={src} alt={alt} />
      </div>
    );
  }
  return (
    <div
      className="bogo-product-thumb bogo-product-thumb--fallback"
      style={style}
    >
      <Icon source={GiftCardIcon} />
    </div>
  );
}

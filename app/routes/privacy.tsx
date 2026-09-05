export default function PrivacyPolicy() {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1a1a1a",
        lineHeight: 1.6,
      }}
    >
      <h1>Privacy Policy — Buy X Get Y Free (Adonza)</h1>
      <p>
        <em>Last updated: August 28, 2026</em>
      </p>

      <p>
        This Privacy Policy describes what information "Buy X Get Y Free"
        ("the App", "we", "us") collects from merchants who install it on
        their Shopify store, and how that information is used.
      </p>

      <h2>Information we collect</h2>
      <p>The App collects only the following:</p>
      <ul>
        <li>
          <strong>Store identifier and access token.</strong> When you
          install the App, Shopify's OAuth process gives us your store's
          domain and an access token, which we use to call Shopify's APIs
          on your behalf. This is required for the App to function.
        </li>
        <li>
          <strong>The promotion rules you configure.</strong> The
          products, quantities/amounts, and free-gift options you choose
          when creating a "Buy X Get Y Free" rule in the App's admin
          screens.
        </li>
        <li>
          <strong>The popup appearance settings you configure.</strong>{" "}
          Colors, image shape, and text for the storefront gift-picker
          popup.
        </li>
        <li>
          <strong>Feedback you choose to submit.</strong> If you use the
          in-app feedback form, we store the message you write so we can
          read and respond to it.
        </li>
      </ul>

      <h2>Information we do not collect</h2>
      <p>
        The App does not collect, store, or process any personal
        information about your customers or shoppers. The storefront
        script only reads your store's public cart contents in the
        shopper's own browser to decide whether a free-gift condition is
        met — it does not send any shopper-identifying information back
        to our servers.
      </p>

      <h2>How we use this information</h2>
      <p>
        We use the information above solely to operate the App's core
        functionality: applying your configured rules, adding free gifts
        to qualifying carts, rendering the popup you've customized, and
        responding to feedback you send us. We do not sell, rent, or share
        this information with third parties for marketing purposes.
      </p>

      <h2>Where data is stored</h2>
      <p>
        Data is stored in a managed PostgreSQL database (provided by Neon)
        and the App itself runs on Railway. Both providers encrypt data in
        transit (TLS/HTTPS) and at rest.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        When you uninstall the App, we automatically delete your store's
        access token, rules, popup settings, and feedback messages. We
        also support Shopify's mandatory compliance webhooks
        (<code>customers/data_request</code>, <code>customers/redact</code>,{" "}
        <code>shop/redact</code>) — though since we don't collect
        shopper/customer data in the first place, there is nothing to
        export or redact for individual customers.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of, or deletion of, any data we hold about
        your store at any time by contacting us at the email address
        below. Uninstalling the App also triggers deletion automatically.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about this policy or your data can be sent to{" "}
        <a href="mailto:optezo052@gmail.com">optezo052@gmail.com</a>.
      </p>
    </div>
  );
}

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Buy X Get Y Free</h1>
        <p className={styles.text}>
          Automatic free-gift promotions for your storefront - configure a
          rule once, and the free item is added to a shopper's cart
          automatically whenever they qualify. No discount codes, no theme
          code.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Buy X, get Y free.</strong> Pick any product(s) as the
            trigger and any product(s) as the free gift - condition can be a
            quantity or a total amount spent.
          </li>
          <li>
            <strong>Automatic, at checkout.</strong> A Shopify Function makes
            the gift 100% off without ever touching the product's real
            price.
          </li>
          <li>
            <strong>Customize the popup.</strong> When a rule offers more
            than one gift, shoppers pick via a popup you can brand to match
            your store.
          </li>
        </ul>
      </div>
    </div>
  );
}

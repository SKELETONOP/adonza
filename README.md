# Buy X Get Y Free — Shopify App

A public, embedded Shopify app. Once installed on a store, the merchant
configures rules like:

> Buy 3 T-Shirts → get 1 Trouser free

...directly in the app's admin UI. No code, no manual discounts. A rule's
"buy" side can target either a **specific list of eligible products** (any
combination of them counts toward the condition) or **storewide** (any
product at all counts), and the condition itself can be measured as either
a **total quantity** or a **total amount spent ($)**. A rule's "get free"
side can offer **multiple gift options** — if there's more than one, the
shopper is shown a popup on the storefront to pick which one they want.
The storefront automatically adds the chosen free item to a shopper's
cart the moment the condition is met, rescales it if they buy more, and
removes it again if the cart no longer qualifies - and blocks checkout for
the brief window while any of that is being reconciled, so a shopper can't
race a cart change past the correction.

## How it's built

| Piece | Location | Purpose |
|---|---|---|
| Embedded admin app | `app/routes/app.rules*.tsx`, `app/components/RuleForm.tsx` | Create/edit/activate/delete rules with a Polaris UI + repeatable product pickers |
| Database | `prisma/schema.prisma` (`Rule`, `RuleTriggerItem`, `RuleFreeOption`) | Stores each shop's rules, their eligible trigger products (when not storewide), and their free-gift options |
| Public data feed | `app/routes/storefront.rules.tsx`, `storefront.design.tsx` | Serves a shop's *active* rules and popup appearance settings as JSON via Shopify's [App Proxy](https://shopify.dev/docs/apps/build/online-store/display-dynamic-data). The storefront calls `/apps/bogo/storefront/rules` and `/apps/bogo/storefront/design`; Shopify strips the `/apps/bogo` prefix+subpath and forwards the remainder to this app, which is why the route's path has to match the remainder, not the public URL |
| Storefront logic | `extensions/bogo-free-gift` (Theme App Extension) | An app-embed block that loads `bogo.js`, which watches the cart and calls the [Ajax Cart API](https://shopify.dev/docs/api/ajax/reference/cart) to add/remove the free variant automatically, showing a card-based popup (with product images) when a rule offers more than one gift option |
| Billing | `app/shopify.server.ts`, `app/models/billing.server.ts`, `app/routes/app.billing.tsx` | Basic ($0, 1 rule) / Pro ($5/mo, 15 rules) / Advanced ($15/mo, unlimited) via Shopify's real Billing API - see "Plans & billing" below |
| Popup appearance | `app/models/design.server.ts`, `app/routes/app.design.tsx` | Per-shop `ShopSettings` (image shape, title color, button colors) with a live preview, applied by the storefront popup |
| Feedback | `app/routes/app._index.tsx` (`Feedback` model) | A simple feedback form on the home page, stored per shop |

### How the free item is actually made free (a Shopify Function, not a price edit)

An earlier version of this app made the free item free by editing the
variant's real catalog price to $0.00 via the Admin API. **That was
wrong** and has been removed: it changed the price for every shopper, not
just the ones who qualified for the promotion, and left the store exposed
if the app ever failed to restore it.

The free line is now made free by **`extensions/bogo-free-discount`**, a
Shopify Function (Discount API, target `cart.lines.discounts.generate.run`).
The storefront script tags the auto-added line with a `_bogo_rule_id` line
item property when it calls `/cart/add.js`; the Function reads that
property back via `CartLine.attribute(key: "_bogo_rule_id")` and applies a
100%-off product discount to *only that line, in that cart* — the
product's real price is never touched, anywhere, ever. See
`extensions/bogo-free-discount/src/cart_lines_discounts_generate_run.js`
and its `tests/fixtures/*.json` (run with `cd extensions/bogo-free-discount && npx vitest run`).

For the Function to run, the shop needs one active automatic discount
pointed at it. `app/models/discount.server.ts`'s `ensureAutomaticDiscount`
creates that once per shop (via `discountAutomaticAppCreate`, referencing
the function by its `functionHandle`) the first time a rule is
created/edited, and caches the resulting discount id on `ShopSettings` so
it's never created twice.

This needed two follow-up changes: `shopify.app.toml`'s scopes dropped
`write_products` (no longer needed) and gained `read_discounts,write_discounts`
— existing installs will be prompted to re-approve scopes next time the
app runs. And `.graphqlrc.ts`'s pinned API version had to be bumped
(`July25` had been retired) to fetch a live schema at all for verifying
this mutation's shape.

### How the automatic cart logic works (`extensions/bogo-free-gift/assets/bogo.js`)

1. The script re-checks the cart after any `/cart/add`, `/cart/change`,
   `/cart/update`, or bare `/cart` request (detected by wrapping
   `window.fetch`/`XMLHttpRequest` and listening for form submits — this
   works across themes without needing theme-specific events), on page
   load, and on a slow 4-second background poll as a catch-all for
   whatever mutation path a given theme uses that isn't otherwise caught.
2. Fetches this shop's active rules from `/apps/bogo/storefront/rules` (the
   App Proxy path) and the current cart from `/cart.js`.
3. For each rule, counts how many trigger units are in the cart — only the
   products in that rule's eligible list, or (storewide) every item in the
   cart — and works out `floor(triggerQtyInCart / triggerQuantity) * freeQuantity`.
4. If that's more than what's currently in the cart (tracked via a
   `_bogo_rule_id` line item property) and nothing's been chosen yet: adds
   the single free option automatically, or — with multiple options — shows
   a popup for the shopper to pick one (`showChoiceModal`). If something's
   already chosen, its quantity is simply rescaled up or down via
   `/cart/change.js` instead of asking again. Dropping below the threshold
   removes the free line entirely.

### Why there's no "Shopify Function" / discount extension here

An alternative (more advanced) architecture uses a Shopify Discount
Function to make a line 100% off instead of using a $0 variant. That
requires generating and deploying a Wasm function via
`shopify app generate extension`, which itself requires your app to
already be linked to a Partner organization (interactive browser login) —
something that can't be done in this non-interactive environment. The
$0-variant + Ajax Cart approach above is fully automatic, requires no extra
build tooling, and was implemented and installed here. If you later want
the Function-based approach as well, run `npm run generate` after linking
your app (see below) and pick a "Discount" function template.

## Project structure

This is the official [Shopify Remix app template](https://github.com/Shopify/shopify-app-template-remix)
(Remix + Prisma + Polaris + App Bridge), with the BOGO feature added on top:

```
app/
  routes/
    app._index.tsx          Dashboard
    app.rules.tsx            List rules
    app.rules_.new.tsx       Create rule (trailing underscore opts out of nesting under app.rules.tsx)
    app.rules_.$id.tsx       Edit rule
    storefront.rules.tsx     Public App Proxy JSON feed for the storefront
    webhooks.app.uninstalled.tsx  Cleans up this shop's rules on uninstall
  components/RuleForm.tsx    Shared form (product picker, quantities, price checkbox)
  models/rule.server.ts      Admin GraphQL helper to zero out / restore a variant's price
prisma/schema.prisma          Session (Shopify auth) + Rule models
extensions/bogo-free-gift/    Theme App Extension (app embed block + bogo.js)
shopify.app.toml               Scopes, webhooks, App Proxy config
```

## Setup (things that need your Partner account — run these yourself)

Everything above is already written and `npm install` has been run. The
remaining steps need your own Shopify Partner organization and dev store,
and involve an interactive browser login, so they must be run by you, not
in this sandbox:

1. **Install the Shopify CLI globally (optional, or just use `npx shopify`)**
   ```
   npm install -g @shopify/cli@latest
   ```

2. **Link this app to a Partner org / create the app record**
   ```
   npm run config:link
   ```
   This opens a browser to log in and either creates a new app in your
   Partner Dashboard or links to an existing one. It fills in `client_id`
   in `shopify.app.toml`.

3. **Start the dev server** (creates a tunnel, installs the app on your dev
   store, and keeps `shopify.app.toml`'s `application_url` / `[app_proxy].url`
   in sync automatically):
   ```
   npm run dev
   ```
   Press the printed URL / follow the CLI prompts to install the app on
   your development store.

4. **Turn on the app embed** — in your dev store's admin, go to
   *Online Store → Themes → Customize → App embeds*, and enable
   "Buy X Get Y Free". (One-time setup per theme.)

5. **Create a rule** — open the app from your store admin, go to
   *Free gift rules → Create rule*, pick the trigger product (e.g.
   T-Shirt, quantity 3) and the free product (e.g. Trouser, quantity 1),
   and save.

6. **Test it** — on the storefront, add 3 T-Shirts to the cart. The
   Trouser should appear automatically, at $0.00. Remove a T-Shirt and the
   Trouser is removed automatically too.

7. **When you're ready to publish the app publicly** (Shopify App Store),
   follow [shopify.dev's public app distribution checklist](https://shopify.dev/docs/apps/launch/distribution)
   and run:
   ```
   npm run deploy
   ```

## Production deployment (going live)

Three separate things need to happen for this app to run for real merchants
instead of just your dev store:

1. **The theme extension and discount Function** (`extensions/`) are hosted
   *by Shopify* — `npm run deploy` uploads them. No separate hosting, no
   cost.
2. **The web app** (the Remix admin + API routes) needs to run 24/7 on a
   real server with a stable HTTPS URL, instead of only while `npm run dev`
   is open on your laptop.
3. **The database** needs to be a real hosted MongoDB instance instead of
   a local database — most hosting platforms wipe local files on every
   deploy, so anything local would lose all your merchants' rules.

The schema (`prisma/schema.prisma`) is set up for MongoDB: `triggerItems`
and `freeOptions` are embedded composite types on `Rule` (not a separate
collection), so there's no join/relation to manage. MongoDB has no SQL-style
migrations — instead of `prisma migrate`, this project uses
`prisma db push` to sync the schema straight to the database (see `setup`
in `package.json`).

### Database: MongoDB Atlas

[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) is the managed option —
free tier available, and it gives you a replica set automatically, which
Prisma's MongoDB connector requires (a bare single-node `mongod` won't work
without extra replica-set configuration).

1. Create a free cluster at atlas.mongodb.com.
2. Database Access → add a database user (username/password).
3. Network Access → allow the IP(s) your app server connects from (or
   `0.0.0.0/0` for "anywhere", simplest while you're still setting things
   up — tighten it later).
4. Connect → "Drivers" → copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/adonza?retryWrites=true&w=majority
   ```
   Use this as `DATABASE_URL`. Note the `/adonza` — that's the database
   name; Prisma/Mongo creates it automatically the first time you write to
   it, no separate "create database" step needed.
5. Push the schema once you have a real connection string:
   ```
   npx prisma db push
   ```

### Web app: your own VPS

1. **Push this repo to GitHub** (skip if already done):
   ```
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```

2. **On the VPS**, either:
   - **With Docker** (recommended — matches the `Dockerfile` already in
     this repo): install Docker, `git clone` the repo, `docker build` +
     `docker run` it with the env vars below, and put Nginx in front of it
     as a reverse proxy with a Let's Encrypt (certbot) certificate for
     HTTPS — Shopify embedded apps require HTTPS.
   - **Without Docker**: install Node (see `engines` in `package.json` for
     the required version), `npm ci`, `npm run build`, run it with PM2
     (`pm2 start npm --name adonza -- start`) so it survives reboots/crashes,
     and put Nginx + certbot in front of it the same way.

3. **Set environment variables** (in a `.env` file next to the app, or
   however your process manager injects them):
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` — from `shopify.app.toml` /
     your Partner Dashboard app settings.
   - `SCOPES` — `read_products,read_discounts,write_discounts`
   - `SHOPIFY_APP_URL` — your domain, e.g. `https://app.yourdomain.com`.
   - `DATABASE_URL` — the MongoDB Atlas connection string from above.
   - `NODE_ENV` — `production`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
     `SMTP_FROM`, `FEEDBACK_NOTIFICATION_EMAIL` — same as your local `.env`,
     for the feedback-form email.

4. **Point Shopify at the real URL**: update `application_url` and
   `[app_proxy].url` in `shopify.app.toml` to your domain, then run:
   ```
   npm run deploy
   ```
   This pushes the URL, scopes, and webhook config to Shopify. Existing
   installs will be prompted to re-approve if scopes changed.

## Local development commands already verified in this environment

```
npm install                 # done
npx prisma generate         # done — MongoDB client generated
npm run build                # builds the Remix app (plain JS/JSX, no type-checking step)
```

`npx prisma db push` needs a real MongoDB connection string in `DATABASE_URL`
and hasn't been run against a live database yet — do this once Atlas (or
your own MongoDB) is set up.

`shopify app dev` / `shopify app deploy` were **not** run here because they
require an interactive browser login to your Shopify Partner account.

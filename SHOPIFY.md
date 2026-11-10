# Shopify app — configuration and deployment

The app's configuration lives in `shopify.app.toml` in this repo, not in a dashboard. That file is
the source of truth: dashboard edits to the same fields are overwritten on the next deploy.

## Pushing the configuration

Once, to point the CLI at the right app:

```bash
npm install -g @shopify/cli@latest
shopify auth login                      # sign in as the account that owns the app
shopify app config link --client-id 984613b791c6a370c81a7f3208eb3ca1
```

`config link` will offer to overwrite `shopify.app.toml`. **Decline** — or if it has already
rewritten the file, `git checkout shopify.app.toml` to restore it. The version in this repo is the
one to keep; linking only needs to record which app it belongs to.

Then, to push the configuration (and after any change to it):

```bash
shopify app deploy
```

This releases `application_url`, the redirect URL, the scopes and all four webhook subscriptions to
the app. `shopify app config push` no longer exists.

## What gets pushed

| Setting | Value |
|---|---|
| App URL | `https://app.renaissancecommerce.com` |
| Redirect URL | `https://app.renaissancecommerce.com/api/integrations/shopify/callback` |
| Webhook endpoint | `/api/webhooks/shopify` — `app/uninstalled` plus all three compliance topics |
| Webhook API version | `2025-10` |
| Scopes | `read_orders, read_all_orders, read_products, read_inventory, read_customers` |
| Embedded | `true` |

## What is *not* in this file

- **The client secret.** It lives only in Vercel as `SHOPIFY_CLIENT_SECRET`. It signs OAuth
  callbacks and verifies every webhook; if it is ever exposed, rotate it in the dashboard and
  update the Vercel variable. Nothing in this repo needs changing.
- **App Store listing, pricing and review submission.** Those stay in the Partner Dashboard at
  partners.shopify.com. Everything else is now in the Dev Dashboard at dev.shopify.com/dashboard.

## Verifying it worked

The webhook endpoint can be tested against production at any time with a correctly signed request.
All four topics should return 200, and a tampered or unsigned request 401:

```bash
SECRET='<the client secret>'
URL=https://app.renaissancecommerce.com/api/webhooks/shopify
BODY='{"shop_id":954889,"shop_domain":"example.myshopify.com"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | openssl base64)
for t in customers/data_request customers/redact shop/redact app/uninstalled; do
  printf '%-24s %s\n' "$t" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" \
    -H 'content-type: application/json' -H "x-shopify-topic: $t" \
    -H 'x-shopify-shop-domain: example.myshopify.com' \
    -H "x-shopify-hmac-sha256: $SIG" --data-raw "$BODY")"
done
```

Every call is recorded in the `shopify_compliance_log` table, with what it did.

## Install flows

There are three ways in, and all three end at the same callback:

1. **From the Shopify admin or App Store** — Shopify calls the App URL with `?shop=&hmac=`.
   `src/proxy.ts` sends it to `/api/shopify/install`, which verifies the signature and redirects to
   the OAuth grant screen.
2. **Embedded** — Shopify loads the App URL with `embedded=1` inside the admin iframe.
   `src/proxy.ts` serves `/shopify/embedded` and sets `frame-ancestors` for that store. It must
   never start OAuth here: a redirect out of the frame is blocked, and app review checks for it.
3. **From inside the app** — a signed-in student presses Connect on the Connections page, which
   goes through `/api/integrations/shopify/start`.

A **reinstall** is handled in the callback: the shop is looked up by `external_id` and the new
token goes straight back on the brand it already belonged to, landing the merchant in the
dashboard. This works because `app/uninstalled` clears the token but keeps the integration row;
after `shop/redact` deletes it at the 48-hour mark, a later install correctly starts fresh.

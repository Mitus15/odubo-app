# Domain + checkout checklist — 2026-09-04

Everything here needs the Shopify admin UI, the Vercel dashboard, or a registrar.
None of it is reachable from the Admin API token this project holds.

## State of play

| | status |
|---|---|
| `odubostudio.com` | **live.** NS delegated to Vercel, apex 308→www, www 200, valid TLS, app serving |
| `odubo.studio` | **dead.** Registry ACTIVE but **no NS delegation at all** — resolves for nobody |
| `odubo.studio` MX | **none** — `info@odubo.studio` cannot receive mail |
| `account/admin/moments/media.odubo.studio` | all dead (parent has no delegation) |
| Shopify custom domain | **none** — primary is `odubostudio.myshopify.com` |
| Shopify customer accounts | **redirects to `account.odubo.studio`** → dead |

`odubostudio.com` has a **wildcard DNS record** — any subdomain already resolves to
Vercel. An explicit record for a subdomain overrides the wildcard, which is how the
Shopify subdomain below will work.

## 1. Customer accounts — FIXED 2026-09-05

Was: `odubostudio.myshopify.com/account` 302'd to `https://account.odubo.studio/`, which
had no DNS. Shopify's own hosted account URL redirected there too, so there was no working
account path at all — and customers reach it from Shopify's order-confirmation emails.

Cause: the apex `odubo.studio` had been removed from Shopify, but the two subdomains
Shopify auto-provisions alongside a custom domain — `account.odubo.studio` and
`checkout.odubo.studio` — were left attached, and the customer-accounts setting still
pointed at one of them.

Fixed by removing both stale domains. Accounts now fall through to Shopify's hosted
flow, verified end to end:

```
odubostudio.myshopify.com/account
  -> 302 shopify.com/75208425685/account
  -> 302 shopify.com/authentication/75208425685/oauth/authorize   (real login)
```

## 2. Branded checkout — DONE 2026-09-05

`shop.odubostudio.com` is primary, its certificate is issued, and checkout is served on
it. Verified end to end with a real cart:

```
primary domain : shop.odubostudio.com
checkout host  : shop.odubostudio.com     (was odubostudio.myshopify.com)
cart total     : 70.0 CAD
customer GET   : 302, ssl_verify_result=0
```

| host | http | tls |
|---|---|---|
| `www.odubostudio.com/store` | 200 | valid |
| `shop.odubostudio.com` | 200 | valid |
| `accounts.odubostudio.com` | 301 | valid |
| `odubostudio.myshopify.com` | 301 -> shop.odubostudio.com | valid |

The certificate took roughly 25 minutes after DNS, against about 5 for `accounts.` —
so a slow issue is not necessarily a stuck one. During that window `shop.` was already
primary and checkout was down; see the rule below, which is the thing to remember.

**Never set a domain primary until `curl -sI https://<host> -w '%{ssl_verify_result}'`
returns 0.** Shopify's "Connected" badge reports DNS only, not the certificate, and the
gap between the two is a live checkout outage that browsing does not reveal.

## 3. Currency is ambiguous

`money_format` is `${{amount}}`, so CAD renders as a bare `$70.00`. For a Canadian
store selling internationally, set **Settings → Store details → Currency formatting**
to `${{amount}} CAD`. Not writable via the Admin API.

## 4. URL redirects — import the CSV

Renaming a handle through the API does **not** create the redirect the admin UI would,
and this token lacks `write_online_store_navigation`. The nine old product URLs 404 today.

Shopify admin → **Online Store → Navigation → URL Redirects → Import** →
`docs/shopify/url-redirects.csv`

## 5. Pass is still on Meta + Microsoft Copilot

An event pass for one night in Kamloops is syndicated to shopping channels. Those
channels aren't visible to this token. Shopify admin → the product → **Publishing**.

## 5b. Printed QR codes may point at the dead domain

The poster kit refuses to guess a host and reads `loop_settings.public_base_url`. If that
setting still holds `odubo.studio`, every QR already printed — and every one printed next —
resolves to nothing. Check it at **/loop/admin/studio → Pass sales → public base URL** and
set it to `https://www.odubostudio.com` before any further print run.

## 6. Store name

Still **"B.A.A.D by Odubo"**. If B.A.A.D is the clothing brand and Odubo Studio is the
storefront, this should be *Odubo Studio*. Settings → Store details. Shop settings are
read-only over the Admin API.

## 7. Email on a dead domain — verify before changing

`RESEND_FROM_EMAIL` and the contact route default to `info@odubo.studio`. That domain
has no MX and no DNS, so replies bounce and SPF/DKIM cannot pass. Do **not** just swap
the string to `@odubostudio.com` — Resend needs `odubostudio.com` verified (SPF/DKIM
records added in Vercel DNS) first, or sending breaks. Left unchanged deliberately.

## 8. Env vars still pointing at the dead domain

`NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` are `https://odubo.studio` in
`.env.local` and on Vercel. Code fallbacks were updated to `https://www.odubostudio.com`,
but the env vars win at runtime:

```bash
vercel env rm NEXT_PUBLIC_APP_URL production && vercel env add NEXT_PUBLIC_APP_URL production
```

(The Vercel CLI token in this environment is expired — `vercel login` first.)

## 9. Remaining hardcoded `odubo.studio` references

129 across `src/`. The customer-facing ones still pointing at the dead domain:

- `src/app/contact/ContactPageClient.tsx:98,114` → `account.odubo.studio`
- `src/app/thank-you/page.tsx:109` → `odubo.studio/account`
- `src/app/signup/page.tsx:11` → `account.odubo.studio/register`
- `src/app/customer_authentication/sso_hint/route.ts:13,18` → `odubo.studio`
- `src/app/api/contact/route.ts:157,164,165,184,185` → logo + account links in the email

These are deliberately **not** rewritten yet: there is no working customer-account URL
to point them at until item 1 is resolved. Fix item 1 first, then repoint them all at
that one destination.

`media.odubo.studio` (R2 public URL) is also left alone — it was already NXDOMAIN and
media is served via presigned GETs.


---

# 2026-09-05 (later) — remaining list worked through

## Done from here

- `loop_settings.public_base_url` set to `https://www.odubostudio.com`. It had never been
  set at all, which means no dead QR was ever printed — the poster kit refuses to guess a
  host rather than baking in a wrong one. The Poster Studio now has a correct default.
- `loop_settings.pass_checkout_url` moved off `odubostudio.myshopify.com` onto
  `https://shop.odubostudio.com/cart/54476588974293:1`. Verified 302 with valid TLS. The
  old link still worked by redirect; this removes the hop.

## Confirmed impossible with this token — not skipped, tried and refused

| item | attempt | result |
|---|---|---|
| URL redirects | `urlRedirectCreate` | `ACCESS_DENIED — write_online_store_navigation required` |
| Currency format | `PUT /admin/api/2024-07/shop.json` | `406` — shop resource is read-only |
| Store name | same | `406` |
| Pass off Meta / Copilot | `publishableUnpublish` | **returned success, changed nothing** |

That last one is worth remembering: Shopify accepted the mutation with no `userErrors`
and the pass is still published to both. An app cannot unpublish a resource from another
app's channel, and it fails silently rather than erroring — so the mutation result cannot
be trusted here. Always re-read the publications afterwards.

## Owner actions, in order of value

1. **`SHOPIFY_ADMIN_API_SECRET` in Vercel production.** Until this is set the webhook
   receiver answers 500 and no order reaches `commerce_orders`. There is no Vercel
   credential in this environment and `vercel login` is interactive, so it cannot be done
   from here. Alternative if preferred: the route can be extended to read the secret from
   `loop_settings` in D1, which needs no Vercel access — `pass_webhook_secret` already
   lives there, so the pattern exists.
2. **Add `write_online_store_navigation`** to the custom app's Admin API scopes
   (Settings → Apps → Develop apps → Configuration). With it, the nine redirects in
   `url-redirects.csv` can be created from here instead of imported by hand.
   Adding `read_customers` at the same time unblocks CRM enrichment later.
3. Currency formatting → `${{amount}} CAD` (Settings → Store details).
4. Store name → Odubo Studio (Settings → Store details).
5. Pass → Publishing → untick Meta and Microsoft Copilot.

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

## 1. Customer accounts are broken (highest priority)

`https://odubostudio.myshopify.com/account` 302s to `https://account.odubo.studio/`,
which does not resolve. Customers reach this from Shopify's own order-confirmation
emails, so it breaks the post-purchase path, not just a link on the site.

Shopify admin → **Settings → Customer accounts** → change the account domain off
`account.odubo.studio`. Either use Shopify's default hosted accounts, or point it at
`account.odubostudio.com` and add that as a domain in Shopify.

## 2. Branded checkout — `shop.odubostudio.com`

1. Shopify admin → **Settings → Domains → Connect existing domain** → `shop.odubostudio.com`
2. Vercel → project → **Domains → DNS records** for `odubostudio.com`, add:
   `CNAME  shop  →  shops.myshopify.com`
   (an explicit record beats the wildcard already on the zone)
3. Wait for Shopify to verify, then **set it as primary** so `checkoutUrl` is issued on it.

Caveat: a returning Shop Pay customer is still bounced to `shop.app` by Shopify's
universal redirect — that is Shopify's, not configurable.

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

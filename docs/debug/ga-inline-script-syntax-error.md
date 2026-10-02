# GA inline script: "Invalid or unexpected token" on every page

**Seen:** 2026-10-02, live on www.odubostudio.com (/, /fly, /store)
**Fixed in:** `src/components/analytics/GoogleAnalytics.tsx` (`getMeasurementId`)

## Symptom

Every page logged:

```
Uncaught: Failed to execute 'appendChild' on 'Node': Invalid or unexpected token
SyntaxError: Invalid or unexpected token  (static/chunks/4bd1b696-*.js, React DOM)
```

`window.gtag` was `undefined`. Google Analytics had recorded nothing.

## Cause

`NEXT_PUBLIC_GA_MEASUREMENT_ID` on Vercel (production) is `"G-LVK9T2DDGZ\n"`,
with a real trailing newline. Next inlines it into the bundle, and
`GoogleAnalytics` writes it into the inline `<Script id="google-analytics">`:

```js
gtag('config', 'G-LVK9T2DDGZ
', {
```

That string literal never closes. next/script appends the inline script after
hydration, so the SyntaxError is reported at the `appendChild` call.
The live preload link showed it too: `gtag/js?id=G-LVK9T2DDGZ%0A`.

## Fix

`getMeasurementId()` trims the env value and accepts only `^G-[A-Z0-9]+$`.
Anything else renders no GA at all, never a broken script.
Test: `src/__tests__/googleAnalytics.test.ts`.

## How to reproduce

Add `NEXT_PUBLIC_GA_MEASUREMENT_ID="G-LVK9T2DDGZ\n"` to `.env.local`
(dotenv turns `\n` inside double quotes into a newline), run `next dev`, open any page.
The main checkout's `.env.local` has no GA ID, which is why dev never showed it.

## Other production env values with a trailing newline

Checked 2026-10-02 with `vercel env pull` (names only):

| Var | Effect |
| --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | this bug |
| `ADMIN_EMAILS` | harmless: every reader splits and trims |
| `DEEPSEEK_API_KEY` | harmless: fetch strips trailing whitespace from header values |

Cleaning all three in Vercel is still worth doing.
These usually come from `echo "value" | vercel env add`; use `printf` instead.

## The 502

Reported on the homepage the same day. Not reproduced: every same-origin
request returned 200, the Stream MP4s 302 → 206, gtag/js 200, apex 308 → www.

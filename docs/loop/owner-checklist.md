# Loop Soul — what only you can do

Everything in the app and the emails is built and live. These are the things
the app cannot do for you, because they need your Shopify login, your Vercel
and Cloudflare dashboards, or a real card. In rough order.

The night is **Saturday 10 October**, doors 6:30, at Scott's Inn. 250 in the
room. As of this writing 2 passes are sold (both yours).

## This week

### 1. Shopify: the store's name and the receipt
The name a buyer sees at checkout and on the Shopify receipt is still
**"B.A.A.D by Odubo"**. B.A.A.D is the clothing label; the shop is Odubo Studio.

- **Settings → Store details → Store name** → `Odubo Studio`.
- **Order numbers are handled, no click needed.** Shopify starts every store at
  #1001 and no plan below Plus can move that counter, so printing it on a
  receipt tells a customer how few orders you have taken. The receipt template
  below therefore shows no order number at all: the customer gets the date, the
  items and their own order link, and #1001 stays in your admin where you want
  it. The only number a guest ever sees is the one on their ticket,
  `OS-473837`, which is computed so that consecutive sales land nowhere near
  each other.
- **Settings → Notifications → Order confirmation → Edit code.** Paste the file
  `docs/shopify/notifications/order-confirmation.liquid` over the body, and set
  the subject to `Your Odubo Studio receipt`. Shopify's confirmation can't be
  turned off, so this makes it a plain receipt with no second sales pitch under
  it. (Loop Soul passes get their own email from the site; merch buyers get
  this receipt and nothing else.)
- **Settings → Checkout → Customize.** Add the logo and the sand/ink colours to
  the checkout, thank-you and order-status pages. No apps.

### 2. Shopify: the pass image
The pass product photo's alt text still says Sept 26. The app's token can't
write it. **Products → Loop Soul Pass → the image → Edit alt text** →
`Loop Soul pass, admits one`. While you are there, **unpublish the pass from
the Meta and Microsoft channels** (it should not be in shopping feeds; it is a
ticket to one night). The title, description and vendor are already fixed.

### 3. Test with the two passes you already own
No new purchase. Tap one of the two claim links you were sent: it should drop
you straight into the draw and then the record, with nothing to type, and
`/loop` becomes your own page (Your record, Your ticket, The Cover). Then on a
second browser type the code from your ticket at `/loop/code`; that phone
opens too. If both work, the whole journey works.

Check the **Resend dashboard** to confirm the email actually sent (the app can
report "sent" in mock mode without sending; production is set to live, but
check the dashboard the first time). It goes to the address you checked out
with.

## Week two

### 4. The door, with two real phones
`/loop/admin/door` has never been tested against a real camera. Put a ticket on
one phone, open the door scanner on another, and scan it. It should admit once
and say ALREADY IN on a second scan. This is the one part of the night still
unproven.

### 5. The printed artwork needs 19+
The door is 19+ (a licensing condition, not a preference) and the posters do
not say so. Add it before any print run. The ticket and pass sheet already say
it; the printed poster is the gap.

### 6. Merch photos on the poster
The four garments show on the poster's Pieces rail and in the store. Confirm
they read well as small cut-outs on the sand.

## Week three, and the night

### 7. Release-switch rehearsal
On a draft, flip the album release in **/loop/admin → The Record** and confirm
the "it's out" email carries a working Play button. Then switch it back.

### 8. On the night
- **/loop/admin → Doors** open the doors (this lets everyone in the room use
  the Wall and camera without typing a code).
- Scan tickets at **/loop/admin/door**.
- After people have shot and you have featured the good ones on the Wall, open
  the ballots in **/loop/admin → the ballots**, and after the vote, **Declare**
  the cover. The winner is then named on the record and reachable for the $50.

## The customer inbox (optional, when you have a moment)
There is now one desk at **/admin/inbox** for customer messages, out of Gmail.
For email replies to reach it you need, in Vercel's env and Resend:
- Resend → Webhooks → an `email.received` hook to `/api/webhooks/resend/inbound`,
  and its secret in Vercel as `RESEND_WEBHOOK_SECRET`.
- `INBOX_ALERT_TO` = your Gmail, `SUPPORT_EMAIL` and `INBOX_FROM` =
  `support@odubostudio.com`, `NEXT_PUBLIC_SITE_URL` = the live site.
- Resend Inbound MX on `odubostudio.com`.
Until the MX is set, the store contact form still works and a customer can
reply through their own thread link; only email-to-inbox needs the DNS.

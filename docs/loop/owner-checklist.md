# Loop Soul — what only you can do

Everything in the app, the emails and the print pipeline is built and live.
These are the things the app cannot do for you, because they need your Shopify
login, your dashboards, a terminal, or a phone in your hand. In rough order.

The night is **Saturday 10 October**, doors 6:30, at Scott's Inn. 250 in the
room. As of this writing 2 passes are sold (both yours). The live list with
tick boxes: https://claude.ai/code/artifact/262ff43f-c959-499c-835c-2ad8df6e1111

## This week

### 1. Test with the two passes you already own
No new purchase. Tap one of the two claim links you were sent: it should drop
you straight into the draw and then the record, with nothing to type, and
`/loop` becomes your own page (Your record, Your ticket, The Cover with the
Wall inside). Then on a second browser type the code from your ticket at
`/loop/code`; that phone opens too. If both work, the whole journey works.

### 2. Send yourself the real email
In **/loop/admin → Event codes**, search your code and hit **Resend**. Confirm
it arrived in the **Resend dashboard**, not just the app's word (the app can
say "sent" without sending). Note this mints a fresh claim link and kills the
one you were sent.

### 3. Shopify: the store's name and the receipt
The name a buyer sees at checkout and on the Shopify receipt is still
**"B.A.A.D by Odubo"**. B.A.A.D is the clothing label; the shop is Odubo Studio.

- **Settings → Store details → Store name** → `Odubo Studio`.
- **Order numbers are handled, no click needed.** Shopify starts every store at
  #1001 and no plan below Plus can move that counter, so the receipt template
  below shows no order number at all. The only number a guest ever sees is the
  one on their ticket, `OS-473837`, computed so consecutive sales land nowhere
  near each other.
- **Settings → Notifications → Order confirmation → Edit code.** Paste the file
  `docs/shopify/notifications/order-confirmation.liquid` over the body, and set
  the subject to `Your Odubo Studio receipt`.
- **Settings → Checkout → Customize.** Add the logo and the sand/ink colours to
  the checkout, thank-you and order-status pages. No apps.

### 4. Shopify: the pass image
The pass product photo's alt text still says Sept 26. **Products → Loop Soul
Pass → the image → Edit alt text** → `Loop Soul pass, admits one`. While you
are there, **unpublish the pass from the Meta and Microsoft channels**.

### 5. Two edits in the programme (no deploy)
In **/loop/admin → The Night**: put your Instagram handle and Amen's on the
rows you each perform (the field is there; The Night then links out), and
rewrite the Dancefloor row's detail, which has an em dash in it ("the Loop
Soul Line — a line that becomes a circle"). Your voice has no em dashes; make
it two sentences.

## Week two

### 6. The door, with two real phones
Put a ticket on one phone, open **/loop/admin/door** on another, and scan it.
It should admit once and say ALREADY IN on a second scan. Also scan the
ticket from a plain camera app: your signed-in phone lands on the scanner, a
guest's phone lands on Enter your pass with the code filled in. This is the
one part of the night still unproven against real hardware.

### 7. Re-render and print
19+, the price and WITH AMEN THE DJ are now on every piece; the files on your
disk predate that. From the repo:

```bash
npm run loop:posters
```

That writes the poster (print), the flyer (half-letter), the feed and story
sizes, the Facebook cover, the ticket and the pass card into
`~/Documents/Loop-soul-the-entertainment-room/print-2026-08`. Add `--bleed`
for the print shop's files. The studio at **/loop/admin/posters** previews
the same lines. For the reel:

```bash
npm run loop:living-poster -- --in=<the take>.mp4 --music=<the music file> --musicOffset=<seconds> --seconds=30
```

(the exact music offset is in the script's header). Then stage it and press
publish yourself:

```bash
node scripts/loop/stage-reel.mjs --file=reel.mp4 --title="Loop Soul" --caption="..." --when=2026-10-03T10:00:00-07:00
```

then **/admin/social** (the odubo admin, a different login from /loop/admin)
→ the draft → publish. Nothing publishes on its own.

### 8. Merch photos on the poster
The four garments show on the poster's Pieces rail and in the store. Confirm
they read well as small cut-outs on the sand.

## Week three, and the night

### 9. Release-switch rehearsal
On a draft, flip the album release in **/loop/admin → The Record** and confirm
the "it's out" email carries a working Play button. Then switch it back.

### 10. The reminder, the day before
The app deliberately has no campaign sender. **/loop/admin → The Guests →
Export the marketing list** gives you everyone who ticked "keep me posted" or
joined the waitlist. Paste it into a **Resend Broadcast** and write the
reminder there.

### 11. On the night, first: flip the phase to Tonight
**/loop/admin → Event phase → Tonight.** This is the switch that changes what
every visitor sees (the gate, Your ticket first, the head count, the votes).
Nothing does it by the clock, on purpose.

### 12. Then run the night from the admin
- **/loop/admin → Doors** open the doors so everyone can shoot without a code.
- Scan tickets at **/loop/admin/door**.
- After people have shot and you have featured the good ones on the Wall, open
  the ballots in **/loop/admin → the ballots**, and after the vote, **Declare**
  the cover. The winner is then named on the record, on Legacy and in the
  Journal, and reachable for the $50.

## The customer inbox (optional, when you have a moment)
One desk at **/admin/inbox** for customer messages, out of Gmail. For email
replies to reach it you need, in Vercel's env and Resend:
- Resend → Webhooks → an `email.received` hook to `/api/webhooks/resend/inbound`,
  and its secret in Vercel as `RESEND_WEBHOOK_SECRET`.
- `INBOX_ALERT_TO` = your Gmail, `SUPPORT_EMAIL` and `INBOX_FROM` =
  `support@odubostudio.com`, `NEXT_PUBLIC_SITE_URL` = the live site.
- Resend Inbound MX on `odubostudio.com`.
Until the MX is set, the store contact form still works and a customer can
reply through their own thread link; only email-to-inbox needs the DNS.

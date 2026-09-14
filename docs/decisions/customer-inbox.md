# The customer inbox

Decided and built 2026-09-14.

## The problem

Store customers reached the owner only through Gmail. The contact form on the
store sent an email and kept nothing; replies happened in a personal inbox
between job alerts, venue threads and Shopify billing. There was no record of
who asked what, no link from a message to the customer's orders, and no way to
answer from a dedicated space. A year of Gmail showed the traffic is small
(two customer emails, no contact-form submissions found), so the win was never
volume. The win is one desk.

## What was decided

- **The conversation is the record.** Every message is a row in D1, whichever
  door it came through: the store form, an email reply, or the customer's own
  thread page. Migration `159_inbox.sql`.
- **The customer never needs an account.** Their link, `/messages/<token>`, is
  the key: 32 random bytes, base64url, grants read and reply on one thread and
  nothing else. This is the same trust model as the Loop Soul pass code, and
  it honours the house rule that there are no passwords.
- **Replies go out as the house, not as the owner.** Sender is
  `Odubo Studio <support@odubostudio.com>`, kept separate from Loop Soul's
  `hello@`. The address is a setting (`global_settings` key `inbox.from`), with
  `INBOX_FROM` as the env fallback.
- **A plain Reply in any mail app comes back to the right thread.** Every
  outbound email sets `Reply-To: support+<token>@odubostudio.com`, stamps its
  own `Message-ID`, and sets `In-Reply-To` / `References` so the customer's
  mail app files it under the same conversation. Resend Inbound receives the
  reply and posts an `email.received` webhook; the thread is resolved by the
  plus-address first, then by the Message-ID chain, then by "this sender has an
  open thread", and only then does a new thread open.
- **Gmail is the doorbell, not the desk.** A new message sends one alert email
  with the first lines and a deep link into `/admin/inbox?t=<id>`. The alert
  layer is a fan-out over `inbox.alert_channels_json` so push (the owner's ask)
  and SMS become one function each when their infrastructure exists.
- **No Resend SDK upgrade.** The installed 4.8 predates the receiving API, so
  the two calls this needs (`GET /emails/receiving/{id}` and the Svix
  signature check) are made directly. Nothing that already sends was touched
  beyond three optional parameters on `sendEmail`.

## Alternatives considered

- **Shopify Inbox.** Shopify's own chat product. It has no public API for
  messages, so a custom desk cannot read or write it. Rejected.
- **Gmail API polling.** Would keep the owner in Gmail's data model and needs
  OAuth with broad mailbox scope for a store support address. Rejected.
- **A third-party helpdesk (Gorgias, Zendesk, Front).** Monthly cost, their
  UI, their data. The whole point was the brand's own space in the admin.
  Rejected.
- **Upgrading Resend to 6.x for the receiving SDK.** A major bump across every
  email path in the app, days before a launch, for two REST calls. Rejected.

## Trade-offs accepted

- The thread token travels in the `Reply-To` header of every email. Anyone who
  can read the customer's email could open that one thread. That is the same
  exposure as the email itself, and the token opens nothing else.
- Quoted history is stripped from email replies with heuristics
  (`stripQuotedReply`). An unusual mail client may leak a quote into the
  thread; the original HTML is kept on the row for that case.
- Until the MX record is live on `odubostudio.com`, an email reply from a
  customer goes nowhere. The acknowledgement and every reply carry the thread
  link, so the conversation still works on the site.
- Internal notes and customer messages share one table, filtered by
  `direction`. Both the page and the customer API filter server-side; there is
  no client path that receives a note.

## Owner actions that remain

1. Resend dashboard, Domains, `odubostudio.com`: enable receiving, copy the MX
   record, add it in Vercel DNS. It must be the only MX (or the lowest
   priority) on the domain.
2. Resend dashboard, Webhooks: add
   `https://odubostudio.com/api/webhooks/resend/inbound` for `email.received`
   and put the signing secret in Vercel as `RESEND_WEBHOOK_SECRET`.
3. Vercel env: `NEXT_PUBLIC_SITE_URL=https://odubostudio.com` so the links in
   emails point at a domain with nameservers. (The helper defaults to
   `odubo.studio`, which has none.)

## Phase 2

- Push to the owner's phone (Web Push with VAPID on the admin host, or the
  Capacitor push plugin): one migration, one subscribe endpoint, one channel
  function in `src/lib/inbox/alerts.ts`.
- SMS as a customer channel via Twilio (`channel = 'sms'` already exists).
- Shopify `customers/*` webhooks once `read_customers` is granted.
- Attachments copied to R2 (today the row keeps Resend's temporary URL).

# Moments Reminders

This app can dispatch RSVP reminders by email (Resend) and SMS (Twilio) before an event starts, based on each RSVP's selected offsets.

## How it works
- RSVPs are stored in `gallery_rsvps` with `reminder_offsets` (JSON array), `email`, `instagram_handle`, optional `phone`, and `sms_opt_in`.
- The dispatcher scans due reminders and writes to `gallery_rsvp_reminder_logs` to ensure idempotency.
- Channels:
  - Email via Resend when `RESEND_API_KEY` is set
  - SMS via Twilio when `TWILIO_*` env vars are set and the RSVP has `phone` + `sms_opt_in`

## Running manually
- Script (Node):

```bash
npx tsx scripts/dispatch_moments_reminders.ts
```

- API route (admin/editor token required):

```bash
curl -X POST \
  -H "Authorization: Bearer <your-admin-token>" \
  https://<your-domain>/api/moments/reminders
```

## Environment variables
- DATABASE_URL: D1 HTTP API endpoint ending with `/query`
- CLOUDFLARE_D1_API_TOKEN (or CLOUDFLARE_API_TOKEN): D1 API token with read/write
- RESEND_API_KEY, EMAIL_FROM: Email channel
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER: SMS channel

## Scheduling (cron)
If deploying on Cloudflare Pages/Workers, create a Cron Trigger that hits the API route every minute (or 2–5 minutes). Example using Workers Cron:

1. Add a small Worker (or existing one) with a `scheduled` handler that calls your route:

```js
export default {
  async scheduled(event, env, ctx) {
    const res = await fetch(env.SITE_URL + '/api/moments/reminders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_ADMIN_TOKEN}` }
    });
    if (!res.ok) throw new Error(`Dispatch failed: ${res.status}`);
  }
}
```

2. Configure:
- CRON trigger (e.g., `* * * * *` for every minute)
- Bind `SITE_URL` and `CRON_ADMIN_TOKEN` (must match your app's auth)

## Notes
- The dispatcher uses a 90-second window to pick up due reminders; 1-minute cron is recommended.
- If env for a channel is missing, reminders are logged as `queued` instead of `sent`.
- Logs are idempotent per `(rsvp_id, offset_min, channel)`.
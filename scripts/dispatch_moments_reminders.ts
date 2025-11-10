#!/usr/bin/env tsx
/*
  Dispatch Moments reminders before event start.
  - Reads RSVPs + galleries
  - Computes due reminders based on reminder_offsets and starts_at
  - Sends email via Resend and/or SMS via Twilio
  - Logs each attempt in gallery_rsvp_reminder_logs and avoids duplicates

  Requirements:
    - env: DATABASE_URL, CLOUDFLARE_D1_API_TOKEN (D1 HTTP API)
    - env: RESEND_API_KEY, EMAIL_FROM (for email)
    - env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (for SMS)
*/

import { dispatchDueReminders } from '../src/lib/momentsReminderDispatcher';

async function main() {
  const result = await dispatchDueReminders(new Date());
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

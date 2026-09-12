# One person, one record, expanding scope

**Owner, 2026-09-12.** How identity works across Odubo Studio, Loop Soul and the
store. Supersedes nothing; it names what was already half-built and closes a
hole in it.

---

## The decision

> "If I attend Loop Soul and I purchase the album, then when it's time to buy
> clothes I shouldn't have to create a new Shopify account. And if I wanted a
> full username and password account later for Odubo Studio, I shouldn't have to
> create another account. All I have to do is expand the scope of the account I
> currently have."

**Odubo Studio holds the person. Every other system holds its own records and
joins to that person.** Not one account per surface.

- **Odubo Studio** (D1, `loop_attendees` today) is the **person**.
- **Shopify** is the **orders**. It keeps its customer records; we do not
  replace them and we do not ask anyone to make one.
- **Loop Soul** is a **volume**: attendance, shots, credits, a cover choice.
- Future surfaces (games, videos, streaming) attach to the same person.

They join on **email**, which checkout already collects.

Anyone touching any surface is an Odubo Studio customer at some level. The level
is what varies, not the identity.

## The ladder

Each rung adds scope. Nothing is ever a second account.

| Rung | What it is | Earned by | Survives |
|---|---|---|---|
| 0 | nothing | scanning the QR, hearing the single | nothing |
| 1 | `ls_voter` cookie | opening any `/loop` URL | 180 days, one browser |
| 2 | **attendee** (`loop_attendees`) | redeeming a code, posting a shot, sharing the single | forever, one device |
| 3 | **claimed**: first name | typing it once | forever |
| 4 | **verified**: email confirmed | clicking a link we send | forever, every device |
| 5 | **customer**: Shopify order linked | buying anything | forever |
| 6 | **credentialed**: a password | only when something needs logging into | forever |

Rungs 0 to 3 and 5 exist in some form today. Rung 4 is the missing one and is
the subject of the next section. **Rung 6 is deliberately not built.** Adding a
password before there is anything to log into produces accounts nobody finishes
creating. When the games and the streaming exist, the same record grows a
credential.

## The hole, and how it closes

`claimIdentity()` in `src/lib/loop/identity/index.ts` merges on an **unverified**
email:

```ts
const owner = await queryOne(`SELECT id FROM loop_attendees WHERE email = ?1`, [mail]);
if (owner && owner.id !== me.id) {
  await bindDevice(voterId, owner.id);   // <- no proof required
```

So: I attend, shoot the winning cover, and am credited. Someone types my email
into "This is me" on their own phone. **Their device now points at my record.**
They inherit my shots, my credits, my cover choice, and the claim on the $50.
The only guard is a rate limit of 10 per 15 minutes per IP, which is no guard at
all against a targeted takeover: it takes one attempt and you only need to know
an email address.

This is live today at `POST /api/loop/me`.

**The fix is a distinction, not a wall:**

1. **Claiming an unclaimed email needs no proof.** If nobody owns it, typing it
   is just labelling yourself. This is the common case and it stays frictionless.
2. **Merging into an existing person requires proof of that address.** Send a
   short-lived code to it; the merge happens when the code comes back. This is
   only possible now that Resend sends from a domain that exists.
3. **A redeemed pass code is already proof.** The code was emailed to that
   address, so someone holding it has demonstrated access. That path may merge
   without a second check.
4. **Never merge silently.** When a new device joins a person, tell the address
   that it happened, with a way to say "not me".

Same rule for names: a display name is a label, not a claim. Two people called
Sarah are fine. Only the **email** carries identity, and only a verified email
moves a device between records.

### While rung 4 is unbuilt

`claimIdentity` must **stop merging** and instead refuse when the email belongs
to somebody else, telling the person to use `/loop/code` with their own
checkout email. Refusing is worse UX than merging and strictly better than
handing someone else's night away. This is the smallest safe change and should
land before the event, because the event is when there is finally something
worth stealing.

## What Shopify is and is not

**Is:** the order of record, the payment, the fulfilment, the pass SKU that
mints a code.

**Is not:** the identity. We do not use Shopify customer accounts as the login
for Loop Soul or Odubo Studio, and we never ask a guest to create one. A guest
checkout is complete: $5, a code, everything needed to turn up.

The link is made **after** payment, from the order's email to the person, by the
same webhook that mints the code. If the email matches a known person, attach
the order. If it does not, that email is now a person at rung 2 with an order
against it, ready for whenever they arrive.

This is why "the account could be created for me based on what I've already
done" is achievable: it already is, on the paths that have proof. The pass
purchase is the strongest proof there is.

## What a guest gets for $5

Nothing gated behind an account:

- an event code, by email, with everything needed for the night
- entry, the room in the app, the Wall, the filter, the cover contest, the vote
- the album as a pre-order
- credit by name on every shot they post

**What a claimed person gets on top:** their cover and their credits following
them to a new phone, their shots findable later, their orders in one place, and
a single record that grows instead of a second account.

## Build order

1. **Refuse cross-person merges** (small, before the event)
2. **Email verification** for rung 4, now that sending works
3. **Link the Shopify order** to the person in the pass webhook
4. Contributor payouts read from the verified record
5. Credentials, only when a surface needs a login

## Hard rules

- **One person, many devices.** The device is a pointer, never the identity.
- **Only a verified email moves a device between people.**
- **Never require an account to attend.** Rung 0 must always reach the single
  and the door.
- **No passwords until something needs logging into.**
- **Credit is written once at capture and never re-keyed.** Royalties are paid
  on it (see `loop-soul-the-faceless.md`).

# The cover contest — the rules

Set by the owner 2026-09-13. **Not built yet.** This is the spec, and a note of
what in the current code contradicts it.

---

## The rules

1. **Who can enter.** Anyone who buys a pass before the event. Buying a pass is
   the entry ticket to the contest, not a separate signup.
2. **When it is open.** From pass purchase, and **still open during the night
   itself**. It does not close when the doors open — the best shot of the
   evening will be taken at the evening.
3. **How many covers a person may hold: three.** A cover is a per-person
   preference — the artwork you see when you open the record — and a person may
   keep up to three and switch between them.
4. **How many they may enter: one.** Holding three and entering one are
   different acts. The entry is a deliberate, separate choice.

Rule 3 and rule 4 are the new part, and the distinction is the point: *what I
look at* and *what I put forward* are not the same decision. Holding three lets
someone keep a shot of their friends, a shot of the room and a shot of
themselves without having to throw two away to enter the third.

## What exists today

**The contest has no backend.** `docs/decisions/loop-soul-contests-galleries-audit.md`
already records this: the sheet on `/loop` explains the contest, the $50 prize
and the $5 magazine feature, and none of it is wired to anything. No entry
marker, no way for a guest to know they are entered, no selection mechanism, no
winner display.

**What does exist is a different thing wearing a similar name.** Migration 158
created `loop_cover_choices`, which is the *fluid cover* — the per-person
preference that decides which artwork you personally see. It is keyed on the
attendee rather than the device so it survives a new phone, and
`src/lib/loop/cover.ts` resolves it through a `mine → official → owner`
ladder. That is not an entry into anything.

## What contradicts the new rules

**Rule 3 is blocked by the schema.** Migration 158 says so in as many words:

```sql
  -- One cover per person per volume. Choosing again replaces, never appends.
  PRIMARY KEY (attendee_id, event_id)
```

Allowing three means the key becomes `(attendee_id, event_id, photo_uid)` with a
cap enforced on write, and `resolveCover` needs to know which of the three is
the *active* one. That is a real migration, not a config change.

**Rule 4 has nowhere to live.** There is no "entered" flag anywhere. It is a new
column or a new table, plus the "you're entered" acknowledgement the audit
already asked for.

**Rules 1 and 2 have no gate.** Nothing checks pass ownership before a cover is
chosen, and nothing opens or closes on a schedule. The event's phase machine
(`pre → …`) exists in `src/lib/loop/hub.ts` and is the obvious place to hang
"still open during the night", but nothing reads it for this.

## The shape of the work, when it is picked up

Roughly, and in the order that de-risks it:

1. A migration: allow up to three rows per attendee per event, add an `entered`
   marker, keep exactly one active choice.
2. `resolveCover` learns about *active* versus *held*.
3. A pass-ownership check on entry, and a close rule tied to the event phase
   rather than a hardcoded date — the date has already moved twice.
4. The acknowledgement and the winner display the audit already asked for.

The reuse the audit identified still stands: `gallery_photos.featured` is
already the curation primitive, already toggled from `/loop/admin`, and already
drives the Journal's Iconic Moments. Picking a winner should go through it
rather than beside it.

# The Faceless — no faces is the look, not a defect

**Decided 2026-08-11 by the owner**, after seeing the video converter render his
head as a solid ink shape:

> "I think the no face thing can be a feature rather than a bug. We can work
> that into a feature for both the posters and also just in general for the
> events when people are taking photos."

This reverses the direction the filter had been heading in — filter v4 added a
dedicated face pass specifically to recover facial structure, and the plan
before this decision was to port that pass into the converter. That work is now
**cancelled for the converter**, and the app filter's face pass is reframed
(see "What this does not change").

---

## The rule

**A Loop Soul figure has no face.** Every person rendered through the house look
— on a poster, on the Wall, in a converted video, on the ticket — is a
silhouette in ink with interior cuts for form, and nothing that reads as
features. Where a face pass currently recovers structure, it should recover
*form* (the turn of a head, the line of a jaw against a collar) and never
identity.

## Why it's right

**It's already the brand.** The crowd on the original banner, the poster
figures, the ticket art — all faceless, and nobody ever read them as unfinished.
The converter didn't invent this; it just applied it to a person the owner
recognised, which made an established convention feel like a fault.

**Anyone can be the figure.** A faceless dancer is a role, not a portrait. It's
what lets a guest photographed at Volume 1 become a poster figure for Volume 3
without it becoming a picture *of them*, and it's what makes the guest-photo →
poster pipeline artistically coherent rather than a collage of strangers.

**It solves the consent problem before it starts.** A room full of people being
filmed for a series is a real privacy question, and every honest answer to it is
some flavour of "we asked, and here's the opt-out". Facelessness answers it at
the level of the medium: the record of the night genuinely cannot identify
anyone who didn't want to be identified. That doesn't remove the need for
consent and terms — it makes them easy to live up to. Feed this into the legal
compliance pass rather than treating it as a substitute for one.

**It's the honest version of what the room is.** The night is about the dancing,
the fit, the movement — music, mode, movement. A face is the one thing that
pulls a picture toward *who* rather than *what we were doing*.

## Where it applies

| Surface | What it means |
|---|---|
| **Posters / print** | Already true. Keep it — no exceptions for "hero" figures. |
| **The camera in the app** | Guests photograph each other and everyone comes out a figure. Say so up front, because it is a selling point and a reassurance at once. |
| **Video converter** | No face pass. The solid head is correct output. |
| **The Wall** | A gallery of figures, not portraits. |
| **Ticket / pass artwork** | Already true. |

## How it's said

It is a promise, not an apology. Never "the filter can't do faces". The line
shipped in the pre-code preview:

> Shoot the night through the Loop Soul filter and everyone comes out a figure —
> ink on sand, no faces. Your shots stay credited to you, and the good ones
> become the artwork for the volumes after this one.

Note the pairing: no faces, but full credit. Anonymity of the image, ownership
of the work. Those two together are the offer.

## What this does not change

- **Credit and identity in the data.** Attribution stays exact — who shot what,
  who attended which volume — because contributor royalties depend on it. The
  image is anonymous; the authorship is not. See
  `loop-identity-and-danceyokey.md`.
- **The app's face pass still has a job.** It should keep the head from
  collapsing into a featureless lump where that reads as a mistake — the turn of
  a head, hair against a background, a jaw over a collar. Form, not features.
  Revisit its tuning against this rule rather than deleting it.
- **Photos taken outside the filter.** Guests can shoot unfiltered; this rule
  governs the house look, not every pixel in the building.

## Consequences to pick up

- Converter: face pass **cancelled** — remove it from the roadmap.
- App filter: re-tune the existing face pass to "form, not features", and
  re-check what it does in good light where it currently recovers the most.
- Legal pass: cite facelessness as a privacy control, not as consent.
- Marketing: the line above is usable copy for the explainer videos.

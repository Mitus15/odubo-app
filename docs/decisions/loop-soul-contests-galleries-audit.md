# Contests & galleries — readiness audit

**2026-08-27**, 30 days out. Audit of the contest and gallery surfaces against
four questions: does it work, can people use it, can they share it, and is the
UX sound. Findings are ordered by how much they'd hurt on the night.

---

## 1. Production readiness

### 🔴 The cover contest has no backend at all

The Cover Contest sheet on `/loop` explains the contest well — how it works,
that the winner becomes the album's cover, that it pays **$50** (and $5 per
magazine feature). **None of it is wired to anything.** There is no entry
marker, no way for a guest to know they're entered, no selection mechanism,
and no winner display. Searching the API and lib layers for contest/winner
logic returns only Danceyokey's raffle and the anthem's bracket — both parked.

As it stands, the contest is a promise on a page.

**The fix is mostly reuse, not building.** `gallery_photos.featured` already
exists, is already toggled from `/loop/admin` (the ✦ action), and already
drives the Journal's Iconic Moments. That is precisely the curation primitive
a cover contest needs — a way to mark standout shots and surface them. What's
missing on top of it is small: a "you're entered" acknowledgement at capture
time, and a place to show the winner afterward.

### 🟠 `/loop/pose` is effectively unlisted

The camera and filter — the thing that *makes* contest entries — is reachable
only by typing the URL, or through the "Try the filter" button inside the
Cover Contest sheet. It isn't in any nav. Before the night that's the main way
someone could try the filter and get excited about it, and almost nobody will
find it.

### 🟠 Camera failures show raw browser errors

`CameraSheet` surfaces `(e as Error).message` straight to the guest. A denied
camera permission renders as a browser-technical string with no guidance and
no recovery path. On the night, permission denial will be the single most
common failure, hitting people standing in a dark courtyard trying to
participate. It needs a human message and a "how to fix it" line.

### 🟢 The galleries themselves work

The Wall, Legacy/Vault and Journal all render and are correctly gated. They're
empty, which is expected before the event — except the **Journal has no issue
row**, so it renders its "being written" state. That's correct behaviour, just
worth knowing it's what a visitor sees today.

---

## 2. Shareability — the weakest area

### 🔴 A shared photo dead-ends on a bare image

Sharing exists in exactly one place — `WallGallery` — and what it shares is
`item.src`: the raw media URL (`/api/loop/gallery/media/<key>`). That's an
**image file, not a page.**

Someone shoots a portrait, comes out as ink-on-sand with no face, loves it,
and sends it to a friend. The friend opens a bare JPEG on an API URL. No Loop
Soul branding, no title, no context, no link back to `/loop`, no way to get a
pass. **This is the most naturally viral moment the whole product has, and it
currently leaks straight out of the funnel.**

The plumbing is right — the media route is deliberately unauthenticated
(unguessable keys, gating lives on the list APIs), so shared links genuinely
do open for people who weren't there. What's missing is a **share page** that
wraps the image: an OG card, the volume, and a way in.

### 🟠 Nothing else is shareable

No share affordance on the front door, the programme, or the contest. The only
share button in the guest experience sits behind the event-code gate, meaning
**sharing is impossible for anyone who hasn't already bought a pass** — the
exact group you'd want doing the sharing.

---

## 3. Accessibility

### 🟢 Colour contrast is genuinely strong

Measured against WCAG:

| Combination | Ratio | AA (4.5:1 body) |
|---|---|---|
| ink `#2a0f0a` on sand `#d9aa7a` | **8.52:1** | ✅ comfortable |
| `.loop-muted` (78% ink) on sand | **5.53:1** | ✅ passes |

The palette is not the problem. The token designed for secondary copy is
compliant.

### 🔴 …but 51 guest-facing opacity washes bypass that token

**This violates a UI rule the owner set himself** (PR #13): *secondary copy
uses `.loop-muted`, never `opacity-60/70` washes.* Measured:

| Wash | Ratio | Verdict |
|---|---|---|
| `opacity-50` | **2.80:1** | ❌ fails AA badly |
| `opacity-60` | **3.56:1** | ❌ fails AA |
| `opacity-75` | 5.12:1 | ✅ passes |

**51 instances across guest-facing components** (221 including admin). The
worst are 10px footer links at `opacity-50` — small *and* washed out — on the
front door and throughout the Journal.

The fix is nearly mechanical: swap `opacity-50/60` on text for `.loop-muted`,
which already exists and already passes. Note two of these are in
`CoverContest.tsx`, written in this session — the rule was broken here too.

### 🟠 The photo lightbox isn't announced as a dialog

`MediaViewer` and `ModuleSheet` have **no `role="dialog"`, no `aria-modal`,
and no focus trapping** — while `GetPassModal`, `LoopBag` and `AddToBagSheet`
all do. So the store's modals are accessible and the *photo gallery* — the
thing guests actually use on the night — isn't. A screen-reader user opening a
shot won't be told a dialog opened, and keyboard focus stays loose behind it.

Credit where due: both do handle **Escape**, `MediaViewer` supports **arrow-key
navigation**, and images carry alt text (falling back to "Loop Soul shot").
The bones are there; the semantics are missing.

---

## 4. UX

- **The cookie wall is the first thing a QR scan shows.** Someone scans a
  flyer and meets a consent modal over a blurred poster before they see
  anything about the event. Worth considering whether it can defer.
- **The app promises an email it can't send** — see the pass-code issue in the
  worklist. The recovery link exists but is framed as a fallback when it's
  currently the only path.
- **The contest can be read about but not acted on**, which is the UX version
  of the production-readiness gap above.

---

## Suggested order

1. **Reword the pass email promise** — minutes, and stops an active lie.
2. **Swap the opacity washes for `.loop-muted`** — near-mechanical, fixes a
   real WCAG failure and honours the existing rule.
3. **Build the share page** — the highest-leverage item for growth; turns the
   product's best moment from a dead end into a funnel.
4. **Wire the contest onto `featured`** — mostly reuse.
5. **Humanise camera errors** and **link `/loop/pose`** — small, high value on
   the night.
6. **Dialog semantics** on `MediaViewer` / `ModuleSheet`.

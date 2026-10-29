# The admin home (2026-10-28)

**His words:** "i cant easily navigate from my admin studio to the social. tbh the whole thing may need redesigning but that would be from later."

**What was wrong**
- Nothing in admin.odubostudio.com linked to the Social Studio. The sidebar's "Social" opened the old Accounts / Growth / AI tab.
- The Studio had no way out: its danceman was not a link.
- On the phone, Inbox, Orders and Links each took three taps through the drawer.

**What it is now** (plan page shown first: claude.ai artifact HLb3CTmiakHSXT3rBigFAw, his "yes, build it")
- `/admin` is a home in the Studio's paper and ink (`.studio` tokens, Jost, the house face for "Odubo Studio").
  - Today's next post: thumbnail, time, level and song, its apps. Picked the way the Studio's Today picks it.
  - ONE drawn shape, the **Post** pill. It opens the Studio on that post (`/admin/social-studio?post=<id>`).
  - The day as a rail: out (filled), up now (ringed), later. Each dot opens its post.
  - Five playbill rows, one live fact each:
    - Inbox: unread conversations.
    - Store: Shopify orders in the last 7 days. Opens Orders.
    - Levels: songs out, as /levels counts them. Opens the site.
    - Links: the piece /links puts first, or "Not in the store" when its handle is gone. Opens the linktree tool.
    - Release: the release project on the floor.
- **⋯** holds every other tool, grouped: Music, Site, Store, Numbers, Social accounts, Loop Soul, House. At the foot: View the site, Sign out.
  - A tool that was a tab of the old admin opens over the home as a room (`?tool=<tab>`), with × back. The phone's back gesture closes it too.
  - A tool with a page of its own (Albums, the Ark, Storage…) opens as that page.
  - Loop Soul's tools are on the site (apex), not the admin host.
- The Studio's danceman goes home. His home-screen shortcut to the Studio still opens the Studio.
- The Ark's floating capture button is off the home (one drawn shape). The Ark is in ⋯ › House.

**How**
- One gated read, `GET /api/admin/home?since&until` (`requireAdmin`; `lib/admin/home.ts`). The page sends the start and end of his day on his phone's clock, so the server never decides what "today" is. Each fact is read on its own; one that fails is null and its row stays bare.
- Signed out, the home goes to `/admin/login?next=…`, like the Studio. The old page decoded the token in the browser and sent strangers to `/login`.
- Dev preview: `/admin?fixtures&now=<ISO>` reads `public/_dev/home-fixtures.json` (git-ignored), like the Studio's `?fixtures`.

**Left as they were, on purpose**
- Each tool itself. Redesigning them one at a time is the "later" he named.
- The old tabs' own looks (dark), inside their rooms.

**Alternatives not taken**
- A link to the Studio added to the old sidebar. One tap more on the phone, and the sidebar stayed the front door.
- Tools as iframes. Heavy, and the pages already work on their own.

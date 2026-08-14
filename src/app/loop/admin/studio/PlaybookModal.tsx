"use client";

import { useEffect } from "react";
import { noteHere } from "../NoteHere";

/**
 * The Playbook — the full written brief, tucked into a tabbed modal so the
 * Studio page itself stays a workbench. Dense on purpose: this is where the
 * promoter comes when he actually needs the thinking behind a tool, clustered
 * by nature (idea / night / deal / money / push / doing).
 *
 * House modal rules: X to close, no drag-to-close, internal scroll. Every tab
 * carries a "Note this ✎" so reactions land on the thread with the topic
 * attached — the docs are meant to be argued with, not just read.
 */

export type PlaybookTab =
  | "start"
  | "idea"
  | "night"
  | "deal"
  | "money"
  | "push"
  | "now";

export const PLAYBOOK_TABS: { id: PlaybookTab; label: string }[] = [
  { id: "start", label: "Start here" },
  { id: "idea", label: "The Idea" },
  { id: "night", label: "The Night" },
  { id: "deal", label: "The Deal" },
  { id: "money", label: "The Money" },
  { id: "push", label: "The Push" },
  { id: "now", label: "Do this now" },
];

export type PlaybookFacts = {
  title: string;
  theme: string;
  venue: string;
  dateLabel: string;
  capacity: number;
  sold: number;
};

/* Small typographic helpers so the prose stays consistent without a CSS file. */
function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 text-xs font-bold uppercase tracking-widest opacity-60 first:mt-0">
      {children}
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed">{children}</p>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="mt-1.5 text-sm leading-relaxed">{children}</li>;
}

export function PlaybookModal({
  tab,
  onSelectTab,
  onClose,
  facts,
}: {
  /** Which tab is open; null = modal closed. */
  tab: PlaybookTab | null;
  onSelectTab: (t: PlaybookTab) => void;
  onClose: () => void;
  facts: PlaybookFacts;
}) {
  const open = tab !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const active = tab as PlaybookTab;
  const label = PLAYBOOK_TABS.find((t) => t.id === active)?.label ?? active;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="The Playbook"
      onClick={onClose}
    >
      <div
        className="flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-bone text-ink sm:h-[88dvh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
          <h2 className="text-base font-extrabold">The Playbook</h2>
          <div className="flex items-center gap-2">
            {/* Prefill the composer AND close the modal — the composer lives on
                the page behind this overlay, so leaving the modal open would
                make the tap look like it did nothing. */}
            <button
              type="button"
              onClick={() => {
                onClose();
                noteHere(`Playbook: ${label}`);
              }}
              aria-label={`Write a note about Playbook: ${label}`}
              className="rounded-full border border-ink/25 px-3 py-1 text-[11px] font-bold opacity-70 transition-opacity hover:opacity-100"
            >
              Note this ✎
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the Playbook"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/10 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </header>

        <nav className="flex gap-1.5 overflow-x-auto border-b border-ink/10 px-4 py-2">
          {PLAYBOOK_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                active === t.id ? "bg-ink text-sand" : "bg-ink/5 opacity-70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 pb-10 pt-4">
          {active === "start" && <StartTab />}
          {active === "idea" && <IdeaTab />}
          {active === "night" && <NightTab facts={facts} />}
          {active === "deal" && <DealTab />}
          {active === "money" && <MoneyTab facts={facts} />}
          {active === "push" && <PushTab />}
          {active === "now" && <NowTab />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── tab content ──────────────────────────── */

function StartTab() {
  return (
    <div>
      <H>What Loop Soul is</H>
      <P>
        A recurring live music-and-dance night in Kamloops that is simultaneously the
        taping of a web series. Every volume produces an episode, a printed magazine
        issue, and the artwork for the volumes after it. The app you&rsquo;re holding
        runs the whole thing — passes, the vote, the cameras, the gallery, the record.
      </P>
      <H>What you now hold</H>
      <ul className="list-disc pl-5">
        <LI>
          <b>This Studio</b> — your workspace. Posters, tickets, pricing, numbers, and
          the thread all live on this one page.
        </LI>
        <LI>
          <b>This Playbook</b> — everything I know, tucked into these tabs. Read
          &ldquo;Do this now&rdquo; last; it ends with a 15-minute tour.
        </LI>
        <LI>
          <b>The thread</b> — our back-channel. No meetings needed: post a note, I
          reply on the same page. Tap &ldquo;Note this ✎&rdquo; anywhere to attach a
          note to what you&rsquo;re looking at.
        </LI>
      </ul>
      <H>Two rules</H>
      <ul className="list-disc pl-5">
        <LI>
          <b>Everything here is live.</b> This is the production site — the posters
          export real files, generated codes open the real door. That&rsquo;s the
          point; just know it.
        </LI>
        <LI>
          <b>Sign your notes.</b> We share one admin key, so the name on a note is the
          only attribution there is.
        </LI>
      </ul>
    </div>
  );
}

function IdeaTab() {
  return (
    <div>
      <H>The brand, exactly</H>
      <ul className="list-disc pl-5">
        <LI>
          The slogan is <b>WHAT WE DANCIN&rsquo; TO</b> — never with a question mark,
          ever. Said aloud it&rsquo;s also &ldquo;what we dance into&rdquo;: a question
          and a statement at once. Don&rsquo;t clean it up.
        </LI>
        <LI>
          The triad is <b>MUSIC · MODE · MOVEMENT</b> — what the night is made of.
        </LI>
        <LI>
          The spoken catchphrase is <b>&ldquo;That&rsquo;s how we do it.&rdquo;</b> —
          the host says it all night, and it ends a post.
        </LI>
        <LI>
          The palette is sand and ink (the exact browns this page is wearing). One
          typographic voice per piece; the loop∞Soul script wordmark is the only
          script, ever.
        </LI>
      </ul>
      <H>The Faceless</H>
      <P>
        Everyone photographed through the house filter comes out a <b>figure — ink on
        sand, no faces</b>. That is the signature look of everything (posters, the
        gallery, the series), and it doubles as a genuine privacy control: the
        published record of the night can&rsquo;t identify someone who didn&rsquo;t
        want to be identified. It is <b>not</b> a substitute for consent — filming is
        stated on the ticket, on signage, and by the host — but it means the material
        most likely to travel is the material least able to embarrass a guest.
      </P>
      <H>The arc</H>
      <P>
        A party that films a series that feeds an app that becomes a legacy. The app
        moves through three phases: <b>The Gathering</b> (now — promote, vote, sell
        passes), <b>The Portal</b> (event night — in-room, code-gated), and{" "}
        <b>Legacy</b> (after — the vault, the magazine, the memories). Guests get
        assigned a <b>team</b> on arrival and can keep it across volumes — returning
        characters are what make a series a series.
      </P>
    </div>
  );
}

function NightTab({ facts }: { facts: PlaybookFacts }) {
  return (
    <div>
      <H>Volume 1 — the facts</H>
      <ul className="list-disc pl-5">
        <LI>
          <b>{facts.title} · {facts.theme}</b> — {facts.dateLabel}, doors 9:00 pm,{" "}
          {facts.venue}.
        </LI>
        <LI>
          Capacity <b>{facts.capacity}</b> — working number, final confirmation with
          the venue in progress. Announce target: week of Aug 18.
        </LI>
      </ul>
      <H>The show, in order</H>
      <P>
        Reception with the DJ (teams assigned on arrival) → an unannounced{" "}
        <b>guitar cold open</b> → the host&rsquo;s welcome → artist 1 → <b>open floor
        Soul Train</b> (whole room, cameras hunting) → <b>Danceyokey</b> — dance
        karaoke, ~3 spots drawn by live raffle, one per team → artist 2 → the band
        (the peak) → <b>the Loop Soul Line</b> — a conga that becomes a circle, two
        break into the middle → photos and the fashion floor.
      </P>
      <H>The anthem</H>
      <P>
        Before the night, the crowd nominates and votes an 8-song bracket down to one
        champion — <b>the Soul Loop Anthem</b> — which the night is scored around.
        Nominating is a pass-holder privilege, which makes the vote itself a sales
        mechanic: buying in literally buys you a say.
      </P>
    </div>
  );
}

function DealTab() {
  return (
    <div>
      <H>The Scott&rsquo;s partnership, plainly</H>
      <ul className="list-disc pl-5">
        <LI>
          Scott&rsquo;s Inn &amp; Suites provides the <b>venue, staff support, and the
          beverage service</b>. <b>Scott&rsquo;s keeps 100% of bar revenue.</b>
        </LI>
        <LI>
          We carry <b>ticket sales, equipment, and production</b>.{" "}
          <b>Odubo keeps 100% of ticket revenue.</b> That&rsquo;s the whole trade: a
          free room and staff in exchange for the bar.
        </LI>
        <LI>
          Agreed in principle with Madison and Eddie; the written confirmation package
          (capacity, staffing, AV, load-in, insurance) is with them now.
        </LI>
        <LI>
          <b>Filming consent</b> for the venue is being confirmed in writing — the
          series tapes in their building, so this one gets its own signature.
        </LI>
      </ul>
      <H>Credit — fixed on every asset</H>
      <P>
        <b>PRESENTED BY → Odubo. IN PARTNERSHIP WITH → Scott&rsquo;s Inn &amp;
        Suites</b> (black mark only). That hierarchy is locked on everything printed
        or posted — a partner contributed the room, the staff, and the bar, and the
        artwork says so. &ldquo;Sponsor&rdquo; is fine in speech; the artwork says
        partner.
      </P>
    </div>
  );
}

function MoneyTab({ facts }: { facts: PlaybookFacts }) {
  return (
    <div>
      <H>How a ticket actually works</H>
      <P>
        The pass <b>is a code</b>. Shopify takes the money → our webhook mints a
        unique code for that order → the code is emailed to the buyer → the code
        opens the door (and the in-app room) once, for one guest. Lost email? The
        guest looks their code up by checkout email at <b>/loop/code</b>.
      </P>
      <ul className="list-disc pl-5">
        <LI>
          The public &ldquo;X of Y left&rdquo; counter reads <b>only real paid
          orders</b> — comps and test codes never inflate it. It shows{" "}
          <b>{facts.sold} sold of {facts.capacity}</b> right now, and that&rsquo;s the
          truth.
        </LI>
        <LI>
          Codes you generate in the Tickets section are <b>comps / door stock</b> —
          real entry, never counted as sales. Generate only what you&rsquo;ll
          physically hand out.
        </LI>
      </ul>
      <H>The price — deliberately unsettled</H>
      <P>
        <b>$20 CAD is a working price, explicitly TBD — this is the first question I
        want your take on.</b> My current position: at ~{facts.capacity} people the
        price barely moves total revenue either way, so price for a <b>full room</b>,
        not for margin — a full room is the asset (the footage, the series, the
        story), an empty room at $35 is worthless. Argue with me on the thread.
      </P>
      <H>Where the money actually is</H>
      <P>
        Not the door — {facts.capacity} × $20 caps around $1,200. Tickets fund the
        night; the <b>assets compound</b>: the audience list, the filmed catalogue,
        the magazine, and artwork made from guest photos that becomes the next
        volume&rsquo;s marketing for free. Volume 1 is priced as a pilot, not a
        payday.
      </P>
    </div>
  );
}

function PushTab() {
  return (
    <div>
      <H>The engine: dancing videos</H>
      <P>
        The core content is Mani&rsquo;s own dance performances rendered through the
        house-look converter — whole scenes as flat sand-and-ink graphics, faceless
        figures, unmistakable in a feed. Cadence target: <b>3× a week on Instagram</b>{" "}
        from announce week (Aug 18) to the night. The videos are the ad, the filter
        is the hook, the QR is the door.
      </P>
      <H>Posters</H>
      <P>
        The Posters section on this page exports finished artwork: <b>print</b>{" "}
        (8×11), <b>feed</b> (4:5), <b>story</b> (9:16), and a{" "}
        <b>print-shop file with bleed and crop marks</b> for clean cutting. Every
        poster carries a QR that points at the app. Swap the figure, the line, and
        the QR target per campaign — the system keeps it on-brand automatically.
      </P>
      <H>Windows worth hitting</H>
      <ul className="list-disc pl-5">
        <LI>Announce week of <b>Aug 18</b>.</LI>
        <LI>
          <b>TRU back-to-school</b> (early Sept) — students return right before the
          night; campus is the densest pool of 60 ticket buyers in town.
        </LI>
      </ul>
      <H>The series &amp; the magazine (what the night becomes)</H>
      <P>
        Four distribution paths: the episode <b>in-app with the real music</b>; a{" "}
        <b>YouTube cut with local artists overdubbed and credited</b> (that&rsquo;s
        how music licensing is solved by design); the in-app{" "}
        <b>memories feed</b>; and a <b>printed magazine issue per volume</b>. Guest
        photos that get starred become the magazine&rsquo;s pages and future poster
        figures — contributors keep credit, and contributor issues carry royalties,
        which is why attribution in this system is derived from capture, never
        retyped.
      </P>
    </div>
  );
}

function NowTab() {
  return (
    <div>
      <H>First — two switches you don&rsquo;t touch (yet)</H>
      <P>
        The owner&rsquo;s admin page (/loop/admin) has an <b>Event phase</b> switcher
        and a <b>Doors</b> toggle. One tap changes what every visitor on the internet
        sees, or removes the code gate. They get flipped together, on purpose, on the
        night. There&rsquo;s also a &ldquo;simulate a purchase&rdquo; test button that
        sends real email. Look, don&rsquo;t touch — <b>everything on THIS page is
        safe to use freely. That&rsquo;s what it&rsquo;s for.</b>
      </P>
      <H>The 15-minute tour</H>
      <ol className="list-decimal pl-5">
        <LI>
          Open <b>/loop</b> in a private window and read it as a stranger would — the
          poster, the countdown-feel, the anthem, &ldquo;Get Pass&rdquo;.
        </LI>
        <LI>
          Back here: in <b>Posters</b>, export a <b>story</b> PNG. That file is
          postable to Instagram right now.
        </LI>
        <LI>
          In <b>Tickets</b>, generate <b>one</b> code. That&rsquo;s a real door
          ticket — treat it like cash.
        </LI>
        <LI>
          In the private window, scroll to the anthem and nominate a song —
          it&rsquo;ll ask for a pass code, use the one you just made.{" "}
          <b>That exact flow is what a paying guest experiences.</b>
        </LI>
        <LI>
          Come back and post your first note on <b>the thread</b> — first
          impressions are the most valuable ones you&rsquo;ll ever have of this.
        </LI>
      </ol>
      <H>Where I want your take (starters — note anything)</H>
      <ul className="list-disc pl-5">
        <LI>Is <b>$20</b> right? (See The Money for my position.)</LI>
        <LI>Announce sequencing from <b>Aug 18</b> — what drops first?</LI>
        <LI>Which channels actually move <b>~60 tickets in Kamloops</b>?</LI>
        <LI>What should Scott&rsquo;s be doing in-room that they aren&rsquo;t?</LI>
        <LI>Anything the tour made you feel — confusion counts double.</LI>
      </ul>
    </div>
  );
}

export default PlaybookModal;

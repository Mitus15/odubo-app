"use client";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";
import { RoomShell } from "@/components/room/RoomParts";
import { onRoom, ROOM_DARK } from "@/lib/room";

interface LegalClientProps {
  privacyContent: ReactNode;
  termsContent: ReactNode;
  shippingContent: ReactNode;
}

/** The three policies, in the order of the row; the keys are the ?tab= every room links to */
const TABS = [
  { key: "privacy", label: "Privacy", title: "Privacy Policy" },
  { key: "terms", label: "Terms", title: "Terms of Service" },
  { key: "shipping", label: "Shipping", title: "Shipping & Returns" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function asTab(value: string | null): TabKey | null {
  return TABS.find((tab) => tab.key === value)?.key ?? null;
}

/** A line drawn in the room's writing, faint */
const HAIRLINE = "color-mix(in srgb, currentColor 35%, transparent)";

/**
 * /legal, set in the house's dark room, so the small print every room links
 * to (the outro, the cookie bar, a piece's made-to-order line) is the same
 * place, not a way out of it. The danceman is the way home. The three
 * policies sit behind a quiet row of tabs that stays at the top as the text
 * scrolls; the open one is underlined. The text itself is set like a
 * playbill's small print (.product-details): a short measure, the labels in
 * caps.
 */
export default function LegalClient({ privacyContent, termsContent, shippingContent }: LegalClientProps) {
  const searchParams = useSearchParams();
  // Read the link's tab before the first paint, so a deep link never shows Privacy first
  const [activeTab, setActiveTab] = useState<TabKey>(() => asTab(searchParams.get("tab")) ?? "privacy");
  const shownRef = useRef<TabKey>(activeTab);
  const rowTopRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  // A link to a tab (?tab=), from anywhere, opens it; a link with none, or an unknown one, leaves the open tab as it is
  useEffect(() => {
    const tab = asTab(searchParams.get("tab"));
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // A new policy starts at its top (when the row is pinned, the room scrolls back to it) and comes in
  // with the room's fade. The panel is kept, not remounted: emptying it mid-commit would drop the room
  // to its very top, so the fade is played on it instead.
  useLayoutEffect(() => {
    if (shownRef.current === activeTab) return;
    shownRef.current = activeTab;
    const rowTop = rowTopRef.current;
    const room = rowTop?.closest(".room");
    if (rowTop && room && room.scrollTop > rowTop.offsetTop) room.scrollTop = rowTop.offsetTop;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panelRef.current?.animate(
        [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }],
        { duration: 280, easing: "ease-out" },
      );
    }
  }, [activeTab]);

  const choose = (tab: TabKey) => {
    setActiveTab(tab);
    // The address follows the open tab, so it can be shared, and a link to another tab always lands
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}${window.location.hash}`);
  };

  // The row is one stop for the keyboard: the arrows move along it
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = TABS.findIndex((tab) => tab.key === activeTab);
    const to =
      e.key === "ArrowRight" ? (at + 1) % TABS.length
      : e.key === "ArrowLeft" ? (at - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(TABS[to].key);
    tabRefs.current[TABS[to].key]?.focus();
  };

  const content: Record<TabKey, ReactNode> = { privacy: privacyContent, terms: termsContent, shipping: shippingContent };
  const open = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];

  return (
    <RoomShell colour={ROOM_DARK} on={onRoom(ROOM_DARK)}>
      <MotionConfig reducedMotion="user">
        <main
          className="mx-auto flex min-h-[calc(100%-env(safe-area-inset-top)-56px)] w-full max-w-[34rem] flex-col px-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 40px)" }}
        >
          <span ref={rowTopRef} aria-hidden="true" className="block" />
          <div
            role="tablist"
            aria-label="Legal"
            onKeyDown={onKeyDown}
            className="sticky z-10 flex items-end gap-7 border-b"
            style={{ top: "env(safe-area-inset-top)", background: "var(--room)", borderColor: HAIRLINE }}
          >
            {TABS.map((tab) => {
              const selected = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  ref={(el) => {
                    tabRefs.current[tab.key] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`legal-tab-${tab.key}`}
                  aria-selected={selected}
                  aria-controls="legal-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(tab.key)}
                  className={`room-eyebrow relative flex min-h-[48px] items-center !text-[12px] transition-opacity hover:!opacity-100 ${selected ? "!opacity-100" : "!opacity-55"}`}
                >
                  {tab.label}
                  {selected && (
                    <motion.span
                      layoutId="legal-tab-line"
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-px h-[2px] bg-current"
                      transition={{ type: "spring", stiffness: 520, damping: 40 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <section ref={panelRef} id="legal-panel" role="tabpanel" aria-labelledby={`legal-tab-${open.key}`} className="room-fade">
            <h1 className="room-display mt-9 text-[26px] leading-tight sm:text-[30px]">{open.title}</h1>
            <div className="product-details mt-5">{content[open.key]}</div>
          </section>

          <p className="room-eyebrow mt-auto pt-16 !text-[10px]">&copy; {new Date().getFullYear()} Odubo Studio</p>
        </main>
      </MotionConfig>
    </RoomShell>
  );
}

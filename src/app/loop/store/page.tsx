import type { Metadata } from "next";
import { cookies } from "next/headers";
import { fetchCollectionProducts } from "@/lib/store/api";
import { LOOP_COLLECTION_HANDLE } from "@/lib/store/brands";
import { COUNTRY_COOKIE } from "@/lib/store/money";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getPublicCapacity } from "@/lib/loop/pass";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getRunOfShow } from "@/lib/loop/content-store";
import { earlyRule } from "@/lib/loop/album";
import { clockTime, shortDate } from "@/lib/loop/eventFacts";
import HubNav from "@/components/loop/shell/HubNav";
import LoopStore from "@/components/loop/store/LoopStore";

export const metadata: Metadata = {
  title: "Store · Loop Soul",
  description: "Passes and pieces for Loop Soul at Scott's Inn, Kamloops.",
};

/**
 * The Loop Soul store — its own storefront, not a filtered view of odubo's.
 *
 * It reads ONE Shopify collection (`loop-soul`), so what the owner drags into
 * that collection is the shelf, in that order. The pass sits here alongside the
 * merch instead of behind a modal on the poster, which is the point: a pass is
 * something you buy from a store.
 *
 * Passes are the one thing odubo's store does not carry (see lib/store/brands);
 * everything else here is deliberately in both, which is why the footer sends
 * people back to the studio rather than pretending this is the whole catalogue.
 */
export default async function LoopStorePage() {
  const jar = await cookies();
  const country = jar.get(COUNTRY_COOKIE)?.value;

  const event = await getCurrentEvent();
  const [capacity, passSettings, runOfShow, early, collection] = await Promise.all([
    getPublicCapacity(),
    getPassSettings(),
    getRunOfShow(event.id),
    earlyRule(),
    // A Shopify outage must not take the store down with a 500 — an empty
    // shelf with the pass still buyable is a far better failure.
    fetchCollectionProducts({
      handle: LOOP_COLLECTION_HANDLE,
      first: 24,
      country,
    }).catch(() => null),
  ]);

  // The same formatters as the poster, so the pass sheet reads identically
  // from the store and from the front door.
  const dateLabel = shortDate(event.date);
  const timeLabel = clockTime(event.date);

  return (
    <>
      <HubNav phaseLabel={event.phase === "live" ? "Tonight" : "The Gathering"} />
      <LoopStore
        products={collection?.products ?? []}
        collectionMissing={collection === null}
        capacity={capacity}
        checkoutUrl={passSettings.checkoutUrl}
        price={passSettings.price}
        currency={passSettings.currency}
        theme={event.theme}
        venue={event.venue}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        runOfShow={runOfShow}
        earlyCount={early.enabled ? early.extra + 1 : 0}
      />
    </>
  );
}

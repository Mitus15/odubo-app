import type { Metadata } from "next";
import { cookies } from "next/headers";
import { fetchCollectionProducts } from "@/lib/store/api";
import { LOOP_COLLECTION_HANDLE } from "@/lib/store/brands";
import { COUNTRY_COOKIE } from "@/lib/store/money";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getPassCapacity } from "@/lib/loop/pass";
import { getPassSettings } from "@/lib/loop/pass/settings";
import HubNav from "@/components/loop/shell/HubNav";
import LoopStore from "@/components/loop/store/LoopStore";

export const metadata: Metadata = {
  title: "Loop Soul — Store",
  description: "Passes and pieces for the Loop Soul series at Scott's Inn, Kamloops.",
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

  const [event, capacity, passSettings, collection] = await Promise.all([
    getCurrentEvent(),
    getPassCapacity(),
    getPassSettings(),
    // A Shopify outage must not take the store down with a 500 — an empty
    // shelf with the pass still buyable is a far better failure.
    fetchCollectionProducts({
      handle: LOOP_COLLECTION_HANDLE,
      first: 24,
      country,
    }).catch(() => null),
  ]);

  const when = new Date(event.date);
  const dateLabel = when.toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = when.toLocaleTimeString("en-CA", {
    timeZone: "America/Vancouver",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      <HubNav phaseLabel={event.phase === "live" ? "The Portal" : "The Gathering"} />
      <LoopStore
        products={collection?.products ?? []}
        collectionMissing={collection === null}
        capacity={capacity}
        checkoutUrl={passSettings.checkoutUrl}
        price={passSettings.price}
        currency={passSettings.currency}
        eventTitle={event.title}
        theme={event.theme}
        venue={event.venue}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
      />
    </>
  );
}

import type { LoopEvent } from "@/lib/loop/hub";
import type { RunOfShowItem } from "@/lib/loop/content";
import type { PublicCapacity } from "@/lib/loop/capacity";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getPublicCapacity } from "@/lib/loop/pass";
import { getRunOfShow } from "@/lib/loop/content-store";
import { earlyRule } from "@/lib/loop/album";
import { clockTime, shortDate } from "@/lib/loop/eventFacts";

/**
 * Everything the pass sheet needs to sell a pass, read once on the server.
 * Every surface that sells (the live gate, the single's page) hands this to
 * GetPassModal, so the sheet says the same thing wherever it opens.
 */
export type PassOffer = {
  capacity: PublicCapacity;
  checkoutUrl: string | null;
  price: string | null;
  currency: string | null;
  theme: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
  runOfShow: RunOfShowItem[];
  earlyCount: number | null;
};

export async function getPassOffer(event: LoopEvent): Promise<PassOffer> {
  const [pass, capacity, runOfShow, early] = await Promise.all([
    getPassSettings(),
    getPublicCapacity(),
    getRunOfShow(event.id),
    earlyRule(),
  ]);
  return {
    capacity,
    checkoutUrl: pass.checkoutUrl,
    price: pass.price,
    currency: pass.currency,
    theme: event.theme,
    venue: event.venue,
    dateLabel: shortDate(event.date),
    timeLabel: clockTime(event.date),
    runOfShow,
    earlyCount: early.enabled ? early.extra + 1 : 0,
  };
}

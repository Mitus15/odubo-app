"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import TheSingle from "@/components/loop/gathering/TheSingle";
import GetPassModal from "@/components/loop/gathering/GetPassModal";
import type { FeaturedSingle } from "@/lib/loop/single";
import type { PassOffer } from "@/lib/loop/pass/offer";

/**
 * The single on its own page (/loop/1984). The same three screens the poster
 * opens as an overlay: the song on the vinyl ring (tap or drag to scrub), what
 * you keep, and the rest of the record. Closing it lands on the poster, and
 * the pass sheet opens right here rather than sending anyone away to buy.
 */
export function SingleStandalone({
  single,
  coverUrl,
  coverCaption,
  dateLabel,
  holder,
  offer,
}: {
  single: FeaturedSingle;
  coverUrl: string | null;
  coverCaption: string;
  dateLabel: string;
  holder: boolean;
  /** Null once passes are no longer sold (after the night). */
  offer: PassOffer | null;
}) {
  const router = useRouter();
  const [passOpen, setPassOpen] = useState(false);

  // Stable identities so memo(TheSingle) holds.
  const close = useCallback(() => router.push("/loop"), [router]);
  const getPass = useCallback(() => {
    if (offer?.checkoutUrl) setPassOpen(true);
    else router.push("/loop");
  }, [offer, router]);
  const coverContest = useCallback(() => router.push("/loop#cover"), [router]);

  return (
    <>
      <TheSingle
        single={single}
        coverUrl={coverUrl}
        coverCaption={coverCaption}
        dateLabel={dateLabel}
        onClose={close}
        onGetPass={getPass}
        onCoverContest={coverContest}
        holder={holder}
      />
      {passOpen && offer && (
        <GetPassModal
          capacity={offer.capacity}
          checkoutUrl={offer.checkoutUrl}
          price={offer.price}
          currency={offer.currency}
          theme={offer.theme}
          venue={offer.venue}
          dateLabel={offer.dateLabel}
          timeLabel={offer.timeLabel}
          runOfShow={offer.runOfShow}
          earlyCount={offer.earlyCount}
          onClose={() => setPassOpen(false)}
        />
      )}
    </>
  );
}

export default SingleStandalone;

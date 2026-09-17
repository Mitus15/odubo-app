import { getCurrentEvent } from "@/lib/loop/hub";
import { countRedeemed } from "@/lib/loop/event-codes";
import { getPassCapacity } from "@/lib/loop/pass";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { getSetting } from "@/lib/loop/loopSetting";
import { priceLabel } from "@/lib/loop/priceLabel";
import { VOLUMES } from "@/lib/loop/poster/volumes";
import { DEFAULT_QR_CAPTION } from "@/lib/loop/poster/layout";
import StudioShell from "./StudioShell";

export const metadata = { title: "Loop Soul — Studio" };

/**
 * /loop/admin/studio — posters, tickets and pricing on one page. Gated by
 * middleware like every /loop/admin path. This server shell does every read;
 * the client shell does the rest. The poster lines come from the same block
 * the print kit reads (lib/loop/poster/volumes), never typed here.
 */
export default async function StudioPage() {
  const event = await getCurrentEvent();
  const [capacity, codeStats, pass, publicBaseUrl, qrCaption] = await Promise.all([
    getPassCapacity(),
    countRedeemed(event.id),
    getPassSettings(),
    getPublicBaseUrl(),
    getSetting("poster_qr_caption"),
  ]);
  const printed = VOLUMES["1"];

  return (
    <StudioShell
      stats={{
        sold: capacity.sold,
        total: capacity.total ?? null,
        redeemed: codeStats.redeemed,
        codes: codeStats.total,
      }}
      publicBaseUrl={publicBaseUrl}
      eventDetails={{
        title: event.title,
        theme: event.theme,
        venue: printed.venue ?? event.venue,
        dateLabel: printed.date ?? "",
        doors: printed.doors,
        note: printed.note,
        record: printed.record,
        feature: printed.feature,
        price: priceLabel(pass.price, pass.currency),
        qrCaption: qrCaption ?? DEFAULT_QR_CAPTION,
      }}
    />
  );
}

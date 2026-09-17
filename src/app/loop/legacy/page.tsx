import type { Metadata } from "next";
import { getCurrentEvent } from "@/lib/loop/hub";
import HubNav from "@/components/loop/shell/HubNav";
import LegacyHome from "@/components/loop/states/LegacyHome";
import VaultMode from "@/components/loop/shell/VaultMode";

export const metadata: Metadata = {
  title: "Loop Soul Legacy",
  description: "The vault: every shot from every volume of Loop Soul.",
};

/** Legacy is always reachable, in every phase. Renders in vault mode. */
export default async function LegacyPage() {
  const event = await getCurrentEvent();
  return (
    <>
      <VaultMode />
      <HubNav phase={event.phase} />
      <LegacyHome />
    </>
  );
}

import type { Metadata } from "next";
import HubNav from "@/components/loop/shell/HubNav";
import LegacyHome from "@/components/loop/states/LegacyHome";
import VaultMode from "@/components/loop/shell/VaultMode";

export const metadata: Metadata = {
  title: "Loop Soul Legacy",
  description: "The persistent vault — galleries and jams from every Loop Soul event.",
};

/** Legacy is always reachable, in every phase. Renders in vault mode. */
export default function LegacyPage() {
  return (
    <>
      <VaultMode />
      <HubNav phaseLabel="The Gathering" />
      <LegacyHome />
    </>
  );
}

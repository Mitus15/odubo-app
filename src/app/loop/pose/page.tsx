import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { hasRoomAccess } from "@/lib/loop/doors";
import PoseStudioShell from "@/components/loop/pose/PoseStudioShell";

/**
 * Standalone Pose Studio (`/loop/pose`) — the camera and the filter, outside
 * the phase-gated Portal. Anyone can shoot and keep shots on their own device.
 *
 * Posting to the Wall is resolved here, server-side, from `hasRoomAccess` — the
 * same rule the Portal and the Vault use. So the doors toggle (or an event
 * code) governs posting from this page too, and testing the camera → Wall →
 * Journal chain no longer requires flipping the event phase to `live` and
 * changing what every visitor to /loop sees.
 */
export const metadata = { title: "Loop Soul — Pose Studio" };

export default async function PosePage() {
  const event = await getCurrentEvent();
  const voterId = await currentVoterId();
  const canPost = await hasRoomAccess(event.id, voterId);

  return <PoseStudioShell canPost={canPost} />;
}

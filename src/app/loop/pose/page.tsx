import PoseStudioShell from "@/components/loop/pose/PoseStudioShell";

/**
 * Standalone Pose Studio route — lets us build/demo the stylizer before State 2
 * (The Portal) and the backend exist. Will be folded into the event-code-gated
 * Portal later (tasks #10/#11). The shell hosts Photo | Video | Gallery.
 */
export const metadata = { title: "Loop Soul — Pose Studio" };

export default function PosePage() {
  return <PoseStudioShell />;
}

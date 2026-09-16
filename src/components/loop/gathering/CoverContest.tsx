"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// The camera pulls in the segmenter and the GL stylizer, a large payload that
// nobody scanning a flyer should download before they have asked for a camera.
const CameraSheet = dynamic(() => import("@/components/loop/pose/CameraSheet"), { ssr: false });

/**
 * The Cover.
 *
 * The cover is FLUID (owner, 2026-09-08): the artwork on the single is his
 * version and stays his version; anyone can hold their own; the room decides
 * on the night which one is official. This sheet shows the cover this person
 * sees, offers the camera, and states the two facts about the contest in two
 * lines. It used to explain the contest in three numbered steps and a prize
 * box before anyone had shot anything; the camera's own result screen already
 * says "Your album cover", and posting already says you are in the running.
 * A guest learns the contest by entering it.
 *
 * Shooting has never needed a pass; only posting to the Wall does. `canPost`
 * is whether THIS device holds a pass.
 */
export function CoverContest({
  canPost = false,
  coverUrl = null,
  coverCaption = "",
}: {
  canPost?: boolean;
  /** Resolved per visitor: theirs, the room's, or the owner's. */
  coverUrl?: string | null;
  coverCaption?: string;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <section className="w-full">
      {coverUrl && (
        <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="The cover" className="h-full w-full object-cover" />
        </div>
      )}
      <p className="mt-4 text-center text-sm">{coverCaption || "This one is mine. Make yours."}</p>

      <button
        type="button"
        onClick={() => setCameraOpen(true)}
        className="mt-5 block w-full rounded-full bg-ink py-4 text-center text-base font-bold text-sand transition-transform active:scale-95"
      >
        Shoot
      </button>

      <div className="mt-6 border-t border-ink/15">
        <p className="border-b border-ink/15 py-3 text-sm">The room picks the official cover on the night.</p>
        <p className="border-b border-ink/15 py-3 text-sm">$50 to whoever shot it. $5 for any shot in the magazine.</p>
      </div>

      <p className="loop-muted mt-4 text-center text-[11px] leading-relaxed">
        {canPost ? "Shoot, then put it on the Wall when you're happy with it." : "Shooting is free. Putting it on the Wall takes a pass."}
      </p>

      {cameraOpen && <CameraSheet canPost={canPost} onClose={() => setCameraOpen(false)} />}
    </section>
  );
}

export default CoverContest;

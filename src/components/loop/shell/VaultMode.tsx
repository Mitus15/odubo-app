"use client";

import { useEffect, useRef } from "react";

/**
 * Flips the Loop Soul surface into "vault mode" (ink field, green ink) while
 * mounted, then restores the green poster field on unmount. Used by Legacy
 * surfaces.
 *
 * Targets the nearest `.loop-theme` wrapper — NOT document.body — because in
 * the merged odubo app the <body> belongs to odubo and a body-level flip would
 * leak vault styling onto every other surface.
 */
export function VaultMode() {
  const anchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const wrapper = anchorRef.current?.closest<HTMLElement>(".loop-theme");
    if (!wrapper) return;
    wrapper.dataset.mode = "vault";
    return () => {
      delete wrapper.dataset.mode;
    };
  }, []);

  // Invisible anchor so the effect can find the wrapper it lives inside.
  return <span ref={anchorRef} hidden aria-hidden="true" />;
}

export default VaultMode;

import clsx from "clsx";

/**
 * The real Loop Soul logo (hand-script "loop" with the infinity, "Soul" beneath).
 * Source: the owner's vector (`public/branding/loop-soul.svg`). Black artwork —
 * sits correctly on the sand field, matching the posters.
 *
 * Do NOT replace this with a typeset approximation; use the actual file.
 */
export function Logo({
  className,
  width = 128,
}: {
  className?: string;
  width?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/loop/branding/loop-soul.svg"
      alt="Loop Soul"
      width={width}
      className={clsx("h-auto select-none", className)}
      draggable={false}
    />
  );
}

export default Logo;

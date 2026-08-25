import clsx from "clsx";

/**
 * The real Loop Soul logo (hand-script "loop" with the infinity, "Soul" beneath).
 * Source: the owner's vector (`public/branding/loop-soul.svg`). The file carries
 * no per-path fill, so it used to render pure black while every other mark on
 * the page — Odubo's included — is ink #2a0f0a. A root `fill` on the SVG now
 * makes it inherit ink and sit in the same family as the rest of the artwork.
 * It is never placed on a dark ground, so ink is safe everywhere it appears.
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

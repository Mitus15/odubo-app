/**
 * ArcedTagline — the recurring poster device: a hand-marker question curved
 * along an arc ("What are you dancing to?", "…listening to?", "…spinning?").
 * Reused across states as a brand motif ("…voting for?", "…wearing?").
 */
export function ArcedTagline({
  text,
  className,
  width = 320,
}: {
  text: string;
  className?: string;
  width?: number;
}) {
  // viewBox cropped to the text's actual extent (the arc text only reaches
  // ~y128) so there's no dead space baked under the words.
  const height = width * (132 / 320);
  const id = `arc-${text.replace(/[^a-z0-9]/gi, "").slice(0, 16)}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 320 132"
      className={className}
      role="img"
      aria-label={text}
    >
      <defs>
        {/* Gentle upward arc the text rides along. */}
        <path id={id} d="M20,120 Q160,20 300,120" fill="none" />
      </defs>
      <text
        fill="currentColor"
        style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 22 }}
        letterSpacing="0.5"
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  );
}

export default ArcedTagline;

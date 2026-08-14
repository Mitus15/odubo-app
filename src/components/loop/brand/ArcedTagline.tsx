/**
 * ArcedTagline — the question device: a line curved along an upward arc.
 *
 * The rule (docs/decisions/loop-soul-brand-language.md): **the arc asks;
 * straight type states.** It carries question-shaped lines — the anthem phrase
 * "What we dancin' to", "What do you remember?" — on the tournament family and
 * the app's question screens. It never carries the slogan ("Come Dance"),
 * which is always set straight.
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

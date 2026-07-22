import clsx from "clsx";

/**
 * The Loop Soul wordmark: "loop" with an infinity glyph for the "oo",
 * "Soul" set in script beneath. Approximates the poster lettering with web
 * fonts; can be swapped for the final logo SVG (../../Branding) later.
 */
export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const scale = { sm: "text-xl", md: "text-3xl", lg: "text-5xl" }[size];
  return (
    <span className={clsx("inline-flex flex-col items-center leading-none", className)}>
      <span className={clsx("font-sans font-medium tracking-tight", scale)}>
        l<span aria-hidden="true">∞</span>p
        <span className="sr-only">loop</span>
      </span>
      <span
        className={clsx(
          "font-script -mt-1",
          { sm: "text-2xl", md: "text-4xl", lg: "text-6xl" }[size],
        )}
        style={{ fontFamily: "var(--font-script)" }}
      >
        Soul
      </span>
    </span>
  );
}

export default Wordmark;

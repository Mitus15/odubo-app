import Image from "next/image";
import { LOOKBOOK } from "@/lib/loop/content";

/**
 * The Lookbook — a horizontal, swipeable gallery. CSS scroll-snap means it
 * works with zero JS. Seeded with the poster concepts as the mood board;
 * swapped for curated outfit shots when those land.
 */
export function Lookbook() {
  return (
    <section className="w-full">
      <header className="mb-3 px-1">
        <h2 className="text-2xl font-extrabold">The Lookbook</h2>
        <p className="text-sm opacity-70">Set the tone. Theme: 1984.</p>
      </header>
      <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LOOKBOOK.map((item) => (
          <figure
            key={item.id}
            className="relative aspect-[3/4] w-[68%] shrink-0 snap-center overflow-hidden rounded-3xl bg-sand-deep/10 sm:w-[44%]"
          >
            <Image
              src={item.src}
              alt={item.label}
              fill
              sizes="(max-width: 640px) 68vw, 44vw"
              className="object-cover"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}

export default Lookbook;

/**
 * The words on /loop/press: pure, so the page and the tests read the same
 * thing, and every fact in a caption comes from the event, never a literal.
 *
 * House rules the captions keep: the date, the place and the price in every
 * one (repetition is the strategy); 19+ on everything; no em dashes; no
 * Michael Jackson tags (the reels carry Billie Jean, an exact commercial
 * master, and there is no reason to hand the matcher a hint).
 */

export type CaptionFacts = {
  /** "6:30" */
  doors: string;
  /** "8" */
  album: string;
  /** "$5" or "FREE ENTRY" */
  price: string;
  /** Whole days until the night, in the venue's timezone. */
  days: number;
  /** "odubostudio.com/loop", no scheme. */
  site: string;
};

export type Caption = { id: string; label: string; who: "mani" | "anyone"; reel: string | null; text: string };

export const HASHTAGS = "#Kamloops #LoopSoul #ComeDance #KamloopsEvents #KamloopsMusic #YKA";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 18 → "Eighteen", 26 → "Twenty six". Captions read better in words. */
export function daysInWords(n: number): string {
  const w = n < 20 ? ONES[n] : n < 100 ? `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}` : String(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Whole days from `today` to the night, both as YYYY-MM-DD in venue time. */
export function daysUntil(todayYmd: string, nightYmd: string): number {
  const ms = Date.parse(`${nightYmd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function captions(f: CaptionFacts): Caption[] {
  const price = f.price === "FREE ENTRY" ? "Free" : f.price;
  const countdown =
    f.days === 0 ? "Tonight." : f.days === 1 ? "Tomorrow." : `${daysInWords(f.days)} days.`;
  return [
    {
      id: "anyone",
      label: "For anyone to post",
      who: "anyone",
      reel: "loop",
      text: `Mani Odubo is playing his album Loop Soul live, front to back, for the first time. Saturday October 10, in the courtyard at Scott's Inn & Suites, Kamloops. Doors ${f.doors}, album at ${f.album}, Amen the DJ after. ${price}. 19+. Dress code 80s.\n${f.site}`,
    },
    {
      id: "announce",
      label: "The announcement, in Mani's voice",
      who: "mani",
      reel: "loop",
      text: `I made an album. On October 10th I'm playing it front to back, out loud, in the courtyard at Scott's, and that's the first time anyone hears it.\n\nDoors ${f.doors}. Album at ${f.album}. ${price}. 19+. Dress code is 80s.\nKamloops, come dance.\n${f.site}`,
    },
    {
      id: "room",
      label: "The follow-up",
      who: "anyone",
      reel: "energetic",
      text: `This is what the night is for.\n\nLoop Soul, an album by Mani Odubo, played start to finish for the first time. Saturday October 10 at Scott's Inn & Suites, Kamloops. Doors ${f.doors}, album at ${f.album}, Amen the DJ after. ${price}. 19+. 80s.\n${f.site}`,
    },
    {
      id: "countdown",
      label: "The countdown",
      who: "anyone",
      reel: "calm",
      text: `${countdown}\n\nSaturday October 10, Scott's Inn & Suites, Kamloops. The whole album, live, in the courtyard. Doors ${f.doors}. Album at ${f.album}. ${price}. 19+.\nCome dance.\n${f.site}`,
    },
    {
      id: "single",
      label: "The single",
      who: "anyone",
      reel: null,
      text: `Hear 1984, free: ${f.site}/1984\n\nIt's the first song from Loop Soul. On Saturday October 10 the whole album plays live in the courtyard at Scott's Inn & Suites, Kamloops. ${price}. 19+. Dress code 80s.`,
    },
  ];
}

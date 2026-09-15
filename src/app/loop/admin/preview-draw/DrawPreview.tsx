"use client";

import { useState } from "react";
import TheDraw from "@/components/loop/album/TheDraw";

/**
 * The draw, on a loop, for the host to watch.
 *
 * A client wrapper exists because `onDone` is a function and a server
 * component cannot hand one to a client component. Ending the draw here
 * restarts it rather than revealing a player, since the point of this page is
 * to see the ceremony rather than to reach the music.
 */
export default function DrawPreview(props: {
  albumTitle: string;
  artist: string;
  total: number;
  freeTitle: string;
  dealtTitles: string[];
  poolTitles: string[];
}) {
  const [run, setRun] = useState(0);
  return <TheDraw key={run} {...props} onDone={() => setRun((n) => n + 1)} />;
}

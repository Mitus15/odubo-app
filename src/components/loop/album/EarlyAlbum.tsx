"use client";

import { useEffect, useState } from "react";
import TheDraw from "./TheDraw";

/**
 * First visit gets the draw; every visit after gets the music.
 *
 * The flag is per album, so a later volume performs its own draw, and it is
 * written the moment the ceremony ends rather than when it starts — a person
 * who closes the tab halfway through has not seen it yet and should get it
 * again. Storage can throw (private windows, blocked site data), and the
 * honest failure there is to skip the ceremony and show the music, never to
 * block someone out of what they paid for.
 */
export default function EarlyAlbum({
  albumId,
  albumTitle,
  artist,
  total,
  freeTitle,
  dealtTitles,
  poolTitles,
  children,
}: {
  albumId: string;
  albumTitle: string;
  artist: string;
  total: number;
  freeTitle: string;
  dealtTitles: string[];
  poolTitles: string[];
  children: React.ReactNode;
}) {
  const key = `loop.album.drawn.${albumId}`;
  // Null until we have asked storage: rendering either branch before then
  // flashes the wrong one.
  const [drawn, setDrawn] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDrawn(window.localStorage.getItem(key) === "1");
    } catch {
      setDrawn(true);
    }
  }, [key]);

  if (drawn === null) return null;

  if (!drawn) {
    return (
      <TheDraw
        albumTitle={albumTitle}
        artist={artist}
        total={total}
        freeTitle={freeTitle}
        dealtTitles={dealtTitles}
        poolTitles={poolTitles}
        onDone={() => {
          try {
            window.localStorage.setItem(key, "1");
          } catch {
            /* the ceremony simply plays again next time */
          }
          setDrawn(true);
        }}
      />
    );
  }

  return <>{children}</>;
}

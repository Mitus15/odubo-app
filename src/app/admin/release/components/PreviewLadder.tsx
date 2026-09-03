'use client';

import { useState } from 'react';

import type { WarehouseFile } from '@/lib/release/types';
import { Chip, formatBytes } from './ui';

interface TrackLike {
  id: string;
  title: string;
  audio_url: string | null;
}

/**
 * Which rung of the playback ladder this song is on, and what it would take
 * to climb the next one.
 *
 *   1. raw master   — plays straight from storage. No ffmpeg, no waiting, but
 *                     it is the full uncompressed file down the wire.
 *   2. web          — the two-pass loudnorm .web.m4a. What a listener should
 *                     get before the link goes anywhere wide.
 *   3. HLS          — adaptive. Derived from audio_url on read; nothing to
 *                     store.
 *
 * Rung 2 is a local CLI step because ffmpeg cannot run on the edge and the
 * function budget will not hold a two-pass loudnorm on a hundred-megabyte
 * WAV. So the honest thing is to show the command rather than pretend a
 * button could do it.
 */
export default function PreviewLadder({
  track,
  shippedFile,
}: {
  track: TrackLike;
  shippedFile: WarehouseFile | null;
}) {
  const [copied, setCopied] = useState(false);

  const url = track.audio_url ?? '';
  const rung: 'silent' | 'raw' | 'web' = !url
    ? 'silent'
    : /\.web\.m4a$/i.test(url)
      ? 'web'
      : 'raw';

  const command = `npm run audio:transcode:track -- --track ${track.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is on screen to select by hand */
    }
  };

  return (
    <div className="rounded-xl border border-[#502d26]/50 bg-[#0d0c0a] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[#726d6c]">Preview</span>

        {rung === 'silent' && (
          <Chip tone="bad" title="Nothing is flagged to ship, so there is nothing to play">
            silent
          </Chip>
        )}
        {rung === 'raw' && (
          <Chip tone="warn" title="Playing the master itself, uncompressed">
            raw master
            {shippedFile ? ` · ${formatBytes(shippedFile.size_bytes)}` : ''}
          </Chip>
        )}
        {rung === 'web' && (
          <Chip tone="good" title="Loudness-normalised AAC — what a listener should get">
            web
          </Chip>
        )}
      </div>

      {rung === 'raw' && (
        <div className="mt-2">
          <p className="text-[11px] text-[#726d6c]">
            Fine for checking the record and for sending to a few people. Transcode before
            the link goes anywhere wide — it is a full uncompressed file every time someone
            presses play.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-[#1c1a19] border border-[#502d26]/50 px-2 py-1 text-[11px] text-[#b2a491]">
              {command}
            </code>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg border border-[#502d26]/60 px-2 py-1 text-[10px] text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]"
            >
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

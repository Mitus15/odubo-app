/**
 * Adding a song to an album from the admin, in the order the routes need it.
 *
 * The audio goes to storage first (POST /api/upload), then the track is
 * created from JSON that points at it (POST /api/tracks), then its credits
 * are filed under the id that route answers with (PUT /api/tracks/[id]/credits).
 * The first two steps are the contract AlbumCreationWizard already uses.
 *
 * AlbumModal used to send all of it as one multipart form to /api/tracks,
 * which reads JSON, so every upload from "View & Add Tracks" failed with a 500.
 */
import { MEDIA_PROXY_PREFIX } from '@/lib/release/audioSource';
import type { TrackCredit } from '@/types/music';

export interface NewAlbumTrack {
  file: File;
  title: string;
  track_number: number;
  duration: number;
  explicit_content: boolean;
  credits: TrackCredit[];
}

export interface UploadedAlbumTrack {
  /** The new track's id, or null from a route too old to answer with it. */
  id: string | null;
  /** False when the track was made but its credits were not saved. */
  creditsSaved: boolean;
}

async function saveCredits(trackId: string, credits: TrackCredit[]): Promise<boolean> {
  try {
    const response = await fetch(`/api/tracks/${trackId}/credits`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credits }),
    });
    const result = (await response.json()) as { success?: boolean };
    return response.ok && result.success === true;
  } catch (error) {
    console.error('Error saving credits for new track:', trackId, error);
    return false;
  }
}

/**
 * Upload one track's audio and create the track. Throws, with a reason the
 * owner can read, when the track was not created.
 */
export async function uploadAlbumTrack(
  album: { id: string; title: string },
  track: NewAlbumTrack
): Promise<UploadedAlbumTrack> {
  // Checked before uploading, so a track the route would refuse does not
  // leave its audio behind in storage.
  if (!track.title.trim() || !Number.isInteger(track.track_number) || track.track_number < 1) {
    throw new Error('Needs a title and a track number');
  }

  const audioForm = new FormData();
  audioForm.append('file', track.file);
  audioForm.append('fileType', 'track');
  audioForm.append('albumId', album.id);
  audioForm.append('albumTitle', album.title);
  audioForm.append('trackTitle', track.title);
  audioForm.append('trackNumber', track.track_number.toString());

  const audioResponse = await fetch('/api/upload', { method: 'POST', body: audioForm });
  // The file passes through a function, and Vercel refuses a request body
  // over 4.5 MB with a 413 of its own, which need not be JSON.
  const audio = (await audioResponse.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    key?: string;
  };
  if (!audioResponse.ok || !audio.success || !audio.key) {
    throw new Error(
      audio.error ||
        (audioResponse.status === 413
          ? 'The file is too large to upload here'
          : `HTTP ${audioResponse.status}: Failed to upload the audio`)
    );
  }

  // The media proxy's address, not the bucket's public URL: the proxy holds
  // an unreleased album's audio back, and it only recognises a track whose
  // audio_url is in this form.
  const response = await fetch('/api/tracks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: track.title,
      album_id: album.id,
      track_number: track.track_number,
      audio_url: `${MEDIA_PROXY_PREFIX}${audio.key}`,
      duration: track.duration,
      explicit_content: track.explicit_content,
    }),
  });
  const created = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    id?: string;
  };
  if (!response.ok || !created.success) {
    throw new Error(created.error || `HTTP ${response.status}: Failed to create the track`);
  }

  // The track exists from here on, so a credits failure is reported rather
  // than thrown: retrying the whole upload would make the track twice.
  const id = created.id ?? null;
  if (track.credits.length === 0) return { id, creditsSaved: true };
  return { id, creditsSaved: id ? await saveCredits(id, track.credits) : false };
}

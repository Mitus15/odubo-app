import { getSetting } from "@/lib/loop/loopSetting";

/**
 * Whether the singles rollout (Makunahea, 1984, News Peak, then the album) is
 * paused. The owner shelved the album on 2026-10-11 to plan its release, and
 * the dance videos come first with the album's story kept back; the pages kept
 * saying "1984, out now" with the next two "soon", and named every song.
 *
 * While paused: a single that is not out, and a chapter not yet revealed, are
 * not there for the public; the single that is out stays (old flyers point at
 * it) without the list of what comes next; /loop goes to /music. The owner and
 * team still see everything. Back on with loop_settings.singles_rollout = "on".
 */
export async function rolloutPaused(): Promise<boolean> {
  return (await getSetting("singles_rollout")) !== "on";
}

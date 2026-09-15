import { cookies } from "next/headers";
import { VOTER_COOKIE, verifyVoter } from "@/lib/loop/anthem-identity";

/**
 * The current request's verified anonymous voter id.
 *
 * This is the bottom rung of identity for everything under /loop: the gallery,
 * the ballots, the cover choice, pose, the pass lookup. The cookie is minted by
 * middleware on any /loop hit and is HMAC-signed, so it cannot be forged into
 * someone else's id, only cleared.
 *
 * It lived in anthem-server.ts, which made a parked tournament the root of the
 * whole product's identity. It is deliberately NOT re-exported from
 * identity/index.ts: this module pulls in `next/headers`, and index.ts is
 * imported by cover.ts, ballots.ts, wall/server.ts and recovery.ts, which must
 * stay usable outside a request scope.
 */
export async function currentVoterId(): Promise<string> {
  const store = await cookies();
  const id = await verifyVoter(store.get(VOTER_COOKIE)?.value);
  return id ?? "anonymous";
}

/**
 * One media shape for every Loop Soul surface — the live Wall, your own
 * on-device shots, Iconic Moments, and the Legacy Vault. Before this, each
 * surface had its own tile markup and viewer, which is why they felt like
 * three different apps; now they share `MediaGrid` + `MediaViewer` and differ
 * only in what they load and which actions they offer.
 */
export type MediaItem = {
  /** Stable key. Wall: the shot's uid. On-device: the IndexedDB id. */
  id: string;
  /** Displayable source (URL for Wall media, object URL for local blobs). */
  src: string;
  kind: "image" | "video";
  /** Who posted it (Wall only). */
  author?: string | null;
  caption?: string | null;
  /** Curated into Iconic Moments. */
  featured?: boolean;
  /** Moderation state, admin views only: 0/null pending, 1 approved, 2 hidden. */
  moderated?: number | null;
  /** True when the item lives only on this device (not posted). */
  local?: boolean;
  /** Numeric id for admin actions (Wall rows). */
  rowId?: number;
};

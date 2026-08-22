/**
 * Apply the Release Control migrations (153, 154, 155) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/release/apply_155_release_control.ts
 *
 * Idempotent by construction:
 *   - 153/154 are pure CREATE ... IF NOT EXISTS. Production already has their
 *     effects (applied out-of-band 2026-08-21, no ledger entry, file lost), so
 *     they are a no-op there and convergent on a fresh database.
 *   - 155's ALTERs cannot be guarded in SQL, so each one is preceded by a
 *     PRAGMA table_info() check and skipped when the column already exists.
 *
 * Uses src/lib/loop/db (DATABASE_URL). Do NOT use
 * scripts/apply_d1_migrations_via_api.mjs — it prefers CLOUDFLARE_D1_API_URL,
 * which is missing the database id in .env.local.
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

async function tableExists(name: string): Promise<boolean> {
  const rows = await queryDatabase<{ name: string }>(`PRAGMA table_info(${name})`);
  return rows.length > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await queryDatabase<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

/** Statements safe to run unconditionally — every one is IF NOT EXISTS. */
const CREATES: string[] = [
  // --- 153_warehouse.sql ---
  `CREATE TABLE IF NOT EXISTS warehouse_projects (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL CHECK (type IN ('album','film','fashion','other')),
     title TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','shipped','archived')),
     album_id TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS warehouse_pieces (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES warehouse_projects(id),
     kind TEXT NOT NULL CHECK (kind IN
       ('cover','vinyl','packaging','track-master','promo','other')),
     title TEXT NOT NULL,
     description TEXT,
     track_id TEXT,
     preview_file_id TEXT,
     sort_order INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS warehouse_files (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES warehouse_projects(id),
     piece_id TEXT REFERENCES warehouse_pieces(id),
     class TEXT NOT NULL CHECK (class IN ('working','master','commercial')),
     category TEXT NOT NULL CHECK (category IN
       ('preview-image','audio-master','daw-project','artwork-source','video','document','other')),
     r2_key TEXT NOT NULL UNIQUE,
     original_filename TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     size_bytes INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading','ready','failed')),
     uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_wh_pieces_project ON warehouse_pieces(project_id, kind, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_wh_files_project ON warehouse_files(project_id, piece_id)`,
  `CREATE INDEX IF NOT EXISTS idx_wh_files_class ON warehouse_files(project_id, class)`,

  // --- 154_warehouse_docs.sql ---
  `CREATE TABLE IF NOT EXISTS warehouse_docs (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES warehouse_projects(id),
     track_id TEXT,
     kind TEXT NOT NULL CHECK (kind IN ('note','lore','character','story','draft','other')),
     title TEXT NOT NULL,
     body TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_wh_docs_project ON warehouse_docs(project_id, kind, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_wh_docs_track ON warehouse_docs(track_id)`,

  // --- 155_release_control.sql ---
  `CREATE TABLE IF NOT EXISTS release_links (
     id         TEXT PRIMARY KEY,
     album_id   TEXT NOT NULL,
     kind       TEXT NOT NULL CHECK (kind IN (
                  'ark-project','ark-task','video','social-post','loop-event',
                  'shopify-product','journal-issue','poster-kit','deployment','other')),
     ref_id     TEXT NOT NULL,
     label      TEXT,
     meta       TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_release_links_uniq ON release_links(album_id, kind, ref_id)`,
  `CREATE INDEX IF NOT EXISTS idx_release_links_album ON release_links(album_id, kind)`,
];

/** ALTERs that must be guarded — SQLite has no ADD COLUMN IF NOT EXISTS. */
const ADD_COLUMNS: Array<{ table: string; column: string; ddl: string }> = [
  { table: "albums", column: "shopify_product_id", ddl: "ALTER TABLE albums ADD COLUMN shopify_product_id TEXT" },
  { table: "albums", column: "shopify_product_handle", ddl: "ALTER TABLE albums ADD COLUMN shopify_product_handle TEXT" },
  { table: "tracks", column: "source_file_id", ddl: "ALTER TABLE tracks ADD COLUMN source_file_id TEXT" },
];

async function main() {
  for (const sql of CREATES) {
    await executeQuery(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 70));
  }

  for (const { table, column, ddl } of ADD_COLUMNS) {
    if (await columnExists(table, column)) {
      console.log(`· ${table}.${column} already exists — skipped`);
      continue;
    }
    await executeQuery(ddl);
    console.log("✓", ddl);
  }

  // The index on tracks.source_file_id must come AFTER the column exists.
  await executeQuery(`CREATE INDEX IF NOT EXISTS idx_tracks_source_file ON tracks(source_file_id)`);
  console.log("✓ CREATE INDEX IF NOT EXISTS idx_tracks_source_file");

  // Verify
  const missing: string[] = [];
  for (const t of ["warehouse_projects", "warehouse_pieces", "warehouse_files", "warehouse_docs", "release_links"]) {
    if (!(await tableExists(t))) missing.push(t);
  }
  for (const { table, column } of ADD_COLUMNS) {
    if (!(await columnExists(table, column))) missing.push(`${table}.${column}`);
  }
  if (missing.length) throw new Error(`missing after apply: ${missing.join(", ")}`);

  console.log("\nRelease Control schema ready (153 + 154 + 155).");
}

main().catch((e) => {
  console.error("Release Control migration failed:", e);
  process.exit(1);
});

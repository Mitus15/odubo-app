#!/usr/bin/env bash
#
# Zip each Logic project into its own archive, ready to ingest as a working file.
#
# WHY ZIP AT ALL
# --------------
# A .logicx is a macOS *package* — a directory the Finder draws as one file.
# A browser folder picker walks straight into it, so ingesting the album folder
# raw would upload ~335 loose ProjectData blobs and plists that can never be
# reassembled into an openable project. One zip per project is one file that
# actually restores.
#
# UPDATABLE BY DESIGN
# -------------------
# The owner is still working on these. Each run stamps the archive with the
# project's own last-modified date, so re-running after a session produces a
# NEW archive beside the old one rather than overwriting it — the warehouse
# files a 'working' class file per upload and stacks them newest-first, so the
# history is the backup. Unchanged projects are skipped, so a re-run only
# costs what actually changed.
#
#   scripts/release/zip_logic_projects.sh                      # default folder
#   scripts/release/zip_logic_projects.sh <album-folder> <out>
#
set -euo pipefail

SRC="${1:-/Users/maniodubo/Documents/Newspeak/Logic files}"
OUT="${2:-/Users/maniodubo/Documents/Newspeak/_logic-archives}"

[ -d "$SRC" ] || { echo "No such folder: $SRC" >&2; exit 1; }
mkdir -p "$OUT"

made=0; skipped=0

for project in "$SRC"/*.logicx; do
  [ -e "$project" ] || continue
  name="$(basename "$project" .logicx)"
  # Stamp with the project's own mtime, not today's date: re-running on an
  # untouched project must not manufacture a new "version".
  stamp="$(date -r "$project" +%Y%m%d-%H%M)"
  archive="$OUT/${name}_${stamp}.zip"

  if [ -f "$archive" ]; then
    echo "  = $name — unchanged since $stamp"
    skipped=$((skipped+1))
    continue
  fi

  echo "  + $name -> $(basename "$archive")"
  # -y keeps symlinks as links; -x drops macOS metadata and Logic's own
  # undo scratch, which is large, per-machine and worthless in a backup.
  ( cd "$SRC" && zip -q -r -y "$archive" "$name.logicx" \
      -x '*/.DS_Store' -x '*Undo Data.nosync/*' -x '__MACOSX/*' )
  made=$((made+1))
done

echo
echo "$made new archive(s), $skipped unchanged"
echo "Folder: $OUT"
[ "$made" -gt 0 ] && du -sh "$OUT" | awk '{print "Total: " $1}'
echo
echo "Next: ingest this folder from /admin/release — the archives file as"
echo "'working' against each song, and re-running later stacks new versions."

#!/bin/zsh
# segment -> paint -> figure for each take given, in order; each stage marks itself done.
export FILM_WORK="/Users/maniodubo/Documents/Apps/odubo/projects/Loop Soul Dance/Work files"
cd "$(dirname "$0")/../film"
for T in "$@"; do
  D="$FILM_WORK/$T"
  echo "== $T $(date +%T)"
  [ -f "$D/.done-segment" ] || { python3 segment.py $T && touch "$D/.done-segment"; } || exit 1
  echo "-- segmented $(date +%T)"
  [ -f "$D/.done-paint" ] || { python3 paint.py $T && touch "$D/.done-paint"; } || exit 1
  echo "-- painted $(date +%T)"
  [ -f "$D/.done-figure" ] || { python3 figure.py $T --height=2160 --look=gloss && touch "$D/.done-figure"; } || exit 1
  echo "== $T drawn $(date +%T)"
done
echo "== all done $(date +%T)"

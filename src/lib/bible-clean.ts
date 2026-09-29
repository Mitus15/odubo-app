/**
 * Clean a KJV verse from the thiagobodruk source (both data/bible-*.json files).
 *
 * Braces there mean two different things, and only one of them goes:
 *   {is}                   a word the translators supplied (printed in italics):
 *                          the word stays, the braces go.
 *   {ungodly: or, wicked}  a margin note: the whole span goes. Every note has a
 *                          colon ("or,", "Heb."), and no supplied word does.
 *
 * Found 2026-09-29: the old rule stripped only the brace characters, so the
 * daily verse printed its margin notes ("...scornful. ungodly: or, wicked").
 */
const MARGIN_NOTE = /\s*\{[^}]*:[^}]*\}/g;

export function cleanVerse(verse: string): string {
  return verse.replace(MARGIN_NOTE, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

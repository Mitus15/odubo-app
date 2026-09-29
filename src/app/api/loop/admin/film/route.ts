import { NextRequest, NextResponse } from "next/server";
import shape from "../../../../../../data/loop/film/shape.json";
import { executeQuery } from "@/lib/loop/db";
import { searchVerses } from "@/lib/loop/film/kjv";
import {
  StoryRuleError,
  createCard,
  createWorld,
  deleteCard,
  deleteWorld,
  getChapter,
  listCards,
  listChapters,
  listWorld,
  updateCard,
  updateChapter,
  updateWorld,
  type CardPatch,
  type ChapterPatch,
  type WorldPatch,
} from "@/lib/loop/film/store";

export const runtime = "nodejs";

/**
 * The Loop Soul film's story, from the admin (/loop/admin/film).
 * Auth: middleware gates /api/loop/admin/*.
 *
 *   GET                 → { chapters, cards, world, shape }
 *   GET ?q=<words|ref>  → { verses }: KJV search, never a verse that names Him
 *   POST { action, ... }:
 *     chapter.update  { slug, patch }
 *     lyrics.save     { slug, text }   corrected lyrics onto tracks.lyrics
 *     card.create     { chapter, verseRef, verseText, flip? }
 *     card.update     { id, patch }
 *     card.delete     { id }           refused once the card has a clip
 *     world.create    { slug, name, line, revealedWith?, sort? }
 *     world.update    { slug, patch }
 *     world.delete    { slug }
 *
 * Approval runs the story rules (naming.ts); a refusal comes back as 422 with
 * the issues, and nothing is written.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (q !== null) {
    return NextResponse.json({ verses: searchVerses(q, 40) }, { headers: { "Cache-Control": "no-store" } });
  }
  const [chapters, cards, world] = await Promise.all([listChapters(), listCards(), listWorld()]);
  return NextResponse.json({ chapters, cards, world, shape }, { headers: { "Cache-Control": "no-store" } });
}

const SLUG = /^[a-z0-9-]{1,40}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  try {
    switch (action) {
      case "chapter.update": {
        const slug = String(body?.slug ?? "");
        const chapter = await updateChapter(slug, (body?.patch ?? {}) as ChapterPatch);
        if (!chapter) return NextResponse.json({ error: "No such chapter." }, { status: 404 });
        return NextResponse.json({ chapter });
      }
      case "lyrics.save": {
        const chapter = await getChapter(String(body?.slug ?? ""));
        if (!chapter) return NextResponse.json({ error: "No such chapter." }, { status: 404 });
        const text = String(body?.text ?? "").trim();
        await executeQuery(`UPDATE tracks SET lyrics = ?1 WHERE id = ?2`, [text || null, chapter.trackId]);
        return NextResponse.json({ ok: true });
      }
      case "card.create": {
        const chapter = String(body?.chapter ?? "");
        if (!(await getChapter(chapter))) return NextResponse.json({ error: "No such chapter." }, { status: 404 });
        const verseRef = String(body?.verseRef ?? "").trim();
        const verseText = String(body?.verseText ?? "").trim();
        if (!verseRef || !verseText) return NextResponse.json({ error: "A card needs a verse." }, { status: 400 });
        const card = await createCard({ chapter, verseRef, verseText, flip: body?.flip ? String(body.flip) : null });
        return NextResponse.json({ card });
      }
      case "card.update": {
        const card = await updateCard(String(body?.id ?? ""), (body?.patch ?? {}) as CardPatch);
        if (!card) return NextResponse.json({ error: "No such card." }, { status: 404 });
        return NextResponse.json({ card });
      }
      case "card.delete": {
        await deleteCard(String(body?.id ?? ""));
        return NextResponse.json({ ok: true });
      }
      case "world.create": {
        const slug = String(body?.slug ?? "").trim().toLowerCase();
        const name = String(body?.name ?? "").trim();
        const line = String(body?.line ?? "").trim();
        if (!SLUG.test(slug) || !name || !line) {
          return NextResponse.json({ error: "An entry needs a name and a line." }, { status: 400 });
        }
        await createWorld({
          slug,
          name,
          line,
          revealedWith: body?.revealedWith ? String(body.revealedWith) : null,
          sort: Number(body?.sort ?? 0) || 0,
        });
        return NextResponse.json({ world: await listWorld() });
      }
      case "world.update": {
        const entry = await updateWorld(String(body?.slug ?? ""), (body?.patch ?? {}) as WorldPatch);
        if (!entry) return NextResponse.json({ error: "No such entry." }, { status: 404 });
        return NextResponse.json({ entry });
      }
      case "world.delete": {
        await deleteWorld(String(body?.slug ?? ""));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof StoryRuleError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: 422 });
    }
    console.error("[loop:film:admin]", err);
    return NextResponse.json({ error: "Something went wrong saving that." }, { status: 500 });
  }
}

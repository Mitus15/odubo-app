"""
Build data/bible-kjv.json: the whole King James Version, cleaned, in the shape
src/lib/bible-verse.ts already reads ([{abbrev, name, chapters: [[verse]]}]).

Source: github.com/thiagobodruk/bible, json/en_kjv.json, the same source as
data/bible-psalms-proverbs.json. The KJV text is public domain. That file names
the books in Portuguese, so the English names are set here, in canonical order.

    curl -sSL -o /tmp/en_kjv.json https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json
    python3 scripts/loop/film/build_kjv.py /tmp/en_kjv.json

Braces in the source mean two different things, and only one of them goes:
  {is}                   a word the translators supplied (printed in italics):
                         the word stays, the braces go.
  {ungodly: or, wicked}  a margin note: the whole span goes. Every note has a
                         colon ("or,", "Heb."), and no supplied word does.
"""
import json, re, sys
from pathlib import Path

BOOKS = [
    ("gen", "Genesis"), ("exod", "Exodus"), ("lev", "Leviticus"), ("num", "Numbers"), ("deut", "Deuteronomy"),
    ("josh", "Joshua"), ("judg", "Judges"), ("ruth", "Ruth"), ("1sam", "1 Samuel"), ("2sam", "2 Samuel"),
    ("1kgs", "1 Kings"), ("2kgs", "2 Kings"), ("1chr", "1 Chronicles"), ("2chr", "2 Chronicles"), ("ezra", "Ezra"),
    ("neh", "Nehemiah"), ("esth", "Esther"), ("job", "Job"), ("ps", "Psalms"), ("prov", "Proverbs"),
    ("eccl", "Ecclesiastes"), ("song", "Song of Solomon"), ("isa", "Isaiah"), ("jer", "Jeremiah"),
    ("lam", "Lamentations"), ("ezek", "Ezekiel"), ("dan", "Daniel"), ("hos", "Hosea"), ("joel", "Joel"),
    ("amos", "Amos"), ("obad", "Obadiah"), ("jonah", "Jonah"), ("mic", "Micah"), ("nah", "Nahum"),
    ("hab", "Habakkuk"), ("zeph", "Zephaniah"), ("hag", "Haggai"), ("zech", "Zechariah"), ("mal", "Malachi"),
    ("matt", "Matthew"), ("mark", "Mark"), ("luke", "Luke"), ("john", "John"), ("acts", "Acts"),
    ("rom", "Romans"), ("1cor", "1 Corinthians"), ("2cor", "2 Corinthians"), ("gal", "Galatians"),
    ("eph", "Ephesians"), ("phil", "Philippians"), ("col", "Colossians"), ("1thess", "1 Thessalonians"),
    ("2thess", "2 Thessalonians"), ("1tim", "1 Timothy"), ("2tim", "2 Timothy"), ("titus", "Titus"),
    ("phlm", "Philemon"), ("heb", "Hebrews"), ("jas", "James"), ("1pet", "1 Peter"), ("2pet", "2 Peter"),
    ("1john", "1 John"), ("2john", "2 John"), ("3john", "3 John"), ("jude", "Jude"), ("rev", "Revelation"),
]

NOTE = re.compile(r"\s*\{[^}]*:[^}]*\}")


def clean(verse: str) -> str:
    v = NOTE.sub("", verse)
    v = v.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", v).strip()


def main(src: str) -> None:
    data = json.load(open(src, encoding="utf-8-sig"))
    if len(data) != 66:
        raise SystemExit(f"expected 66 books, found {len(data)}")
    out = []
    for (abbrev, name), book in zip(BOOKS, data):
        out.append({"abbrev": abbrev, "name": name,
                    "chapters": [[clean(v) for v in ch] for ch in book["chapters"]]})
    verses = sum(len(ch) for b in out for ch in b["chapters"])
    if verses != 31102:
        raise SystemExit(f"expected 31102 verses, found {verses}")
    dest = Path(__file__).resolve().parents[3] / "data" / "bible-kjv.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {dest} · {verses} verses · {dest.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1])

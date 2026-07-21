/**
 * Server-side Bible verse picker.
 * Reads from the downloaded KJV Bible JSON file (data/bible-psalms-proverbs.json).
 * No AI, no API calls at runtime — just a local file lookup.
 * 
 * The JSON file contains the full books of Psalms (150 chapters) and Proverbs (31 chapters)
 * from the King James Version, sourced from github.com/thiagobodruk/bible.
 * 
 * Structure: [{ name: "Psalms", chapters: [["verse1", "verse2", ...], ...] }]
 * Chapters and verses are 0-indexed arrays.
 */

import fs from 'fs';
import path from 'path';

interface BibleBook {
  name: string;
  chapters: string[][];
}

export interface BibleVerse {
  text: string;
  reference: string;
  error: string | null;
}

let bibleData: BibleBook[] | null = null;

/**
 * Load the Bible data from the JSON file.
 * Cached in memory after first load.
 */
function loadBible(): BibleBook[] {
  if (bibleData) return bibleData;
  
  const filePath = path.join(process.cwd(), 'data', 'bible-psalms-proverbs.json');
  
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    bibleData = JSON.parse(raw) as BibleBook[];
    return bibleData;
  } catch (error) {
    console.error('Failed to load Bible data:', error);
    return [];
  }
}

/**
 * Get a specific verse by book, chapter, and verse number.
 * Chapters and verses are 1-based (human-friendly).
 */
export function getVerse(book: string, chapter: number, verse: number): BibleVerse | null {
  const bible = loadBible();
  const bookData = bible.find(b => b.name.toLowerCase() === book.toLowerCase());
  
  if (!bookData) return null;
  
  const chapterIndex = chapter - 1;
  const verseIndex = verse - 1;
  
  if (chapterIndex < 0 || chapterIndex >= bookData.chapters.length) return null;
  if (verseIndex < 0 || verseIndex >= bookData.chapters[chapterIndex].length) return null;
  
  const text = bookData.chapters[chapterIndex][verseIndex];
  return {
    text: text.replace(/\{|\}/g, ''), // Remove KJV formatting braces
    reference: `${bookData.name} ${chapter}:${verse}`,
    error: null
  };
}

/**
 * Get today's verse from Psalms or Proverbs.
 * Uses the day of year to deterministically pick a verse.
 * Same verse all day, different verse each day.
 */
export function getDailyVerse(): BibleVerse {
  try {
    const bible = loadBible();
    
    if (bible.length === 0) {
      return getFallbackVerse();
    }

    // Flatten all verses into a single array with references
    const allVerses: { text: string; reference: string }[] = [];
    
    for (const book of bible) {
      for (let ch = 0; ch < book.chapters.length; ch++) {
        for (let v = 0; v < book.chapters[ch].length; v++) {
          allVerses.push({
            text: book.chapters[ch][v].replace(/\{|\}/g, ''),
            reference: `${book.name} ${ch + 1}:${v + 1}`
          });
        }
      }
    }

    // Deterministic pick based on day of year
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    const index = dayOfYear % allVerses.length;
    return {
      text: allVerses[index].text,
      reference: allVerses[index].reference,
      error: null
    };
  } catch (error) {
    console.error('getDailyVerse error:', error);
    return getFallbackVerse();
  }
}

/**
 * Emergency fallback — a few hardcoded verses in case the file can't be read.
 */
function getFallbackVerse(): BibleVerse {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  const fallbacks = [
    { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
    { text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
    { text: "Thy word is a lamp unto my feet, and a light unto my path.", reference: "Psalm 119:105" },
    { text: "The fear of the Lord is the beginning of knowledge: but fools despise wisdom and instruction.", reference: "Proverbs 1:7" },
    { text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding.", reference: "Proverbs 3:5" },
    { text: "In all thy ways acknowledge him, and he shall direct thy paths.", reference: "Proverbs 3:6" },
    { text: "Keep thy heart with all diligence; for out of it are the issues of life.", reference: "Proverbs 4:23" },
    { text: "The name of the Lord is a strong tower: the righteous runneth into it, and is safe.", reference: "Proverbs 18:10" },
    { text: "A friend loveth at all times, and a brother is born for adversity.", reference: "Proverbs 17:17" },
    { text: "Pride goeth before destruction, and an haughty spirit before a fall.", reference: "Proverbs 16:18" },
  ];
  
  return {
    text: fallbacks[dayOfYear % fallbacks.length].text,
    reference: fallbacks[dayOfYear % fallbacks.length].reference,
    error: null
  };
}

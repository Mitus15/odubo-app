import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'nodejs';

interface TrainingExample {
  content: string;
  platform: string | null;
  video_mood: string | null;
  video_category: string | null;
  is_clip: number;
}

interface Insight {
  type: string;
  key: string;
  value: string;
  confidence: number;
  sampleCount: number;
}

/**
 * POST /api/admin/woda/analyze
 * Analyzes training examples and extracts patterns/insights
 */
export async function POST(_request: NextRequest) {
  try {
    // 1. Fetch all "perfect" and "good" training examples
    const examples = (await queryDatabase(
      `SELECT content, platform, video_mood, video_category, is_clip
       FROM ai_training_examples
       WHERE rating IN ('perfect', 'good')
       ORDER BY created_at DESC LIMIT 100`,
      []
    )) as TrainingExample[];

    if (!examples || examples.length < 3) {
      return NextResponse.json({
        message: 'Not enough training examples to analyze',
        analyzed: examples?.length || 0,
        insights: 0,
      });
    }

    // 2. Extract patterns
    const insights = analyzePatterns(examples);

    // 3. Upsert insights
    let upsertedCount = 0;
    for (const insight of insights) {
      try {
        await executeQuery(
          `INSERT INTO woda_insights (profile_id, insight_type, insight_key, insight_value, confidence, sample_count)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(insight_key) DO UPDATE SET
             insight_value = excluded.insight_value,
             confidence = excluded.confidence,
             sample_count = excluded.sample_count,
             updated_at = datetime('now')`,
          [1, insight.type, insight.key, insight.value, insight.confidence, insight.sampleCount]
        );
        upsertedCount++;
      } catch (e) {
        console.error(`[Woda] Failed to upsert insight ${insight.key}:`, e);
      }
    }

    return NextResponse.json({
      message: `Analyzed ${examples.length} examples, extracted ${upsertedCount} insights`,
      analyzed: examples.length,
      insights: upsertedCount,
      patterns: insights.map((i) => ({ key: i.key, confidence: i.confidence })),
    });
  } catch (error) {
    console.error('[Woda] Analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

function analyzePatterns(examples: TrainingExample[]): Insight[] {
  const insights: Insight[] = [];
  const contents = examples.map((e) => e.content).filter(Boolean);

  if (contents.length === 0) return insights;

  // 1. Average caption length
  const lengths = contents.map((c) => c.length);
  const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);

  insights.push({
    type: 'length_pref',
    key: 'avg_caption_length',
    value: JSON.stringify({ avg: avgLength, min: minLength, max: maxLength }),
    confidence: contents.length > 10 ? 0.8 : 0.5,
    sampleCount: contents.length,
  });

  // 2. Lowercase preference
  const lowercaseCount = contents.filter((c) => c === c.toLowerCase()).length;
  const lowercaseRatio = lowercaseCount / contents.length;

  insights.push({
    type: 'structure',
    key: 'lowercase_preference',
    value: JSON.stringify({ ratio: lowercaseRatio, prefers: lowercaseRatio > 0.6 }),
    confidence: lowercaseRatio > 0.8 || lowercaseRatio < 0.2 ? 0.9 : 0.6,
    sampleCount: contents.length,
  });

  // 3. Common openers (first 3 words)
  const openers = extractCommonOpeners(contents);
  if (openers.length > 0) {
    insights.push({
      type: 'phrase',
      key: 'common_openers',
      value: JSON.stringify(openers),
      confidence: 0.7,
      sampleCount: contents.length,
    });
  }

  // 4. Hashtag patterns
  const hashtagStats = analyzeHashtags(contents);
  insights.push({
    type: 'hashtag_pattern',
    key: 'hashtag_style',
    value: JSON.stringify(hashtagStats),
    confidence: 0.75,
    sampleCount: contents.length,
  });

  // 5. Emoji usage
  const emojiStats = analyzeEmojis(contents);
  insights.push({
    type: 'emoji_usage',
    key: 'emoji_patterns',
    value: JSON.stringify(emojiStats),
    confidence: 0.7,
    sampleCount: contents.length,
  });

  // 6. Line break patterns
  const lineBreakStats = analyzeLineBreaks(contents);
  insights.push({
    type: 'structure',
    key: 'line_break_style',
    value: JSON.stringify(lineBreakStats),
    confidence: 0.65,
    sampleCount: contents.length,
  });

  return insights;
}

function extractCommonOpeners(contents: string[]): string[] {
  const openerCounts: Record<string, number> = {};

  for (const content of contents) {
    // Get first 3 words
    const words = content.split(/\s+/).slice(0, 3);
    if (words.length >= 2) {
      const opener = words.join(' ').toLowerCase();
      openerCounts[opener] = (openerCounts[opener] || 0) + 1;
    }
  }

  // Return openers that appear more than once, sorted by frequency
  return Object.entries(openerCounts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([opener]) => opener);
}

function analyzeHashtags(contents: string[]): {
  avgCount: number;
  usesHashtags: boolean;
  commonTags: string[];
} {
  const hashtagCounts: number[] = [];
  const allTags: Record<string, number> = {};

  for (const content of contents) {
    const tags = content.match(/#\w+/g) || [];
    hashtagCounts.push(tags.length);

    for (const tag of tags) {
      const normalized = tag.toLowerCase();
      allTags[normalized] = (allTags[normalized] || 0) + 1;
    }
  }

  const avgCount =
    hashtagCounts.length > 0
      ? Math.round(hashtagCounts.reduce((a, b) => a + b, 0) / hashtagCounts.length)
      : 0;

  const usesHashtags = avgCount > 0;

  const commonTags = Object.entries(allTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  return { avgCount, usesHashtags, commonTags };
}

function analyzeEmojis(contents: string[]): {
  avgCount: number;
  usesEmojis: boolean;
  commonEmojis: string[];
} {
  // Emoji regex pattern
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  const emojiCounts: number[] = [];
  const allEmojis: Record<string, number> = {};

  for (const content of contents) {
    const emojis = content.match(emojiRegex) || [];
    emojiCounts.push(emojis.length);

    for (const emoji of emojis) {
      allEmojis[emoji] = (allEmojis[emoji] || 0) + 1;
    }
  }

  const avgCount =
    emojiCounts.length > 0
      ? Math.round((emojiCounts.reduce((a, b) => a + b, 0) / emojiCounts.length) * 10) / 10
      : 0;

  const usesEmojis = avgCount > 0;

  const commonEmojis = Object.entries(allEmojis)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emoji]) => emoji);

  return { avgCount, usesEmojis, commonEmojis };
}

function analyzeLineBreaks(contents: string[]): {
  avgLineBreaks: number;
  usesDoubleBreaks: boolean;
} {
  const breakCounts: number[] = [];
  let doubleBreakCount = 0;

  for (const content of contents) {
    const breaks = (content.match(/\n/g) || []).length;
    breakCounts.push(breaks);

    if (content.includes('\n\n')) {
      doubleBreakCount++;
    }
  }

  const avgLineBreaks =
    breakCounts.length > 0
      ? Math.round(breakCounts.reduce((a, b) => a + b, 0) / breakCounts.length)
      : 0;

  const usesDoubleBreaks = doubleBreakCount / contents.length > 0.3;

  return { avgLineBreaks, usesDoubleBreaks };
}

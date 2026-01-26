import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { callGeminiWithRetry } from '@/lib/gemini';

export const runtime = 'nodejs';

interface WodaRequest {
  videoId: number;
  platforms: string[];
  contentType: 'clip' | 'video';
}

/**
 * POST /api/arsenal/woda
 * Woda AI generates brand-appropriate deploy metadata
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WodaRequest;
    const { videoId, platforms, contentType } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    // 1. Get video metadata with parent info
    const videos = (await queryDatabase(
      `SELECT id, title, description, category, mood, type, artist_name,
              social_description, social_hashtags, parent_video_id
       FROM videos WHERE id = ?`,
      [videoId]
    )) as Array<Record<string, unknown>>;

    const video = videos?.[0];
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // 2. Get active voice profile
    const profiles = (await queryDatabase(
      `SELECT * FROM ai_voice_profiles WHERE is_active = 1 LIMIT 1`,
      []
    )) as Array<Record<string, unknown>>;
    const profile = profiles?.[0];

    // 3. Get training examples
    const examples = (await queryDatabase(
      `SELECT content, rating, platform FROM ai_training_examples
       WHERE profile_id = ? AND rating IN ('perfect', 'avoid')
       ORDER BY rating ASC LIMIT 10`,
      [profile?.id || 1]
    )) as Array<{ content: string; rating: string; platform: string | null }>;

    // 4. Get learned insights (from passive learning)
    const insights = (await queryDatabase(
      `SELECT insight_type, insight_key, insight_value FROM woda_insights
       WHERE profile_id = ? AND confidence > 0.5
       ORDER BY sample_count DESC LIMIT 15`,
      [profile?.id || 1]
    )) as Array<{ insight_type: string; insight_key: string; insight_value: string }> | null;

    // 5. Get family context for clips (parent + siblings)
    let familyContext = '';
    if (contentType === 'clip' && video.parent_video_id) {
      try {
        // Get parent video context
        const parents = (await queryDatabase(
          `SELECT v.title, v.description, v.social_description,
                  wc.mood, wc.category, wc.type
           FROM videos v
           LEFT JOIN woda_video_context wc ON wc.video_id = v.id
           WHERE v.id = ?`,
          [video.parent_video_id]
        )) as Array<Record<string, unknown>>;

        // Get sibling clips' captions
        const siblings = (await queryDatabase(
          `SELECT v.title, v.social_description
           FROM videos v
           WHERE v.parent_video_id = ? AND v.id != ? AND v.social_description IS NOT NULL
           LIMIT 5`,
          [video.parent_video_id, videoId]
        )) as Array<Record<string, unknown>>;

        familyContext = buildFamilyContext(parents?.[0], siblings || []);
      } catch (e) {
        console.warn('[Woda] Failed to get family context:', e);
      }
    }

    // 6. Build Woda prompt with all context
    const prompt = buildWodaPrompt(
      video,
      profile,
      examples || [],
      contentType,
      platforms || [],
      insights || [],
      familyContext
    );

    // 5. Call Gemini
    const { data } = await callGeminiWithRetry(prompt);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const result = parseWodaResponse(text);

    // 6. Store generation for feedback tracking
    let generationId: number | null = null;
    try {
      const insertResult = await executeQuery(
        `INSERT INTO ai_generation_feedback (profile_id, generated_text, platform)
         VALUES (?, ?, ?)`,
        [profile?.id || 1, JSON.stringify(result), (platforms || []).join(',')]
      );
      generationId = (insertResult as { lastRowId?: number })?.lastRowId || null;
    } catch (e) {
      console.error('[Woda] Failed to store generation:', e);
    }

    return NextResponse.json({
      ...result,
      generationId,
    });
  } catch (error) {
    console.error('[Woda] Generation error:', error);
    return NextResponse.json(
      { error: 'Woda generation failed' },
      { status: 500 }
    );
  }
}

function buildFamilyContext(
  parent: Record<string, unknown> | undefined,
  siblings: Array<Record<string, unknown>>
): string {
  if (!parent && siblings.length === 0) return '';

  let context = '';

  if (parent) {
    context += 'PARENT VIDEO:\n';
    if (parent.title) context += `  Title: "${parent.title}"\n`;
    if (parent.social_description || parent.description) {
      context += `  Caption: "${parent.social_description || parent.description}"\n`;
    }
    if (parent.mood) context += `  Mood: ${parent.mood}\n`;
    if (parent.category) context += `  Category: ${parent.category}\n`;
  }

  if (siblings.length > 0) {
    context += '\nSIBLING CLIPS (other clips from same source):\n';
    siblings.slice(0, 3).forEach((sib, i) => {
      if (sib.social_description) {
        context += `  ${i + 1}. "${sib.social_description}"\n`;
      }
    });
  }

  return context;
}

function buildInsightsSection(
  insights: Array<{ insight_type: string; insight_key: string; insight_value: string }>
): string {
  if (!insights || insights.length === 0) return '';

  let section = '\nLEARNED PATTERNS FROM YOUR PAST CAPTIONS:\n';

  for (const insight of insights) {
    try {
      const value = JSON.parse(insight.insight_value);
      switch (insight.insight_key) {
        case 'avg_caption_length':
          section += `- Keep captions around ${Math.round(value.avg || 100)} characters\n`;
          break;
        case 'lowercase_preference':
          if (value.prefers) section += `- Use lowercase aesthetic\n`;
          break;
        case 'common_openers':
          if (Array.isArray(value) && value.length > 0) {
            section += `- You often start with: ${value.slice(0, 3).join(', ')}\n`;
          }
          break;
        case 'hashtag_style':
          if (value.avgCount) section += `- Use around ${Math.round(value.avgCount)} hashtags\n`;
          break;
        case 'emoji_patterns':
          if (value.avgCount !== undefined) {
            section += `- Use ${value.avgCount === 0 ? 'no' : `around ${Math.round(value.avgCount)}`} emojis\n`;
          }
          break;
      }
    } catch {
      // Skip malformed insights
    }
  }

  return section;
}

function buildWodaPrompt(
  video: Record<string, unknown>,
  profile: Record<string, unknown> | undefined,
  examples: Array<{ content: string; rating: string; platform: string | null }>,
  contentType: string,
  platforms: string[],
  insights: Array<{ insight_type: string; insight_key: string; insight_value: string }>,
  familyContext: string
): string {
  const isClip = contentType === 'clip';

  // Voice settings
  const voiceInstructions: string[] = [];
  if (profile?.tone_description) {
    voiceInstructions.push(`VOICE: ${profile.tone_description}`);
  }
  if (profile?.custom_instructions) {
    voiceInstructions.push(`INSTRUCTIONS: ${profile.custom_instructions}`);
  }

  // Banned words
  let banned: string[] = [];
  try {
    banned = JSON.parse((profile?.banned_words as string) || '[]');
  } catch {
    // ignore parse errors
  }
  if (banned.length > 0) {
    voiceInstructions.push(`NEVER USE: ${banned.join(', ')}`);
  }

  // Platform styles
  if (isClip && profile?.tiktok_style) {
    voiceInstructions.push(`TIKTOK/SHORTS/REELS STYLE: ${profile.tiktok_style}`);
  }
  if (!isClip && profile?.youtube_style) {
    voiceInstructions.push(`YOUTUBE STYLE: ${profile.youtube_style}`);
  }

  // Limits
  voiceInstructions.push(`MAX EMOJIS: ${profile?.max_emojis || 1}`);
  voiceInstructions.push(`MAX HASHTAGS: ${profile?.max_hashtags || 7}`);
  if (profile?.prefer_lowercase) {
    voiceInstructions.push(`PREFER LOWERCASE`);
  }

  // Training examples
  const perfect = examples.filter((e) => e.rating === 'perfect');
  const avoid = examples.filter((e) => e.rating === 'avoid');

  let examplesText = '';
  if (perfect.length > 0) {
    examplesText += '\nPERFECT EXAMPLES (match this energy):\n';
    perfect.slice(0, 5).forEach((ex, i) => {
      examplesText += `${i + 1}. "${ex.content}"\n`;
    });
  }
  if (avoid.length > 0) {
    examplesText += '\nAVOID THESE (never write like this):\n';
    avoid.slice(0, 3).forEach((ex, i) => {
      examplesText += `${i + 1}. "${ex.content}"\n`;
    });
  }

  // Video context
  const videoContext = [
    video.title && `Current title: "${video.title}"`,
    video.description && `Description: "${video.description}"`,
    video.category && `Category: ${video.category}`,
    video.mood && `Mood: ${video.mood}`,
    video.type && `Type: ${video.type}`,
    video.artist_name && `Artist: ${video.artist_name}`,
  ]
    .filter(Boolean)
    .join('\n');

  const task = isClip
    ? `Generate social content for a SHORT-FORM clip (TikTok, Reels, YouTube Shorts).
       Focus on: punchy hook, minimal text, trending hashtags.`
    : `Generate social content for a LONG-FORM YouTube video.
       Focus on: clear title, SEO-friendly description, professional tone.`;

  // Build insights section from learned patterns
  const insightsSection = buildInsightsSection(insights);

  return `You are Woda, the AI companion for an artist brand.

${voiceInstructions.join('\n')}
${examplesText}
${insightsSection}
${familyContext ? `\nRELATED CONTENT CONTEXT:\n${familyContext}` : ''}

VIDEO CONTEXT:
${videoContext}

TASK: ${task}

TARGET PLATFORMS: ${platforms.join(', ')}

Respond with ONLY valid JSON:
{
  "title": "the title/hook",
  "description": "caption/description text",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "firstComment": "optional pinned comment with links/credits"
}`;
}

function parseWodaResponse(text: string): {
  title: string;
  description: string;
  hashtags: string[];
  firstComment: string;
} {
  try {
    let cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/g, '');
    return JSON.parse(cleaned);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // ignore
      }
    }
  }
  return { title: '', description: '', hashtags: [], firstComment: '' };
}

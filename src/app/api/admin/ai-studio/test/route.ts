import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';
import { callDeepSeekWithRetry } from '@/lib/deepseek';

// POST: Test caption generation with current profile settings
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { profile_id, test_prompt, platform = 'instagram' } = body;

    // Get the profile (or active profile if not specified)
    let profile;
    if (profile_id) {
      const profiles = await queryDatabase(
        `SELECT * FROM ai_voice_profiles WHERE id = ?`,
        [profile_id]
      );
      profile = profiles?.[0];
    } else {
      const profiles = await queryDatabase(
        `SELECT * FROM ai_voice_profiles WHERE is_active = 1 LIMIT 1`,
        []
      );
      profile = profiles?.[0];
    }

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 });
    }

    // Get training examples for this profile
    const examples = await queryDatabase(
      `SELECT content, rating, platform FROM ai_training_examples
       WHERE profile_id = ? AND (platform = ? OR platform IS NULL)
       ORDER BY rating ASC, created_at DESC
       LIMIT 10`,
      [profile.id, platform]
    );

    // Build the prompt with profile settings
    const prompt = buildTestPrompt(profile, examples || [], test_prompt, platform);

    // Call DeepSeek
    const { data } = await callDeepSeekWithRetry(prompt);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the response
    const result = parseTestResponse(text);

    // Store feedback for learning (optional - user can rate later)
    // We'll create a feedback entry with null rating initially

    return NextResponse.json({
      success: true,
      captions: result.captions,
      hashtags: result.hashtags,
      raw_response: text,
      profile_used: profile.name,
    });
  } catch (e: any) {
    console.error('Error testing AI generation:', e);
    return NextResponse.json(
      { error: String(e?.message || 'AI generation failed') },
      { status: 500 }
    );
  }
}

function buildTestPrompt(
  profile: any,
  examples: any[],
  testPrompt: string,
  platform: string
): string {
  // Build voice instructions from profile
  const voiceInstructions: string[] = [];

  if (profile.tone_description) {
    voiceInstructions.push(`VOICE & TONE: ${profile.tone_description}`);
  }

  if (profile.custom_instructions) {
    voiceInstructions.push(`CUSTOM INSTRUCTIONS: ${profile.custom_instructions}`);
  }

  // Parse banned words
  let bannedWords: string[] = [];
  try {
    if (profile.banned_words) {
      bannedWords = JSON.parse(profile.banned_words);
    }
  } catch {}
  if (bannedWords.length > 0) {
    voiceInstructions.push(`NEVER USE THESE WORDS: ${bannedWords.join(', ')}`);
  }

  // Parse required patterns
  let requiredPatterns: string[] = [];
  try {
    if (profile.required_patterns) {
      requiredPatterns = JSON.parse(profile.required_patterns);
    }
  } catch {}
  if (requiredPatterns.length > 0) {
    voiceInstructions.push(`PATTERNS TO USE: ${requiredPatterns.join(', ')}`);
  }

  // Platform-specific style
  const platformStyle = platform === 'instagram' ? profile.instagram_style :
                        platform === 'tiktok' ? profile.tiktok_style :
                        platform === 'youtube' ? profile.youtube_style : null;
  if (platformStyle) {
    voiceInstructions.push(`${platform.toUpperCase()} STYLE: ${platformStyle}`);
  }

  // Limits
  voiceInstructions.push(`MAX EMOJIS: ${profile.max_emojis || 1}`);
  voiceInstructions.push(`MAX HASHTAGS: ${profile.max_hashtags || 7}`);
  if (profile.prefer_lowercase) {
    voiceInstructions.push(`PREFER LOWERCASE AESTHETIC`);
  }

  // Build examples section
  const perfectExamples = examples.filter(e => e.rating === 'perfect');
  const avoidExamples = examples.filter(e => e.rating === 'avoid');

  let examplesSection = '';
  if (perfectExamples.length > 0) {
    examplesSection += `\n\nEXAMPLES OF PERFECT CAPTIONS (match this style):\n`;
    perfectExamples.slice(0, 5).forEach((ex, i) => {
      examplesSection += `${i + 1}. "${ex.content}"\n`;
    });
  }
  if (avoidExamples.length > 0) {
    examplesSection += `\n\nEXAMPLES TO AVOID (never write like this):\n`;
    avoidExamples.slice(0, 3).forEach((ex, i) => {
      examplesSection += `${i + 1}. "${ex.content}"\n`;
    });
  }

  return `You are an AI caption writer for a musician/artist brand.

${voiceInstructions.join('\n')}
${examplesSection}

TASK: Generate 3 caption options for ${platform}.

CONTENT TO WRITE ABOUT: ${testPrompt || 'a new music release'}

Respond with ONLY valid JSON:
{
  "captions": ["caption1", "caption2", "caption3"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;
}

function parseTestResponse(text: string): { captions: string[], hashtags: string[] } {
  try {
    // Clean up the response
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '');

    const parsed = JSON.parse(cleaned);
    return {
      captions: parsed.captions || [],
      hashtags: parsed.hashtags || [],
    };
  } catch {
    // Try to extract JSON from the text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return {
          captions: parsed.captions || [],
          hashtags: parsed.hashtags || [],
        };
      } catch {}
    }
  }
  return { captions: [], hashtags: [] };
}

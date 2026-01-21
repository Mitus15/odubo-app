import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { callGeminiWithRetry } from '@/lib/gemini';

export const runtime = 'edge';

type VoiceProfile = {
  id?: number;
  tone_description?: string | null;
  custom_instructions?: string | null;
  banned_words?: string | null;
  required_patterns?: string | null;
  max_hashtags?: number | null;
};

type TrainingExample = {
  content: string;
  rating?: string | null;
  platform?: string | null;
};

function parseJsonFromText(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON in AI response');
  }
  const jsonText = text.slice(start, end + 1);
  return JSON.parse(jsonText);
}

function buildVoiceInstructions(profile: VoiceProfile | null, examples: TrainingExample[]) {
  const instructions: string[] = [];

  if (profile?.tone_description) {
    instructions.push(`Tone: ${profile.tone_description}`);
  }
  if (profile?.custom_instructions) {
    instructions.push(`Custom Instructions: ${profile.custom_instructions}`);
  }
  if (profile?.banned_words) {
    try {
      const banned = JSON.parse(profile.banned_words);
      if (banned.length) instructions.push(`Avoid: ${banned.join(', ')}`);
    } catch {}
  }
  if (profile?.required_patterns) {
    try {
      const required = JSON.parse(profile.required_patterns);
      if (required.length) instructions.push(`Include patterns: ${required.join(', ')}`);
    } catch {}
  }

  if (examples?.length) {
    const good = examples.filter((ex) => ex.rating !== 'avoid').slice(0, 4);
    const avoid = examples.filter((ex) => ex.rating === 'avoid').slice(0, 2);

    if (good.length) {
      instructions.push(`Good examples: ${good.map((ex) => ex.content).join(' | ')}`);
    }
    if (avoid.length) {
      instructions.push(`Avoid examples: ${avoid.map((ex) => ex.content).join(' | ')}`);
    }
  }

  return instructions.length ? instructions.join('\n') : 'Keep captions concise and on-brand.';
}

function buildPrompt({
  title,
  caption,
  platforms,
  profile,
  examples,
}: {
  title?: string;
  caption?: string;
  platforms: string[];
  profile?: VoiceProfile | null;
  examples?: TrainingExample[];
}) {
  const voiceInstructions = buildVoiceInstructions(profile, examples || []);
  const maxHashtags = profile?.max_hashtags || 7;

  return `You are a social media assistant for an artist brand called "Odubo".

${voiceInstructions}

Draft title: ${title || 'Untitled'}
Existing caption (if any): ${caption || 'None'}

Generate 3 caption options per platform and ${maxHashtags} hashtags per platform.
Platforms: ${platforms.join(', ')}

Respond with ONLY valid JSON:
{
  "captions": {
    ${platforms.map((p) => `"${p}": ["caption1", "caption2", "caption3"]`).join(',\n    ')}
  },
  "hashtags": {
    ${platforms.map((p) => `"${p}": ["#tag1", "#tag2"]`).join(',\n    ')}
  }
}`;
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const platforms = Array.isArray(body.platforms) ? body.platforms as string[] : [];

    if (!platforms.length) {
      return NextResponse.json({ error: 'platforms required' }, { status: 400 });
    }

    // Check for active voice profile
    const profiles = await queryDatabase(
      `SELECT * FROM ai_voice_profiles WHERE is_active = 1 LIMIT 1`,
      []
    );
    const voiceProfile = (profiles?.[0] as VoiceProfile | undefined) || null;

    if (!voiceProfile) {
      console.warn('[AI Suggest] No active voice profile found - using defaults');
    }

    // Get training examples if profile exists
    let trainingExamples: TrainingExample[] = [];
    if (voiceProfile?.id) {
      trainingExamples = await queryDatabase(
        `SELECT content, rating, platform FROM ai_training_examples
         WHERE profile_id = ?
         ORDER BY created_at DESC
         LIMIT 12`,
        [voiceProfile.id]
      ) as TrainingExample[] || [];
    }

    // Build prompt
    const prompt = buildPrompt({
      title: body.title,
      caption: body.caption,
      platforms,
      profile: voiceProfile,
      examples: trainingExamples,
    });

    // Call Gemini API
    console.log('[AI Suggest] Calling Gemini API...');
    const result = await callGeminiWithRetry(prompt);
    
    if (!result?.data) {
      console.error('[AI Suggest] No data from Gemini:', result);
      throw new Error('No response from AI service');
    }

    const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.error('[AI Suggest] Empty response from Gemini');
      throw new Error('Empty AI response');
    }

    // Parse JSON from response
    const suggestions = parseJsonFromText(text) as {
      captions: Record<string, string[]>;
      hashtags: Record<string, string[]>;
    };

    console.log('[AI Suggest] Success - generated suggestions for:', platforms.join(', '));

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Suggest] Error:', errorMsg, error);
    
    // Return more detailed error for debugging
    return NextResponse.json(
      { 
        error: 'Failed to generate AI suggestions', 
        details: errorMsg,
        hint: 'Check if Gemini API key is configured and voice profile exists'
      },
      { status: 500 }
    );
  }
}

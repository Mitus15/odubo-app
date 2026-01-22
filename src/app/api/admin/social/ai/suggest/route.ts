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
  let jsonText = text.slice(start, end + 1);
  
  // Clean up common AI JSON mistakes
  // Remove trailing commas before ] or }
  jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
  // Remove markdown code blocks
  jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('[AI Suggest] JSON parse error, raw text:', jsonText.substring(0, 500));
    throw new Error('Invalid JSON from AI response');
  }
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
  const voiceInstructions = buildVoiceInstructions(profile || null, examples || []);
  const maxHashtags = profile?.max_hashtags || 7;

  return `You are a social media assistant for an artist brand called "Odubo".

${voiceInstructions}

Draft title: ${title || 'Untitled'}
Existing caption (if any): ${caption || 'None'}

Generate 3 caption options per platform and ${maxHashtags} hashtags per platform.
Platforms: ${platforms.join(', ')}

IMPORTANT: Respond with ONLY valid JSON. No trailing commas, no comments, no markdown.
{
  "captions": {
    ${platforms.map((p) => `"${p}": ["caption1", "caption2", "caption3"]`).join(',\n    ')}
  },
  "hashtags": {
    ${platforms.map((p) => `"${p}": ["#tag1", "#tag2"]`).join(',\n    ')}
  }
}`;
}

// Generate fallback suggestions when AI is unavailable
function generateFallbackSuggestions(platforms: string[], title?: string) {
  const genericCaptions = [
    `${title || 'New content'} 🎨 Check it out!`,
    `Drop your thoughts below! 💭`,
    `What do you think? Let me know! ✨`,
  ];
  
  const genericHashtags = ['#art', '#creative', '#odubo', '#artist', '#newpost'];
  
  const suggestions: { captions: Record<string, string[]>; hashtags: Record<string, string[]> } = {
    captions: {},
    hashtags: {},
  };
  
  platforms.forEach((platform) => {
    suggestions.captions[platform] = genericCaptions;
    suggestions.hashtags[platform] = genericHashtags;
  });
  
  return suggestions;
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  let platforms: string[] = [];

  try {
    body = (await req.json()) as Record<string, unknown>;
    platforms = Array.isArray(body.platforms) ? body.platforms as string[] : [];

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
      console.warn('[AI Suggest] No active voice profile - using defaults');
      // Return friendly message with fallback
      return NextResponse.json({
        error: 'No AI voice profile configured',
        details: 'Create an AI voice profile in Settings → AI Voice to get personalized suggestions',
        hint: 'Using default generic suggestions',
        suggestions: generateFallbackSuggestions(platforms, body.title as string | undefined),
      });
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
      title: body.title as string | undefined,
      caption: body.caption as string | undefined,
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
    
    // Determine specific error type and provide helpful message
    let userMessage = 'Failed to generate AI suggestions';
    let hint = 'Try again or use manual captions';
    
    if (errorMsg.includes('API key') || errorMsg.includes('GEMINI')) {
      userMessage = 'AI service not configured';
      hint = 'Contact administrator to set up Gemini API key';
    } else if (errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
      userMessage = 'AI service quota exceeded';
      hint = 'Try again in a few moments';
    } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
      userMessage = 'AI service unavailable';
      hint = 'Check your internet connection and try again';
    }
    
    // Return error with fallback suggestions using already-parsed body
    const fallbackPlatforms = platforms.length > 0 ? platforms : ['instagram'];
    
    return NextResponse.json(
      { 
        error: userMessage, 
        details: errorMsg,
        hint,
        suggestions: generateFallbackSuggestions(fallbackPlatforms, body.title as string | undefined),
      },
      { status: 500 }
    );
  }
}

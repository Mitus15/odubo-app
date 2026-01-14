import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';
import { callGeminiWithRetry, callGeminiMultimodal, GeminiPart } from '@/lib/gemini';

interface AIAnalysisResult {
  content_type: string;
  suggested_type?: string; // If AI suggests a new category
  captions: {
    instagram: string[];
    tiktok: string[];
    youtube: string[];
  };
  hashtags: {
    instagram: string[];
    tiktok: string[];
    youtube: string[];
  };
  performance_score: number;
  optimal_times: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  };
  performance_factors: string[];
}

// POST: Analyze content with Gemini AI
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { content_id, analyze_type = 'full' } = body;

    if (!content_id) {
      return NextResponse.json({ error: 'content_id required' }, { status: 400 });
    }

    // Fetch the content
    const content = await queryDatabase(
      `SELECT
        sc.*,
        sf.name as folder_name
      FROM social_content sc
      LEFT JOIN social_folders sf ON sc.folder_id = sf.id
      WHERE sc.id = ?`,
      [content_id]
    );

    if (!content || content.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    const item = content[0];

    // Build context for AI
    const contextParts: string[] = [];
    if (item.title) contextParts.push(`Title: ${item.title}`);
    if (item.folder_name) contextParts.push(`Category/Folder: ${item.folder_name}`);
    if (item.duration) contextParts.push(`Duration: ${Math.round(item.duration)}s`);
    if (item.import_source) contextParts.push(`Source: ${item.import_source}`);

    // Build the appropriate prompt based on analyze_type
    let prompt: string;
    let analysis: AIAnalysisResult | Partial<AIAnalysisResult>;

    if (analyze_type === 'categorize') {
      prompt = buildCategorizationPrompt(contextParts);
      analysis = await runCategorizationAnalysis(prompt);
    } else if (analyze_type === 'caption') {
      prompt = buildCaptionPrompt(contextParts, item.title);
      analysis = await runCaptionAnalysis(prompt);
    } else {
      // Full analysis
      prompt = buildFullAnalysisPrompt(contextParts, item.title);
      analysis = await runFullAnalysis(prompt);
    }

    // Update the content record with AI analysis
    const updates: string[] = [];
    const params: any[] = [];

    if ('content_type' in analysis && analysis.content_type) {
      updates.push('content_type = ?');
      params.push(analysis.content_type);
    }

    if ('suggested_type' in analysis && analysis.suggested_type) {
      updates.push('ai_suggested_type = ?');
      params.push(analysis.suggested_type);
    }

    if ('performance_score' in analysis) {
      updates.push('ai_performance_score = ?');
      params.push(analysis.performance_score);
    }

    // Store the full analysis as JSON
    updates.push('ai_analysis = ?');
    params.push(JSON.stringify(analysis));

    // Generate a suggested caption (first Instagram caption)
    if ('captions' in analysis && analysis.captions?.instagram?.[0]) {
      updates.push('ai_suggested_caption = ?');
      params.push(analysis.captions.instagram[0]);
    }

    updates.push('ai_analyzed_at = CURRENT_TIMESTAMP');
    params.push(content_id);

    await queryDatabase(
      `UPDATE social_content SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated content
    const updated = await queryDatabase(
      `SELECT * FROM social_content WHERE id = ?`,
      [content_id]
    );

    return NextResponse.json({
      success: true,
      analysis,
      content: updated?.[0] || null,
    });
  } catch (e: any) {
    console.error('AI analysis error:', e);
    return NextResponse.json(
      { error: String(e?.message || 'AI analysis failed') },
      { status: 500 }
    );
  }
}

function buildCategorizationPrompt(context: string[]): string {
  return `You are analyzing social media content for a musician/artist brand.

Content Context:
${context.join('\n')}

Classify this content into ONE of these categories:
- promo: Promotional content for releases, merch, shows
- announcement: News, announcements, updates
- bts: Behind-the-scenes footage
- performance: Live performances, music videos, singing
- personal: Day-in-life, casual, personal moments
- collab: Collaborations with other artists
- teaser: Teasers, previews, coming soon content
- fan_content: Fan interactions, reposts, shoutouts
- tutorial: How-to, educational content
- other: If none fit, suggest a new category name

Respond with ONLY valid JSON:
{"content_type": "category_name", "suggested_type": "new_name_if_other", "confidence": 0.0-1.0}`;
}

function buildCaptionPrompt(context: string[], title: string): string {
  return `You are a social media expert for a musician/artist brand.

Content: ${title || 'Untitled'}
${context.join('\n')}

Generate engaging captions for each platform. Each caption should:
- Match the platform's style and character limits
- Instagram: Up to 2200 chars, can use emojis, storytelling
- TikTok: Short, punchy, trend-aware, use emojis
- YouTube Shorts: Descriptive, SEO-friendly

Also suggest relevant hashtags for each platform (10 each).

Respond with ONLY valid JSON:
{
  "captions": {
    "instagram": ["caption1", "caption2", "caption3"],
    "tiktok": ["caption1", "caption2", "caption3"],
    "youtube": ["caption1", "caption2", "caption3"]
  },
  "hashtags": {
    "instagram": ["#tag1", "#tag2", ...],
    "tiktok": ["#tag1", "#tag2", ...],
    "youtube": ["#tag1", "#tag2", ...]
  }
}`;
}

function buildFullAnalysisPrompt(context: string[], title: string): string {
  return `You are an AI assistant analyzing social media content for a musician/artist brand called "Odubo".

Content: ${title || 'Untitled'}
${context.join('\n')}

Perform a comprehensive analysis:

1. CONTENT TYPE - Classify as one of: promo, announcement, bts, performance, personal, collab, teaser, fan_content, tutorial. If none fit well, suggest a new category.

2. CAPTIONS - Generate 3 caption options for each platform:
   - Instagram: Storytelling, emojis allowed, up to 2200 chars
   - TikTok: Short, trendy, punchy
   - YouTube Shorts: Descriptive, SEO-optimized

3. HASHTAGS - 10 relevant hashtags per platform (mix of trending and niche)

4. PERFORMANCE SCORE - Rate 0-100 based on:
   - Visual appeal and quality
   - Hook potential (first 3 seconds)
   - Trend alignment
   - Engagement likelihood

5. OPTIMAL POSTING - Suggest best day/time for each platform

6. PERFORMANCE FACTORS - List 3-5 factors that will influence performance

Respond with ONLY valid JSON:
{
  "content_type": "category",
  "suggested_type": null,
  "captions": {
    "instagram": ["cap1", "cap2", "cap3"],
    "tiktok": ["cap1", "cap2", "cap3"],
    "youtube": ["cap1", "cap2", "cap3"]
  },
  "hashtags": {
    "instagram": ["#tag1", ...],
    "tiktok": ["#tag1", ...],
    "youtube": ["#tag1", ...]
  },
  "performance_score": 75,
  "optimal_times": {
    "instagram": "Tuesday 7pm EST",
    "tiktok": "Wednesday 6pm EST",
    "youtube": "Thursday 5pm EST"
  },
  "performance_factors": ["factor1", "factor2", ...]
}`;
}

async function runCategorizationAnalysis(prompt: string): Promise<Partial<AIAnalysisResult>> {
  const { data } = await callGeminiWithRetry(prompt);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAIResponse(text);
}

async function runCaptionAnalysis(prompt: string): Promise<Partial<AIAnalysisResult>> {
  const { data } = await callGeminiWithRetry(prompt);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAIResponse(text);
}

async function runFullAnalysis(prompt: string): Promise<AIAnalysisResult> {
  const { data } = await callGeminiWithRetry(prompt);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = parseAIResponse(text);

  // Ensure all required fields have defaults
  return {
    content_type: parsed.content_type || 'other',
    suggested_type: parsed.suggested_type,
    captions: parsed.captions || {
      instagram: [],
      tiktok: [],
      youtube: [],
    },
    hashtags: parsed.hashtags || {
      instagram: [],
      tiktok: [],
      youtube: [],
    },
    performance_score: parsed.performance_score || 50,
    optimal_times: parsed.optimal_times || {},
    performance_factors: parsed.performance_factors || [],
  };
}

function parseAIResponse(text: string): any {
  // Clean up the response
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '');

  // Try to parse as JSON
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        console.error('Failed to parse AI response JSON');
      }
    }
  }

  // Return empty object if parsing fails
  return {};
}

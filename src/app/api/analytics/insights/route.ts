import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeekWithRetry } from '@/lib/deepseek';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface InsightsRequest {
  period: string;
  metrics: {
    visitors: number;
    sessions: number;
    pageViews: number;
    clipViews: number;
    shopClicks: number;
    addToCarts: number;
    purchases: number;
    revenue: number;
    comparison?: {
      visitorsChange: number;
      sessionsChange: number;
      pageViewsChange: number;
    };
    topClips?: Array<{ title: string; views: number; shopClicks: number }>;
    topProducts?: Array<{ handle: string; views: number; purchases: number }>;
    trafficSources?: Array<{ source: string; sessions: number; percentage: number }>;
  };
}

/**
 * POST /api/analytics/insights
 * Generate AI-powered insights from analytics data using Gemini
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as InsightsRequest;
    const { period, metrics } = body;

    if (!metrics) {
      return NextResponse.json({ error: 'Metrics required' }, { status: 400 });
    }

    // Build prompt for Gemini
    const prompt = buildInsightsPrompt(period, metrics);

    // Call DeepSeek
    const result = await callDeepSeekWithRetry(prompt);
    const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No insights generated');
    }

    // Parse the response (expecting JSON with insights and recommendations)
    let parsed;
    try {
      // Clean the response if it has markdown code blocks
      let cleanText = text.trim();
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '');

      // Try to find JSON object
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: create structured response from text
        parsed = {
          insights: [cleanText.split('\n').filter(l => l.trim())[0] || 'No specific insights available'],
          recommendations: ['Continue monitoring your analytics for trends'],
        };
      }
    } catch (parseErr) {
      // If parsing fails, create a structured response from the raw text
      const lines = text.split('\n').filter(l => l.trim());
      parsed = {
        insights: lines.slice(0, Math.min(4, lines.length)),
        recommendations: lines.length > 4 ? lines.slice(4, 6) : ['Review your top-performing content'],
      };
    }

    return NextResponse.json({
      insights: parsed.insights || [],
      recommendations: parsed.recommendations || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Insights API error:', error);

    // Return fallback insights on error
    return NextResponse.json({
      insights: ['Unable to generate AI insights at this time'],
      recommendations: ['Check back later for personalized recommendations'],
      error: error?.message,
      generatedAt: new Date().toISOString(),
    });
  }
}

function buildInsightsPrompt(period: string, metrics: InsightsRequest['metrics']): string {
  const comparison = metrics.comparison;
  const topClips = metrics.topClips || [];
  const topProducts = metrics.topProducts || [];
  const trafficSources = metrics.trafficSources || [];

  return `You are an analytics expert for a multimedia artist platform. Analyze the following metrics and provide actionable insights.

## Period: ${period}

## Traffic Metrics
- Visitors: ${metrics.visitors.toLocaleString()}${comparison ? ` (${comparison.visitorsChange >= 0 ? '+' : ''}${comparison.visitorsChange.toFixed(1)}% vs previous period)` : ''}
- Sessions: ${metrics.sessions.toLocaleString()}${comparison ? ` (${comparison.sessionsChange >= 0 ? '+' : ''}${comparison.sessionsChange.toFixed(1)}% vs previous period)` : ''}
- Page Views: ${metrics.pageViews.toLocaleString()}

## Engagement Funnel
- Clip Views: ${metrics.clipViews.toLocaleString()}
- Shop Clicks: ${metrics.shopClicks.toLocaleString()} (${metrics.clipViews > 0 ? ((metrics.shopClicks / metrics.clipViews) * 100).toFixed(1) : 0}% conversion)
- Add to Carts: ${metrics.addToCarts.toLocaleString()}
- Purchases: ${metrics.purchases.toLocaleString()}
- Revenue: $${(metrics.revenue / 100).toFixed(2)}

${topClips.length > 0 ? `## Top Clips
${topClips.slice(0, 3).map((c, i) => `${i + 1}. "${c.title}" - ${c.views.toLocaleString()} views, ${c.shopClicks} shop clicks`).join('\n')}` : ''}

${topProducts.length > 0 ? `## Top Products
${topProducts.slice(0, 3).map((p, i) => `${i + 1}. ${p.handle} - ${p.views} views, ${p.purchases} purchases`).join('\n')}` : ''}

${trafficSources.length > 0 ? `## Traffic Sources
${trafficSources.slice(0, 5).map(s => `- ${s.source}: ${s.sessions} sessions (${s.percentage.toFixed(1)}%)`).join('\n')}` : ''}

Based on this data, provide:
1. 3-4 key insights about performance trends and notable patterns (be specific with numbers)
2. 2-3 actionable recommendations to improve engagement or conversions

CRITICAL: Respond ONLY with a valid JSON object in this exact format:
{
  "insights": [
    "First insight with specific numbers...",
    "Second insight about trends...",
    "Third insight about opportunities..."
  ],
  "recommendations": [
    "First actionable recommendation...",
    "Second recommendation..."
  ]
}`;
}

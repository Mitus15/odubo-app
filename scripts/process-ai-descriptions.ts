#!/usr/bin/env tsx
/**
 * Generate AI descriptions for parent videos (main videos only)
 * Uses Gemini API to create engaging descriptions
 * Runs as background process after sync
 */

import 'dotenv/config';
import { queryDatabase, executeQuery } from '../src/lib/db';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

interface Video {
  id: number;
  uid: string;
  title: string;
  duration: number;
  ai_description: string | null;
}

// Generate description using Gemini API
async function generateDescription(video: Video): Promise<string> {
  const prompt = `Generate a compelling, concise description (2-3 sentences) for this music video:

Title: "${video.title}"
Duration: ${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}

Write in a style that captures the essence and mood of the title. Be creative and engaging. Return only the description, no extra formatting.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 200,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!description) {
    throw new Error('No description generated');
  }

  return description;
}

// Process all parent videos
async function processAIDescriptions() {
  try {
    console.log('🤖 Starting AI description generation\n');
    console.log('================================================\n');

    // Fetch all parent videos (those without parent_video_id)
    const videos = await queryDatabase<Video>(
      `SELECT id, uid, title, duration, ai_description 
       FROM videos 
       WHERE parent_video_id IS NULL
       ORDER BY release_order ASC`
    );

    console.log(`📹 Found ${videos.length} parent videos\n`);

    let processed = 0;
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const video of videos) {
      // Skip if already has AI description
      if (video.ai_description) {
        console.log(`⏭️  Skipping "${video.title}" (already has description)`);
        skipped++;
        processed++;
        continue;
      }

      try {
        console.log(`🔮 Generating for: "${video.title}"`);
        
        const description = await generateDescription(video);
        
        await executeQuery(
          'UPDATE videos SET ai_description = ? WHERE id = ?',
          [description, video.id]
        );

        console.log(`   ✓ Generated: "${description.slice(0, 60)}..."\n`);
        generated++;
        
        // Rate limiting: wait 2 seconds between requests
        if (processed < videos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        failed++;
      }

      processed++;
    }

    console.log('\n================================================');
    console.log('✅ AI processing complete!\n');
    console.log(`   Total videos: ${videos.length}`);
    console.log(`   Generated: ${generated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Failed: ${failed}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ AI processing failed:', error);
    process.exit(1);
  }
}

// Run
processAIDescriptions();

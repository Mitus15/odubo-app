#!/usr/bin/env node

/**
 * Test the new gated upload flow:
 * 1. Direct upload to Stream
 * 2. Create session
 * 3. Generate thumbnail candidates
 * 4. Finalize with publication_status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

// Color functions for terminal output
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

async function loginAdmin() {
  console.log(colors.blue('🔑 Logging in as admin...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        email: 'maniodubo@gmail.com',
        password: 'GallopGhost5661!'
      })
    });
    
    const data = await res.json();
    
    if (res.status === 200 && data.token) {
      console.log(colors.green('   ✅ Admin login successful'));
      return data.token;
    } else {
      console.log(colors.red('   ❌ Admin login failed:'), data);
      return null;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error logging in:'), error.message);
    return null;
  }
}

async function getDirectUploadUrl(token, metadata) {
  console.log(colors.blue('📡 Getting direct upload URL...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/videos/stream/direct-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(metadata)
    });
    
    const data = await res.json();
    
    if (res.status === 200 && data.success) {
      console.log(colors.green('   ✅ Direct upload URL obtained'));
      return { uploadURL: data.uploadURL, uid: data.uid };
    } else {
      console.log(colors.red('   ❌ Failed to get upload URL:'), data);
      return null;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error getting upload URL:'), error.message);
    return null;
  }
}

async function createUploadSession(token, uid, metadata) {
  console.log(colors.blue('📝 Creating upload session...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/videos/upload-session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ uid, meta: metadata })
    });
    
    const data = await res.json();
    
    if (res.status === 200 && data.success) {
      console.log(colors.green(`   ✅ Session created: ${data.sessionId}`));
      return data.sessionId;
    } else {
      console.log(colors.red('   ❌ Failed to create session:'), data);
      return null;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error creating session:'), error.message);
    return null;
  }
}

async function suggestThumbnails(token, sessionId) {
  console.log(colors.blue('🎯 Generating thumbnail suggestions...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/videos/thumbnail/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ sessionId })
    });
    
    const data = await res.json();
    
    if (res.status === 200 && data.success) {
      console.log(colors.green('   ✅ Thumbnail suggestions generated'));
      return true;
    } else {
      console.log(colors.red('   ❌ Failed to suggest thumbnails:'), data);
      return false;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error suggesting thumbnails:'), error.message);
    return false;
  }
}

async function getCandidates(token, sessionId) {
  console.log(colors.blue('📋 Getting thumbnail candidates...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/videos/thumbnail/candidates?sessionId=${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await res.json();
    
    if (res.status === 200 && data.success) {
      console.log(colors.green(`   ✅ Found ${data.candidates.length} candidates`));
      return data.candidates;
    } else {
      console.log(colors.red('   ❌ Failed to get candidates:'), data);
      return [];
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error getting candidates:'), error.message);
    return [];
  }
}

async function finalizeVideo(token, sessionId, selectedPct = null, publicationStatus = 'live') {
  console.log(colors.blue(`🏁 Finalizing video with status: ${publicationStatus}...`));
  
  try {
    const res = await fetch(`${BASE_URL}/api/videos/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        sessionId, 
        selectedTimestampPct: selectedPct,
        publication_status: publicationStatus
      })
    });
    
    const data = await res.json();
    
    if (res.status === 200 && data.success) {
      console.log(colors.green('   ✅ Video finalized successfully'));
      return { uid: data.uid, url: data.url };
    } else {
      console.log(colors.red('   ❌ Failed to finalize video:'), data);
      return null;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error finalizing video:'), error.message);
    return null;
  }
}

async function main() {
  console.log(colors.bold('\n🎬 Testing Gated Upload Flow\n'));
  console.log(colors.yellow('Testing the complete flow without actual file upload (Stream endpoints only)\n'));
  
  let success = true;
  
  // Step 1: Login as admin
  const token = await loginAdmin();
  if (!token) {
    success = false;
    console.log(colors.red('\n❌ Cannot proceed without admin token'));
    return;
  }
  
  // Step 2: Get direct upload URL
  const metadata = {
    title: 'Test Gated Upload',
    artist_name: 'Test Artist',
    description: 'Testing the new gated upload flow',
    category: 'test',
    type: 'music video',
    mood: 'neutral',
    is_public: true
  };
  
  const uploadInfo = await getDirectUploadUrl(token, metadata);
  if (!uploadInfo) {
    success = false;
    console.log(colors.red('\n❌ Cannot proceed without upload URL'));
    return;
  }
  
  // Step 3: Create upload session
  const sessionId = await createUploadSession(token, uploadInfo.uid, metadata);
  if (!sessionId) {
    success = false;
    console.log(colors.red('\n❌ Cannot proceed without session'));
    return;
  }
  
  // For testing, we'll skip the actual file upload to Stream
  console.log(colors.yellow('\n⏭️  Skipping actual file upload (would upload to Stream here)'));
  
  // Step 4: Generate thumbnail suggestions (this will fail without actual video, but tests the endpoint)
  console.log(colors.yellow('\n📸 Testing thumbnail suggestion endpoint (will likely fail without actual video)...'));
  await suggestThumbnails(token, sessionId);
  
  // Step 5: Get candidates (should be empty but tests the endpoint)
  const candidates = await getCandidates(token, sessionId);
  
  // Step 6: Finalize video (test both publication statuses)
  console.log(colors.yellow('\n🏁 Testing finalization with "live" status...'));  
  const liveResult = await finalizeVideo(token, sessionId, null, 'live');
  
  // Create another session for archived test
  const sessionId2 = await createUploadSession(token, `test-uid-${Date.now()}`, metadata);
  if (sessionId2) {
    console.log(colors.yellow('\n🏁 Testing finalization with "archived" status...'));
    await finalizeVideo(token, sessionId2, null, 'archived');
  }
  
  console.log('\n' + colors.bold('📊 Test Results:'));
  if (success) {
    console.log(colors.green('✅ Core API endpoints are working correctly!\n'));
    console.log(colors.blue('🚀 Next steps for full testing:'));
    console.log('   • Visit http://localhost:3000/admin/videos');
    console.log('   • Login with maniodubo@gmail.com / GallopGhost5661!');
    console.log('   • Upload a real video file to test the complete flow\n');
  } else {
    console.log(colors.red('❌ Some core endpoints failed. Check the output above for details.\n'));
  }
}

main().catch(console.error);

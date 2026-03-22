#!/usr/bin/env node

/**
 * End-to-End Video Upload Test
 * Tests the complete video upload flow including admin authentication
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color functions for terminal output
const BASE_URL = 'http://localhost:3001';

// Color functions for terminal output
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

async function createAdminUser() {
  console.log(colors.blue('🔐 Creating admin user...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'info@odubo.studio',
        username: 'admin',
        password: 'admin123',
        first_name: 'Admin',
        last_name: 'User',
        is_admin: true
      })
    });
    
    const data = await res.json();
    
    if (res.status === 201 || res.status === 200) {
      console.log(colors.green('   ✅ Admin user created successfully'));
      return true;
    } else if (res.status === 409) {
      console.log(colors.yellow('   ⚠️  Admin user already exists'));
      return true;
    } else {
      console.log(colors.red('   ❌ Failed to create admin user:'), data);
      return false;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error creating admin user:'), error.message);
    return false;
  }
}

async function loginAdmin() {
  console.log(colors.blue('🔑 Logging in as admin...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        email: 'info@odubo.studio',
        password: 'admin123'
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

async function testVideoUpload(token) {
  console.log(colors.blue('🎬 Testing video upload...'));
  
  try {
    // Create test files
    const projectRoot = path.resolve(__dirname, '..');
    const testVideoPath = path.join(projectRoot, 'tmp', 'test-video.mp4');
    const testPosterPath = path.join(projectRoot, 'tmp', 'test-poster.jpg');
    
    if (!fs.existsSync(testVideoPath) || !fs.existsSync(testPosterPath)) {
      console.log(colors.red('   ❌ Test files not found. Run the debug script first.'));
      return false;
    }
    
    // Create FormData
    const FormData = (await import('formdata-node')).FormData;
    const fileFromPath = (await import('formdata-node/file-from-path')).fileFromPath;
    
    const formData = new FormData();
    
    // Add files
    formData.append('file', await fileFromPath(testVideoPath, 'test-video.mp4', { type: 'video/mp4' }));
    formData.append('poster', await fileFromPath(testPosterPath, 'test-poster.jpg', { type: 'image/jpeg' }));
    
    // Add metadata
    formData.append('title', 'Test Video Upload');
    formData.append('description', 'This is a test video upload from the debug script');
    formData.append('category', 'test');
    formData.append('is_public', 'true');
    formData.append('type', 'short film');
    formData.append('mood', 'neutral');
    formData.append('duration', '30');
    
    // Get user email from token
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    const res = await fetch(`${BASE_URL}/api/videos/upload`, {
      method: 'POST',
      headers: {
        'x-user-email': payload.email
      },
      body: formData
    });
    
    const data = await res.json();
    
    if (res.status === 200) {
      console.log(colors.green('   ✅ Video upload successful!'));
      console.log(colors.green(`   📹 Video URL: ${data.videoUrl}`));
      console.log(colors.green(`   🖼️  Poster URL: ${data.posterUrl}`));
      return true;
    } else {
      console.log(colors.red('   ❌ Video upload failed:'), data);
      return false;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error during video upload:'), error.message);
    return false;
  }
}

async function testVideoList() {
  console.log(colors.blue('📋 Testing video list API...'));
  
  try {
    const res = await fetch(`${BASE_URL}/api/videos`);
    const data = await res.json();
    
    if (res.status === 200) {
      console.log(colors.green(`   ✅ Video list retrieved: ${data.videos.length} videos found`));
      if (data.videos.length > 0) {
        console.log(colors.blue(`   📋 Latest video: "${data.videos[0].title}"`));
      }
      return true;
    } else {
      console.log(colors.red('   ❌ Failed to retrieve video list:'), data);
      return false;
    }
  } catch (error) {
    console.log(colors.red('   ❌ Error retrieving video list:'), error.message);
    return false;
  }
}

async function main() {
  console.log(colors.bold('\n🎬 End-to-End Video Upload Test\n'));
  console.log(colors.yellow('Make sure your dev server is running: npm run dev\n'));
  
  let success = true;
  
  // Step 1: Create admin user
  success = await createAdminUser() && success;
  
  // Step 2: Login as admin
  const token = await loginAdmin();
  if (!token) {
    success = false;
  }
  
  // Step 3: Test video upload
  if (token) {
    success = await testVideoUpload(token) && success;
  }
  
  // Step 4: Test video list
  success = await testVideoList() && success;
  
  console.log('\n' + colors.bold('📊 Test Results:'));
  if (success) {
    console.log(colors.green('✅ All tests passed! Your video upload system is working correctly.\n'));
    console.log(colors.blue('🚀 You can now:'));
    console.log('   • Visit http://localhost:3001/admin/videos');
    console.log('   • Login with info@odubo.studio / admin123');
    console.log('   • Upload videos through the UI\n');
  } else {
    console.log(colors.red('❌ Some tests failed. Check the output above for details.\n'));
    console.log(colors.yellow('💡 Common issues:'));
    console.log('   • Make sure dev server is running: npm run dev');
    console.log('   • Check that all environment variables are set');
    console.log('   • Verify database migration has been applied');
    console.log('   • Check R2 bucket permissions\n');
  }
}

main().catch(console.error);

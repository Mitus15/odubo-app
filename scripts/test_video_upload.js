#!/usr/bin/env node

/**
 * Comprehensive Video Upload Debug Script
 * Tests all components of the video upload system
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color functions for terminal output
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

async function main() {
  console.log(colors.bold('\n🎬 Video Upload System Debug Tool\n'));

  // 1. Check Environment Variables
  console.log(colors.blue('1. Checking Environment Variables...'));
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'CLOUDFLARE_R2_ENDPOINT',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_URL'
  ];

  let envErrors = 0;
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.log(colors.red(`   ❌ ${varName}: Not set`));
      envErrors++;
    } else {
      // Mask sensitive values
      const displayValue = varName.includes('SECRET') || varName.includes('TOKEN') 
        ? value.substring(0, 8) + '...' 
        : value;
      console.log(colors.green(`   ✅ ${varName}: ${displayValue}`));
    }
  });

  if (envErrors > 0) {
    console.log(colors.red(`\n❌ ${envErrors} environment variables are missing!`));
    console.log(colors.yellow('Please check your .env.local file.\n'));
  } else {
    console.log(colors.green('\n✅ All environment variables are set.\n'));
  }

  // 2. Test Database Connection
  console.log(colors.blue('2. Testing Database Connection...'));
  
  if (process.env.DATABASE_URL) {
    try {
      const response = await fetch(`${process.env.DATABASE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CLOUDFLARE_D1_API_TOKEN ? { 'Authorization': `Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}` } : {})
        },
        body: JSON.stringify({ 
          sql: 'SELECT name FROM sqlite_master WHERE type="table" AND name="videos"', 
          params: [] 
        }),
      });
      
      const data = await response.json();
      if (response.ok && data.result && data.result[0]?.results?.length > 0) {
        console.log(colors.green('   ✅ Database connection successful'));
        console.log(colors.green('   ✅ Videos table exists'));
      } else {
        console.log(colors.red('   ❌ Videos table not found'));
        console.log('   Response:', JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.log(colors.red('   ❌ Database connection failed:'), error.message);
    }
  }
  console.log('');

  // 3. Test R2 Connection
  console.log(colors.blue('3. Testing R2 Connection...'));
  
  if (process.env.CLOUDFLARE_R2_ENDPOINT && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
    try {
      const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new ListObjectsV2Command({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        MaxKeys: 1
      });

      const response = await s3Client.send(command);
      console.log(colors.green('   ✅ R2 connection successful'));
      console.log(colors.green(`   ✅ Bucket "${process.env.CLOUDFLARE_R2_BUCKET_NAME}" accessible`));
    } catch (error) {
      console.log(colors.red('   ❌ R2 connection failed:'), error.message);
      if (error.name === 'NoSuchBucket') {
        console.log(colors.yellow('   💡 Check if bucket name is correct and exists'));
      }
    }
  }
  console.log('');

  // 4. Test API Route
  console.log(colors.blue('4. Testing API Route...'));
  
  try {
    // Test with a GET request (should fail but route should exist)
    const response = await fetch('http://localhost:3000/api/videos/upload', {
      method: 'GET',
    });
    
    if (response.status === 405) {
      console.log(colors.green('   ✅ API route exists (Method Not Allowed is expected)'));
    } else {
      console.log(colors.yellow(`   ⚠️  Unexpected response: ${response.status}`));
    }
  } catch (error) {
    console.log(colors.red('   ❌ API route test failed:'), error.message);
    console.log(colors.yellow('   💡 Make sure your dev server is running: npm run dev'));
  }
  console.log('');

  // 5. Check File Permissions and Sample Files
  console.log(colors.blue('5. Checking File System...'));
  
  const projectRoot = path.resolve(__dirname, '..');
  const uploadsDir = path.join(projectRoot, 'tmp');
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(colors.green(`   ✅ Created tmp directory: ${uploadsDir}`));
    } else {
      console.log(colors.green('   ✅ Tmp directory exists'));
    }

    // Create a test video file
    const testVideoPath = path.join(uploadsDir, 'test-video.mp4');
    const testPosterPath = path.join(uploadsDir, 'test-poster.jpg');
    
    if (!fs.existsSync(testVideoPath)) {
      // Create a minimal mp4 file (just header bytes)
      const mp4Header = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
      ]);
      fs.writeFileSync(testVideoPath, mp4Header);
      console.log(colors.green('   ✅ Created test video file'));
    }

    if (!fs.existsSync(testPosterPath)) {
      // Create a minimal JPEG file (just header bytes)
      const jpegHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
        0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);
      fs.writeFileSync(testPosterPath, jpegHeader);
      console.log(colors.green('   ✅ Created test poster file'));
    }

    console.log(colors.blue(`\n   Test files created in: ${uploadsDir}`));
    console.log(colors.blue(`   Video: ${testVideoPath}`));
    console.log(colors.blue(`   Poster: ${testPosterPath}`));

  } catch (error) {
    console.log(colors.red('   ❌ File system check failed:'), error.message);
  }
  console.log('');

  // 6. Recommendations
  console.log(colors.bold('📋 Debugging Recommendations:\n'));
  
  console.log('1. Frontend Issues:');
  console.log('   • Check browser Network tab for failed requests');
  console.log('   • Verify user email is being sent in headers');
  console.log('   • Ensure admin user exists in database with is_admin=1');
  console.log('');
  
  console.log('2. Backend Issues:');
  console.log('   • Check server console for detailed error logs');
  console.log('   • Verify FormData parsing in Next.js App Router');
  console.log('   • Test with smaller files first');
  console.log('');
  
  console.log('3. Database Issues:');
  console.log('   • Run migration: npx wrangler d1 migrations apply odubo --remote');
  console.log('   • Check D1 dashboard for table structure');
  console.log('   • Verify DATABASE_URL format and permissions');
  console.log('');
  
  console.log('4. R2 Issues:');
  console.log('   • Check bucket permissions and CORS settings');
  console.log('   • Verify R2 credentials and endpoint');
  console.log('   • Test with smaller files to rule out size limits');
  console.log('');

  console.log(colors.green('🚀 Next Steps:'));
  console.log('   1. Fix any environment variable issues above');
  console.log('   2. Run: npm run dev');
  console.log('   3. Test upload in browser at /admin/videos');
  console.log('   4. Check browser dev tools Network tab for errors\n');
}

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

main().catch(console.error);

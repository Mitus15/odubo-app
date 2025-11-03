#!/usr/bin/env node
/**
 * Local connectivity test for Moments uploads without using a camera.
 *
 * Flow:
 * 1) POST /api/moments/upload-url to get a presigned PUT URL and key
 * 2) PUT the bytes to R2 with Content-Type
 * 3) POST /api/moments/record to persist metadata
 * 4) GET /api/moments/list to verify presence (requires code to see unmoderated)
 *
 * Usage examples:
 *   node scripts/test_moments_connectivity.mjs --baseUrl http://localhost:3000 --code 1234
 *   node scripts/test_moments_connectivity.mjs --baseUrl http://localhost:3000 --galleryId 7 --file ./public/favicon-32x32.png
 */

import './load-env.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

function guessContentType(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.heic': return 'image/heic';
    case '.heif': return 'image/heif';
    default: return 'image/png';
  }
}

async function getTestBytes(filePath) {
  if (filePath) {
    const buf = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    const contentType = guessContentType(filename);
    return { buf, filename, contentType };
  }
  // 1x1 transparent PNG
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  const buf = Buffer.from(base64, 'base64');
  return { buf, filename: `test_${Date.now()}.png`, contentType: 'image/png' };
}

async function main() {
  const { baseUrl = 'http://localhost:3000', galleryId, code, file: filePath } = parseArgs();

  if (!galleryId && !code) {
    console.error('Provide --galleryId or --code');
    process.exit(1);
  }

  const { buf, filename, contentType } = await getTestBytes(filePath);

  console.log(`[1/4] Requesting upload URL (file=${filename}, type=${contentType})`);
  const upRes = await fetch(`${baseUrl}/api/moments/upload-url`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ galleryId, code, fileName: filename, contentType, mediaType: 'photo' })
  });
  const upJson = await upRes.json();
  if (!upRes.ok) {
    console.error('upload-url failed:', upJson);
    process.exit(2);
  }
  const { uploadUrl, key, publicUrl } = upJson;
  console.log('  → got key:', key);

  console.log('[2/4] PUT bytes to presigned URL');
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: buf
  });
  if (!putRes.ok) {
    console.error('PUT failed:', await putRes.text());
    process.exit(3);
  }
  console.log('  → upload complete');

  console.log('[3/4] Recording metadata');
  const recRes = await fetch(`${baseUrl}/api/moments/record`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ galleryId, code, r2_key: key, original_filename: filename, media_type: 'photo' })
  });
  const recJson = await recRes.json();
  if (!recRes.ok) {
    console.error('record failed:', recJson);
    process.exit(4);
  }
  console.log('  → record:', recJson);

  console.log('[4/4] Listing gallery to verify');
  const params = new URLSearchParams({ galleryId: String(galleryId || ''), code: String(code || '') });
  const listRes = await fetch(`${baseUrl}/api/moments/list?${params.toString()}`);
  const listJson = await listRes.json();
  if (!listRes.ok) {
    console.error('list failed:', listJson);
    process.exit(5);
  }
  const count = Array.isArray(listJson?.photos) ? listJson.photos.length : (Array.isArray(listJson) ? listJson.length : 0);
  console.log(`  → list ok (photos: ${count})`);

  console.log('\nSuccess! Key:', key, '\nPublic URL (if enabled):', publicUrl || '(none)');
}

main().catch(err => {
  console.error(err);
  process.exit(99);
});

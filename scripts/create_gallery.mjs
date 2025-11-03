#!/usr/bin/env node
/**
 * Create a new Moments gallery directly in D1 for testing.
 * - Generates a random event code (6 chars, A-Z0-9) if not provided
 * - Sets starts_at a few minutes ago and ends_at in the near future (default 2h)
 * - Prints { id, code, title, starts_at, ends_at }
 *
 * Usage:
 *   node scripts/create_gallery.mjs --title "Test Gallery" --hours 2 --code ABCD12
 */

import './load-env.js';
import fetch from 'node-fetch';

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

function randCode(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function d1Query(sql, params = []) {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  if (!apiToken) throw new Error('CLOUDFLARE_D1_API_TOKEN not set');

  const res = await fetch(`${databaseUrl}/query`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ sql, params })
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error('D1 query failed: ' + JSON.stringify(data));
  }
  return data;
}

async function d1Select(sql, params = []) {
  const data = await d1Query(sql, params);
  return data?.result?.[0]?.results || [];
}

function toISOString(d) {
  return new Date(d).toISOString();
}

async function main() {
  const { title = `Test Gallery ${new Date().toISOString().slice(0,19)}`, hours = '2', code: codeArg } = parseArgs();
  const code = (codeArg || randCode(6)).toUpperCase();
  const now = Date.now();
  const startsAt = new Date(now - 5 * 60 * 1000); // 5 min ago
  const endsAt = new Date(now + Number(hours) * 60 * 60 * 1000);

  const insertSql = `INSERT INTO galleries (code, title, description, created_by, starts_at, ends_at, config)
                     VALUES (?, ?, NULL, NULL, ?, ?, NULL)`;
  await d1Query(insertSql, [code, title, toISOString(startsAt), toISOString(endsAt)]);

  const rows = await d1Select('SELECT id, code, title, starts_at, ends_at FROM galleries WHERE code = ? ORDER BY id DESC LIMIT 1', [code]);
  if (!rows[0]) throw new Error('Insert appeared to succeed but gallery not found');
  const g = rows[0];
  console.log(JSON.stringify({ id: g.id, code: g.code, title: g.title, starts_at: g.starts_at, ends_at: g.ends_at }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });

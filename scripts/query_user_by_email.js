// scripts/query_user_by_email.js
// Usage: node scripts/query_user_by_email.js <email>

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const fetch = require('node-fetch');


const API_URL = process.env.DATABASE_URL || 'https://api.cloudflare.com/client/v4/accounts/835a09fb1a9d192ae03fc64b602fcc47/d1/database/c63953e2-82b5-407f-b10d-831fc7e5e85e/query';
const D1_API_TOKEN = process.env.CLOUDFLARE_D1_API_TOKEN;

// Debug print for the token (masked)
console.log('Loaded CLOUDFLARE_D1_API_TOKEN:', D1_API_TOKEN ? (D1_API_TOKEN.slice(0, 6) + '...' + D1_API_TOKEN.slice(-4)) : 'undefined');

async function queryUser(email) {
  const sql = 'SELECT * FROM users WHERE email = ? LIMIT 1';
  const params = [email];
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(D1_API_TOKEN ? { 'Authorization': `Bearer ${D1_API_TOKEN}` } : {})
    },
    body: JSON.stringify({ sql, params })
  });
  const data = await res.json();
  console.log('D1 query response:', JSON.stringify(data, null, 2));
  if (data.result && data.result[0] && data.result[0].results && data.result[0].results.length) {
    console.log('User found:', data.result[0].results[0]);
  } else {
    console.log('No user found with that email.');
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/query_user_by_email.js <email>');
  process.exit(1);
}
queryUser(email).catch(console.error);

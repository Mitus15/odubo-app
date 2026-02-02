import 'dotenv/config';
import { executeQuery } from '../src/lib/db';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

async function disableSignedURLs() {
  const uid = '4f1584682f3e5b9e34d9ad85c5ce1747';
  
  console.log(`Disabling signed URLs for video: ${uid}`);
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: uid,
        requireSignedURLs: false,
      }),
    }
  );
  
  const data = await response.json() as any;
  
  if (!data.success) {
    console.error('Error:', data.errors);
    return;
  }
  
  console.log('✅ Signed URLs disabled');
  console.log('Requires signed URLs:', data.result.requireSignedURLs);
  
  // Update database with public thumbnail URL
  const posterUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
  
  await executeQuery(
    `UPDATE videos SET poster_url = ? WHERE id = 407`,
    [posterUrl]
  );
  
  console.log(`✅ Updated database with public thumbnail URL: ${posterUrl}`);
}

disableSignedURLs().catch(console.error);

import 'dotenv/config';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

async function checkVideoDetails() {
  const uid = '4f1584682f3e5b9e34d9ad85c5ce1747';
  
  console.log(`Fetching video details for UID: ${uid}`);
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
    {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    }
  );
  
  const data = await response.json() as any;
  
  if (!data.success) {
    console.error('Error:', data.errors);
    return;
  }
  
  const video = data.result;
  
  console.log('\n=== Video Details ===');
  console.log('UID:', video.uid);
  console.log('Status:', video.status?.state);
  console.log('Ready to stream:', video.readyToStream);
  console.log('Requires signed URLs:', video.requireSignedURLs);
  console.log('\n=== Thumbnail URLs ===');
  console.log('Thumbnail:', video.thumbnail);
  console.log('Preview:', video.preview);
  console.log('\n=== Playback URLs ===');
  console.log('HLS:', video.playback?.hls);
  console.log('DASH:', video.playback?.dash);
  console.log('\n=== Full Response ===');
  console.log(JSON.stringify(video, null, 2));
}

checkVideoDetails().catch(console.error);

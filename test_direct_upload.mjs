// Quick test to get admin token and test direct upload
const BASE_URL = 'http://localhost:3000';

async function testWithRealToken() {
  console.log('🔑 Getting admin token...');
  
  // Login to get token
  const loginRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      email: 'maniodubo@gmail.com',
      password: 'GallopGhost5661!'
    })
  });
  
  const loginData = await loginRes.json();
  
  if (!loginData.token) {
    console.error('❌ Failed to get token:', loginData);
    return;
  }
  
  console.log('✅ Got token, testing direct upload...');
  
  // Test direct upload with real token
  const uploadRes = await fetch(`${BASE_URL}/api/videos/stream/direct-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`
    },
    body: JSON.stringify({
      title: 'Test Video Upload',
      is_public: false,
      artist_name: 'Test Artist',
      description: 'Test description',
      category: 'music',
      type: 'original',
      mood: 'upbeat'
    })
  });
  
  const uploadData = await uploadRes.json();
  
  console.log('Status:', uploadRes.status);
  console.log('Response:', uploadData);
  
  if (uploadRes.ok) {
    console.log('✅ Success! Got upload URL');
  } else {
    console.log('❌ Failed with error:', uploadData.error);
  }
}

testWithRealToken().catch(console.error);

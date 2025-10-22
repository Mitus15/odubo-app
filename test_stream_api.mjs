// Test Cloudflare Stream API directly
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

console.log('🔧 Testing Stream API Connection...');
console.log('Account ID:', accountId ? `${accountId.slice(0,8)}...` : 'Not set');
console.log('API Token:', apiToken ? `${apiToken.slice(0,8)}...` : 'Not set');

if (!accountId || !apiToken) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;

async function testStreamAPI() {
  try {
    // Test 1: List existing videos (minimal permissions needed)
    console.log('\n📋 Testing: List videos...');
    const listResponse = await fetch(`${baseUrl}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const listData = await listResponse.json();
    
    if (listResponse.ok) {
      console.log('✅ List videos successful:', listData.result?.length || 0, 'videos found');
    } else {
      console.log('❌ List videos failed:', listResponse.status, listData);
      return;
    }
    
    // Test 2: Create upload URL (requires more permissions)
    console.log('\n📤 Testing: Create upload URL...');
    const uploadResponse = await fetch(`${baseUrl}/direct_upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maxDurationSeconds: 300,
        meta: {
          name: 'Test Upload',
          title: 'Test Video Title'
        }
      })
    });
    
    const uploadData = await uploadResponse.json();
    
    if (uploadResponse.ok) {
      console.log('✅ Create upload URL successful');
      console.log('   Upload URL:', uploadData.result?.uploadURL ? 'Present' : 'Missing');
      console.log('   UID:', uploadData.result?.uid ? 'Present' : 'Missing');
    } else {
      console.log('❌ Create upload URL failed:', uploadResponse.status, uploadData);
    }
    
  } catch (error) {
    console.error('❌ API Test Error:', error.message);
  }
}

testStreamAPI();

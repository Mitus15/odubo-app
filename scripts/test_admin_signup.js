import fetch from 'node-fetch';

async function testAdminSignup() {
  const res = await fetch('http://localhost:3000/api/users', {
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
  let data;
  try {
    data = await res.json();
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
    const text = await res.text();
    console.error('Raw response:', text);
    return;
  }
  console.log('Status:', res.status);
  console.log('Response:', data);
  if (data.details) {
    console.log('Validation details:', data.details);
  }
}

testAdminSignup().catch(console.error);

const fetch = require('node-fetch');

async function testAdminLogin() {
  const res = await fetch('http://192.168.1.96:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      email: 'admin@example.com',
      password: 'yourNewPassword123'
    })
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

testAdminLogin().catch(console.error);

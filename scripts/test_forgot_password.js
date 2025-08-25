// scripts/test_forgot_password.js
// Usage:
//   node scripts/test_forgot_password.js           # Step 1: triggers forgot-password, prints instructions
//   node scripts/test_forgot_password.js <token>   # Step 2: resets password with token

const fetch = require('node-fetch');

const API_URL = 'http://192.168.1.96:3000/api/users'; // Change if needed
const TEST_EMAIL = 'admin@example.com'; // Set to your test user
const NEW_PASSWORD = 'yourNewPassword123';

async function forgotPassword() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'forgot-password', email: TEST_EMAIL })
  });
  const data = await res.json();
  console.log('Forgot password response:', data);
}

async function resetPassword(token) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'reset-password',
      email: TEST_EMAIL,
      token,
      newPassword: NEW_PASSWORD
    })
  });
  const data = await res.json();
  console.log('Reset password response:', data);
}

async function main() {
  if (process.argv[2]) {
    await resetPassword(process.argv[2]);
  } else {
    await forgotPassword();
    console.log('\nCheck your server logs for the reset link.');
    console.log('Copy the token from the link and call:');
    console.log('  node scripts/test_forgot_password.js <token>\n');
  }
}

main();

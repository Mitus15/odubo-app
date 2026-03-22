// E2E check: admin gating via /api/health/cloudflare

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function createAdmin(email, username, password) {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-admin',
      email,
      username,
      password,
      first_name: 'Admin',
      last_name: 'Gating'
    })
  });
  const data = await res.json().catch(async () => ({ raw: await res.text() }));
  return { status: res.status, data };
}

async function login(email, password) {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password })
  });
  const data = await res.json().catch(async () => ({ raw: await res.text() }));
  return { status: res.status, data };
}

async function getHealth(token) {
  const res = await fetch(`${baseUrl}/api/health/cloudflare`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

(async () => {
  const email = 'info@odubo.studio';
  const username = 'admin-gating';
  const password = 'Admin123!x';

  console.log('1) Creating admin (idempotent):', email);
  const createRes = await createAdmin(email, username, password);
  console.log('   -> status', createRes.status);

  console.log('2) Logging in to obtain JWT...');
  const loginRes = await login(email, password);
  console.log('   -> status', loginRes.status);
  if (!loginRes.data?.token) {
    console.error('   -> failed to get token:', loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.token;

  console.log('3) Calling admin-only health without token (expect 401)');
  const noAuth = await getHealth(null);
  console.log('   -> status', noAuth.status);

  console.log('4) Calling admin-only health with admin token (expect 200)');
  const withAuth = await getHealth(token);
  console.log('   -> status', withAuth.status);
  if (withAuth.status === 200) {
    console.log('   -> ok keys:', Object.keys(withAuth.data || {}));
  } else {
    console.log('   -> body:', withAuth.data);
  }
})();

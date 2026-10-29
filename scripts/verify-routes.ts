// scripts/verify-routes.ts
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function testRoutes() {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@tradestock.com', password: 'password123' }),
  });
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
  assert(Boolean(cookie), 'Got session cookie');
  const headers = { Cookie: cookie! };

  const routes = [
    '/dashboard',
    '/products',
    '/inventory',
    '/billing',
    '/billing/history',
    '/analytics',
    '/imports-exports',
    '/profile',
    '/settings',
  ];

  for (const r of routes) {
    const res = await fetch(`${BASE_URL}${r}`, { headers });
    console.log(`Route ${r}: status ${res.status}`);
    assert.strictEqual(res.status, 200, `Route ${r} returned 200`);
  }
  console.log('\n🎉 ALL 9 FRONTEND PAGES RETURNED 200 OK!');
}

testRoutes().catch((err) => {
  console.error('Route check failed:', err);
  process.exit(1);
});

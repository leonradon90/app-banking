const { randomUUID } = require('crypto');

const baseUrl = 'http://localhost:3000/api/v1';

async function apiRequest(path, { method = 'GET', body, token, idempotencyKey } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(method === 'POST' ? { 'Idempotency-Key': idempotencyKey ?? randomUUID() } : {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message ?? `Request failed: ${response.status}`);
  }
  return payload;
}

async function run() {
  const email = `smoke_${Date.now()}@aurora.bank`;
  const password = 'SmokeTest123!';

  console.log('Register user...');
  await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password },
  });

  console.log('Login user...');
  const auth = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const token = auth.accessToken;

  console.log('Create accounts...');
  const debit = await apiRequest('/accounts', {
    method: 'POST',
    token,
    body: { currency: 'USD', initialBalance: 500 },
  });
  const credit = await apiRequest('/accounts', {
    method: 'POST',
    token,
    body: { currency: 'USD', initialBalance: 0 },
  });

  console.log('Post ledger transfer (signed event -> Kafka)...');
  const transferKey = randomUUID();
  const transfer = await apiRequest('/ledger/transfer', {
    method: 'POST',
    token,
    idempotencyKey: transferKey,
    body: {
      debitAccountId: debit.id,
      creditAccountId: credit.id,
      amount: 25,
      currency: 'USD',
      idempotencyKey: transferKey,
    },
  });
  console.log(`Ledger entry created: ${transfer.id}`);

  console.log('Waiting for Kafka consumer...');
  await new Promise((resolve) => setTimeout(resolve, 2500));

  console.log('Fetch notifications...');
  const notifications = await apiRequest('/notifications?limit=5', { token });
  const count = notifications?.data?.length ?? 0;
  console.log(`Notifications received: ${count}`);

  return {
    ledgerEntryId: transfer.id,
    notifications: count,
  };
}

run()
  .then((result) => {
    console.log('Smoke test completed:', result);
  })
  .catch((error) => {
    console.error('Smoke test failed:', error.message);
    process.exit(1);
  });

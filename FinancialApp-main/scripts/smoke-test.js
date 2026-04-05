const { randomUUID } = require('crypto');

const baseUrl = 'http://localhost:3000/api/v1';

async function apiRequest(path, { method = 'GET', body, token, idempotencyKey, headers: extraHeaders } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(method === 'POST' ? { 'Idempotency-Key': idempotencyKey ?? randomUUID() } : {}),
    ...extraHeaders,
  };

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      Array.isArray(payload?.message)
        ? payload.message.join(', ')
        : payload?.message?.message ?? payload?.message ?? `Request failed: ${response.status}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function expectStatus(path, options, expectedStatus) {
  try {
    await apiRequest(path, options);
    throw new Error(`Expected HTTP ${expectedStatus} but request succeeded`);
  } catch (error) {
    if (error.status !== expectedStatus) {
      throw error;
    }
    return error.payload ?? { statusCode: expectedStatus };
  }
}

async function registerAndLogin(label) {
  const email = `smoke_${Date.now()}_${label}@aurora.bank`;
  const password = 'SmokeTest123!';

  await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password },
  });

  const auth = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return { email, password, token: auth.accessToken };
}

async function run() {
  const user1 = await registerAndLogin('user1');
  const user2 = await registerAndLogin('user2');

  console.log('Submit KYC...');
  await apiRequest('/kyc/submit', {
    method: 'POST',
    token: user1.token,
    body: {
      documentType: 'passport',
      documentNumber: `DOC-${Date.now()}-1`,
    },
  });

  await apiRequest('/kyc/submit', {
    method: 'POST',
    token: user2.token,
    body: {
      documentType: 'passport',
      documentNumber: `DOC-${Date.now()}-2`,
    },
  });

  console.log('Create accounts...');
  const debit = await apiRequest('/accounts', {
    method: 'POST',
    token: user1.token,
    body: { currency: 'USD', initialBalance: 500 },
  });
  const credit = await apiRequest('/accounts', {
    method: 'POST',
    token: user2.token,
    body: { currency: 'USD', initialBalance: 0 },
  });

  console.log('Create payment...');
  const paymentKey = randomUUID();
  const payment = await apiRequest('/payments', {
    method: 'POST',
    token: user1.token,
    idempotencyKey: paymentKey,
    body: {
      fromAccount: debit.id,
      toAccount: credit.id,
      amount: 50,
      currency: 'USD',
      idempotencyKey: paymentKey,
    },
  });
  console.log(`Payment completed: ${payment.transactionId}`);

  console.log('Waiting for notifications...');
  await new Promise((resolve) => setTimeout(resolve, 2500));

  console.log('Fetch ledger history...');
  const ledgerEntries = await apiRequest(`/ledger/account/${debit.id}`, { token: user1.token });

  console.log('Fetch notifications...');
  const notifications = await apiRequest('/notifications?limit=10', { token: user1.token });

  console.log('Create account limit...');
  const limit = await apiRequest('/limits', {
    method: 'POST',
    token: user1.token,
    body: {
      scope: 'DAILY',
      threshold: 500,
      accountId: debit.id,
    },
  });
  const limits = await apiRequest('/limits', { token: user1.token });

  console.log('Tokenize + freeze card...');
  const card = await apiRequest('/card-controls/tokenize', {
    method: 'POST',
    token: user1.token,
    body: {
      accountId: debit.id,
      pan: '4111111111111111',
    },
  });
  const frozenCard = await apiRequest(`/card-controls/${encodeURIComponent(card.cardToken)}/freeze`, {
    method: 'POST',
    token: user1.token,
    body: { reason: 'smoke_test' },
  });
  const cards = await apiRequest('/card-controls', { token: user1.token });

  console.log('Fetch audit + verify access control...');
  const audit = await apiRequest('/audit?limit=10', { token: user1.token });
  const unauthorizedRead = await expectStatus(`/accounts/${debit.id}`, { token: user2.token }, 403);

  return {
    user1: user1.email,
    user2: user2.email,
    paymentStatus: payment.status,
    paymentMessage: payment.message,
    account1Balance: (await apiRequest(`/accounts/${debit.id}`, { token: user1.token })).balance,
    ledgerEntries: Array.isArray(ledgerEntries) ? ledgerEntries.length : 0,
    notificationCount: notifications?.data?.length ?? 0,
    limitRuleId: limit.id,
    limitCount: Array.isArray(limits) ? limits.length : 0,
    cardStatus: frozenCard.status,
    cardCount: Array.isArray(cards) ? cards.length : 0,
    auditEntries: audit?.data?.length ?? 0,
    unauthorizedAccountReadStatus: unauthorizedRead.statusCode,
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

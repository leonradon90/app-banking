CREATE TYPE kyc_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVIEW');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE card_status AS ENUM ('ACTIVE', 'FROZEN');
CREATE TYPE limit_scope AS ENUM ('DAILY', 'MONTHLY', 'PER_TRANSACTION');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  kyc_status kyc_status DEFAULT 'PENDING',
  roles TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  currency VARCHAR(3) DEFAULT 'USD',
  balance NUMERIC(14, 2) DEFAULT 0,
  status account_status DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  version INT DEFAULT 1
);

CREATE TABLE ledger_entries (
  id SERIAL PRIMARY KEY,
  debit_account INT REFERENCES accounts(id),
  credit_account INT REFERENCES accounts(id),
  amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  idempotency_key UUID UNIQUE NOT NULL,
  trace_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  actor VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  trace_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  channels JSONB DEFAULT '{}'::jsonb,
  event_preferences JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE card_controls (
  id SERIAL PRIMARY KEY,
  account_id INT REFERENCES accounts(id),
  card_token VARCHAR(255) UNIQUE NOT NULL,
  status card_status DEFAULT 'ACTIVE',
  mcc_whitelist JSONB DEFAULT '[]'::jsonb,
  geo_whitelist JSONB DEFAULT '[]'::jsonb,
  spend_limits JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE limit_rules (
  id SERIAL PRIMARY KEY,
  account_id INT REFERENCES accounts(id),
  user_id INT REFERENCES users(id),
  scope limit_scope NOT NULL,
  threshold NUMERIC(14, 2) NOT NULL,
  mcc INT,
  geo VARCHAR(10),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);


PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_data (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

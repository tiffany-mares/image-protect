DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS beta_invitations (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT beta_invitations_email_lowercase
        CHECK (email = LOWER(TRIM(email)))
);

CREATE INDEX IF NOT EXISTS idx_beta_invitations_email
ON beta_invitations (email);

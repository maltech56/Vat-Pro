-- Secure, single-use QuickBooks OAuth authorization state.
-- Store only a SHA-256 hash of the random state token.

BEGIN;

CREATE TABLE IF NOT EXISTS quickbooks_oauth_states (
    id BIGSERIAL PRIMARY KEY,

    state_hash TEXT NOT NULL UNIQUE,

    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    company_id INTEGER NOT NULL
        REFERENCES companies(id) ON DELETE CASCADE,

    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,

    used_at TIMESTAMP WITHOUT TIME ZONE,

    created_at TIMESTAMP WITHOUT TIME ZONE
        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qb_oauth_states_expiry
    ON quickbooks_oauth_states(expires_at);

CREATE INDEX IF NOT EXISTS idx_qb_oauth_states_company
    ON quickbooks_oauth_states(company_id);

COMMIT;
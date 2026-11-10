ALTER TABLE companies
ADD COLUMN IF NOT EXISTS trial_extension_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'companies_trial_extension_count_check'
          AND conrelid = 'companies'::regclass
    ) THEN
        ALTER TABLE companies
        ADD CONSTRAINT companies_trial_extension_count_check
        CHECK (trial_extension_count BETWEEN 0 AND 1);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS trial_extension_audit (
    id BIGSERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    approved_by INTEGER NOT NULL REFERENCES users(id),
    previous_trial_end_date TIMESTAMPTZ NOT NULL,
    new_trial_end_date TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

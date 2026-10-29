BEGIN;

CREATE TABLE public.quickbooks_transaction_tracking (
    id BIGSERIAL PRIMARY KEY,

    company_id INTEGER NOT NULL
        REFERENCES public.companies(id)
        ON DELETE CASCADE,

    realm_id TEXT NOT NULL,

    entity_type VARCHAR(20) NOT NULL
        CHECK (entity_type IN ('Invoice', 'Bill')),

    quickbooks_id TEXT NOT NULL,

    import_row_id INTEGER
        REFERENCES public.import_rows(id)
        ON DELETE SET NULL,

    transaction_id INTEGER
        REFERENCES public.transactions(id)
        ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'staged'
        CHECK (status IN ('staged', 'imported')),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT quickbooks_transaction_unique
        UNIQUE (
            company_id,
            realm_id,
            entity_type,
            quickbooks_id
        )
);

CREATE UNIQUE INDEX quickbooks_tracking_import_row_unique
    ON public.quickbooks_transaction_tracking(import_row_id)
    WHERE import_row_id IS NOT NULL;

CREATE UNIQUE INDEX quickbooks_tracking_transaction_unique
    ON public.quickbooks_transaction_tracking(transaction_id)
    WHERE transaction_id IS NOT NULL;

COMMIT;
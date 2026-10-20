
BEGIN;

CREATE TABLE public.quickbooks_document_approvals (
    id BIGSERIAL PRIMARY KEY,

    import_row_id INTEGER NOT NULL UNIQUE
        REFERENCES public.import_rows(id)
        ON DELETE CASCADE,

    approval_status VARCHAR(30) NOT NULL
        DEFAULT 'pending_review'
        CHECK (
            approval_status IN (
                'pending_review',
                'approved',
                'rejected'
            )
        ),

    approved_by INTEGER
        REFERENCES public.users(id),

    approved_at TIMESTAMP,

    rejection_reason TEXT,

    reconciliation_difference NUMERIC(12,2),

    notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT quickbooks_approval_metadata_check
        CHECK (
            approval_status <> 'approved'
            OR (
                approved_by IS NOT NULL
                AND approved_at IS NOT NULL
                AND reconciliation_difference = 0
            )
        )
);

CREATE INDEX quickbooks_document_approvals_status_idx
ON public.quickbooks_document_approvals(approval_status);

COMMIT;

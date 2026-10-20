BEGIN;

CREATE TABLE public.quickbooks_review_lines (
    id BIGSERIAL PRIMARY KEY,

    import_row_id INTEGER NOT NULL
        REFERENCES public.import_rows(id)
        ON DELETE CASCADE,

    line_index INTEGER NOT NULL,

    quickbooks_line_id TEXT,

    detail_type VARCHAR(60) NOT NULL,

    original_amount NUMERIC(12,2),

    reviewed_amount NUMERIC(12,2),

    vat_classification VARCHAR(20)
        CHECK (
            vat_classification IN (
                'taxable',
                'zero_rated',
                'exempt'
            )
        ),

    line_type VARCHAR(20) NOT NULL
        CHECK (
            line_type IN (
                'financial',
                'discount',
                'subtotal'
            )
        ),

    review_status VARCHAR(20) NOT NULL
        DEFAULT 'pending_review'
        CHECK (
            review_status IN (
                'pending_review',
                'reviewed',
                'approved'
            )
        ),

    original_data JSONB NOT NULL,

    reviewed_by INTEGER
        REFERENCES public.users(id),

    reviewed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT quickbooks_review_line_unique
        UNIQUE (import_row_id, line_index),

    CONSTRAINT quickbooks_review_amount_nonnegative
        CHECK (reviewed_amount >= 0)
);

CREATE INDEX quickbooks_review_lines_status_idx
ON public.quickbooks_review_lines(review_status);

COMMIT;
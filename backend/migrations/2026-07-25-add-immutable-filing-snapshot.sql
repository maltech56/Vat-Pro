ALTER TABLE vat_filings
ADD COLUMN audit_score NUMERIC(5,2),
ADD COLUMN audit_readiness VARCHAR(50),
ADD COLUMN transaction_count INTEGER,
ADD COLUMN linked_transaction_count INTEGER,
ADD COLUMN missing_document_count INTEGER,
ADD COLUMN document_count INTEGER;

ALTER TABLE vat_filings
ADD COLUMN supporting_transactions JSONB,
ADD COLUMN linked_documents JSONB,
ADD COLUMN missing_document_warnings JSONB;
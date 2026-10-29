BEGIN;

-- Add nullable Realm IDs.
-- Existing manually created test records retain NULL.
ALTER TABLE public.qb_customers
    ADD COLUMN realm_id TEXT;

ALTER TABLE public.qb_vendors
    ADD COLUMN realm_id TEXT;

-- Preserve duplicate protection for existing manual records.
CREATE UNIQUE INDEX qb_customers_manual_unique
    ON public.qb_customers (company_id, qb_customer_id)
    WHERE realm_id IS NULL;

CREATE UNIQUE INDEX qb_vendors_manual_unique
    ON public.qb_vendors (company_id, qb_vendor_id)
    WHERE realm_id IS NULL;

-- Replace old uniqueness rules with Realm-aware constraints.
ALTER TABLE public.qb_customers
    DROP CONSTRAINT qb_customers_company_id_qb_customer_id_key;

ALTER TABLE public.qb_customers
    ADD CONSTRAINT qb_customers_company_realm_customer_unique
    UNIQUE (company_id, realm_id, qb_customer_id);

ALTER TABLE public.qb_vendors
    DROP CONSTRAINT qb_vendors_company_id_qb_vendor_id_key;

ALTER TABLE public.qb_vendors
    ADD CONSTRAINT qb_vendors_company_realm_vendor_unique
    UNIQUE (company_id, realm_id, qb_vendor_id);

COMMIT;
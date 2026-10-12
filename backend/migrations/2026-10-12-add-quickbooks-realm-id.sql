BEGIN;

-- QuickBooks customers
ALTER TABLE public.qb_customers
ADD COLUMN realm_id TEXT NOT NULL;

ALTER TABLE public.qb_customers
DROP CONSTRAINT qb_customers_company_id_qb_customer_id_key;

ALTER TABLE public.qb_customers
ADD CONSTRAINT qb_customers_company_realm_customer_unique
UNIQUE (company_id, realm_id, qb_customer_id);

-- QuickBooks vendors
ALTER TABLE public.qb_vendors
ADD COLUMN realm_id TEXT NOT NULL;

ALTER TABLE public.qb_vendors
DROP CONSTRAINT qb_vendors_company_id_qb_vendor_id_key;

ALTER TABLE public.qb_vendors
ADD CONSTRAINT qb_vendors_company_realm_vendor_unique
UNIQUE (company_id, realm_id, qb_vendor_id);

COMMIT;
-- ==========================================================
-- QuickBooks Integration Schema
-- Phase 5.2A - Database Integrity
-- ==========================================================

CREATE TABLE IF NOT EXISTS quickbooks_connections (
    company_id INTEGER PRIMARY KEY
        REFERENCES companies(id)
        ON DELETE CASCADE,

    realm_id TEXT NOT NULL,

    access_token TEXT NOT NULL,

    refresh_token TEXT NOT NULL,

    token_expires_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qb_connections_realm
ON quickbooks_connections(realm_id);

-------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qb_customers (

    id SERIAL PRIMARY KEY,

    company_id INTEGER NOT NULL
        REFERENCES companies(id)
        ON DELETE CASCADE,

    qb_customer_id TEXT NOT NULL,

    display_name TEXT,

    company_name TEXT,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(company_id, qb_customer_id)
);

-------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qb_vendors (

    id SERIAL PRIMARY KEY,

    company_id INTEGER NOT NULL
        REFERENCES companies(id)
        ON DELETE CASCADE,

    qb_vendor_id TEXT NOT NULL,

    display_name TEXT,

    company_name TEXT,

    email TEXT,

    phone TEXT,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(company_id, qb_vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_customer_company
ON qb_customers(company_id);

CREATE INDEX IF NOT EXISTS idx_qb_vendor_company
ON qb_vendors(company_id);
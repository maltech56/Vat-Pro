-- Add Maltech system administrator flag to users
-- Separates internal Maltech administration from company-level roles.
--
-- Existing users default to FALSE.
-- This migration does not modify users.role or user_companies.role.

BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
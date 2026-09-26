-- Add Bahamas Identification Number (BIN) to companies
-- Required by Maltech VAT Pro company settings

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS bin VARCHAR(50);

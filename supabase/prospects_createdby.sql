-- Track who originally added each prospect.
-- This table uses lowercase concatenated column names (assignedto, createdat, createdby),
-- not snake_case. The column already exists on production as `createdby`; run only if missing.
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS createdby text;

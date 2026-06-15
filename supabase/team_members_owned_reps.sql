-- Run in Supabase SQL Editor (table: sales_users)
ALTER TABLE sales_users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE sales_users ADD COLUMN IF NOT EXISTS owned_reps bigint[] DEFAULT '{}';

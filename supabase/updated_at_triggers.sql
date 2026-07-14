-- Optional migration: add updated_at columns + auto-touch triggers for incremental sync.
-- Run in Supabase SQL editor when ready. Safe to re-run (IF NOT EXISTS guards).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['jobs','prospects','calls','interested_leads','closed_deals']
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()',
      t
    );
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- Backfill nulls so incremental filters work immediately
UPDATE public.jobs SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;
UPDATE public.prospects SET updated_at = COALESCE(updated_at, "createdAt", now()) WHERE updated_at IS NULL;
UPDATE public.calls SET updated_at = COALESCE(updated_at, createdat, created_at, now()) WHERE updated_at IS NULL;
UPDATE public.interested_leads SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;

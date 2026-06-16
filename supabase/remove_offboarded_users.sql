-- ============================================================================
--  remove_offboarded_users.sql
--  Offboard Ramesh, Dulaj, Dilitha — remove from sales_users AND auth.users.
--  DO NOT RUN THE DELETE BLOCK until the audit (Phase 1) is clean and you have
--  reassigned everything they own. Go-live is tonight.
--
--  RUN ORDER:
--    Phase 1  -> read-only audit. Reassign anything it returns.
--    Phase 2  -> reassignment helper (edit to taste, optional).
--    Phase 3  -> the actual deletes (guarded; run last).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Phase 0: resolve the three accounts. Adjust the name list if any email or
-- display name differs from the guess below. Everything downstream keys off
-- this CTE-style lookup, so confirm these rows resolve to exactly 3 people.
-- ----------------------------------------------------------------------------
SELECT id, username, name, email, role, owned_reps
  FROM sales_users
 WHERE lower(name)     ~ '(ramesh|dulaj|dilitha)'
    OR lower(username) ~ '(ramesh|dulaj|dilitha)'
    OR lower(email)    ~ '(ramesh|dulaj|dilitha)'
 ORDER BY name;
-- >>> Note their sales_users.id, name, username, and owned_reps before continuing.


-- ----------------------------------------------------------------------------
-- Phase 1: AUDIT — what would be orphaned by deleting these 3?
-- Assignee columns store the NAME/username/id as text, so match all three.
-- Also expand owned_reps: any rep they "own" needs a new manager.
-- ----------------------------------------------------------------------------

-- 1a. Build the set of identity tokens (name/username/id-as-text) to match on.
WITH targets AS (
  SELECT id, name, username
    FROM sales_users
   WHERE lower(name)     ~ '(ramesh|dulaj|dilitha)'
      OR lower(username) ~ '(ramesh|dulaj|dilitha)'
      OR lower(email)    ~ '(ramesh|dulaj|dilitha)'
),
tokens AS (
  SELECT lower(trim(name))     AS t FROM targets WHERE name     IS NOT NULL
  UNION
  SELECT lower(trim(username))      FROM targets WHERE username IS NOT NULL
  UNION
  SELECT lower(trim(id::text))      FROM targets
)
-- 1b. Records assigned directly to the three departing users.
SELECT 'prospects' AS source, count(*) AS rows_assigned
  FROM prospects        WHERE lower(trim(assignedto)) IN (SELECT t FROM tokens)
UNION ALL
SELECT 'calls',           count(*)
  FROM calls            WHERE lower(trim(assignedto)) IN (SELECT t FROM tokens)
UNION ALL
SELECT 'interested_leads', count(*)
  FROM interested_leads WHERE lower(trim(assignedto)) IN (SELECT t FROM tokens);

-- 1c. Reps owned by the three departing users (these reps need a new manager).
WITH targets AS (
  SELECT id, owned_reps
    FROM sales_users
   WHERE lower(name)     ~ '(ramesh|dulaj|dilitha)'
      OR lower(username) ~ '(ramesh|dulaj|dilitha)'
      OR lower(email)    ~ '(ramesh|dulaj|dilitha)'
)
SELECT su.id, su.name, su.username, su.role
  FROM sales_users su
 WHERE su.id IN (
   SELECT unnest(owned_reps) FROM targets
 )
 ORDER BY su.name;

-- 1d. Full row dump of the directly-assigned records (so you can eyeball /
--     reassign by hand). Repeat per table as needed.
WITH targets AS (
  SELECT id, name, username
    FROM sales_users
   WHERE lower(name)     ~ '(ramesh|dulaj|dilitha)'
      OR lower(username) ~ '(ramesh|dulaj|dilitha)'
      OR lower(email)    ~ '(ramesh|dulaj|dilitha)'
),
tokens AS (
  SELECT lower(trim(name)) AS t FROM targets WHERE name IS NOT NULL
  UNION SELECT lower(trim(username)) FROM targets WHERE username IS NOT NULL
  UNION SELECT lower(trim(id::text)) FROM targets
)
SELECT id, assignedto, /* add the columns you care about */ *
  FROM prospects WHERE lower(trim(assignedto)) IN (SELECT t FROM tokens);
-- (copy/paste this block for calls and interested_leads if 1b shows rows)


-- ----------------------------------------------------------------------------
-- Phase 2: REASSIGNMENT (optional helper — EDIT the target assignee first).
-- Replace 'NEW_ASSIGNEE' with the name/username you want to inherit the work.
-- Leave commented until you've decided who inherits.
-- ----------------------------------------------------------------------------
-- WITH targets AS (
--   SELECT id, name, username FROM sales_users
--    WHERE lower(name) ~ '(ramesh|dulaj|dilitha)'
--       OR lower(username) ~ '(ramesh|dulaj|dilitha)'
--       OR lower(email) ~ '(ramesh|dulaj|dilitha)'
-- ),
-- tokens AS (
--   SELECT lower(trim(name)) AS t FROM targets WHERE name IS NOT NULL
--   UNION SELECT lower(trim(username)) FROM targets WHERE username IS NOT NULL
--   UNION SELECT lower(trim(id::text)) FROM targets
-- )
-- UPDATE prospects        SET assignedto = 'NEW_ASSIGNEE' WHERE lower(trim(assignedto)) IN (SELECT t FROM tokens);
-- UPDATE calls            SET assignedto = 'NEW_ASSIGNEE' WHERE lower(trim(assignedto)) IN (SELECT t FROM tokens);
-- UPDATE interested_leads SET assignedto = 'NEW_ASSIGNEE' WHERE lower(trim(assignedto)) IN (SELECT t FROM tokens);

-- Also reassign any reps they owned to a new manager (replace <NEW_MGR_ID>):
-- UPDATE sales_users
--    SET owned_reps = array_append(coalesce(owned_reps,'{}'), <REP_ID>)
--  WHERE id = <NEW_MGR_ID>;


-- ----------------------------------------------------------------------------
-- Phase 3: DELETE (run last, only after Phase 1 audit returns 0 assigned rows
-- or you've reassigned them in Phase 2). Wrapped in a transaction so a bad
-- count lets you ROLLBACK instead of COMMIT.
-- ----------------------------------------------------------------------------
BEGIN;

-- Capture the auth_user_ids so we can delete from auth.users too.
CREATE TEMP TABLE _offboard ON COMMIT DROP AS
SELECT id, auth_user_id, name, email
  FROM sales_users
 WHERE lower(name)     ~ '(ramesh|dulaj|dilitha)'
    OR lower(username) ~ '(ramesh|dulaj|dilitha)'
    OR lower(email)    ~ '(ramesh|dulaj|dilitha)';

-- SAFETY: this MUST be exactly 3. If not, ROLLBACK and fix the match above.
SELECT count(*) AS will_delete, array_agg(name) AS who FROM _offboard;

-- Remove any lingering ownership references to these users from other managers.
UPDATE sales_users s
   SET owned_reps = (
     SELECT coalesce(array_agg(r), '{}')
       FROM unnest(s.owned_reps) AS r
      WHERE r NOT IN (SELECT id FROM _offboard)
   )
 WHERE s.owned_reps && (SELECT array_agg(id) FROM _offboard);

-- Delete the profile rows.
DELETE FROM sales_users WHERE id IN (SELECT id FROM _offboard);

-- Delete the auth accounts (identities cascade from auth.users).
DELETE FROM auth.users WHERE id IN (
  SELECT auth_user_id FROM _offboard WHERE auth_user_id IS NOT NULL
);

-- Review the counts above, then:
--   COMMIT;    -- if will_delete = 3 and audit was clean
--   ROLLBACK;  -- otherwise
ROLLBACK;  -- default to safe; change to COMMIT deliberately.

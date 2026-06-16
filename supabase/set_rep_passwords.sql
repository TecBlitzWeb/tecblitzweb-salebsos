-- ============================================================================
--  set_rep_passwords.sql
--  DO NOT RUN UNTIL GO-LIVE TONIGHT.
--  Sets a known bcrypt password for each Sales/Rep account in auth.users.
--  Run as a single transaction in the Supabase SQL editor (service role).
--  Requires pgcrypto (already enabled on Supabase by default).
-- ============================================================================
--
--  COUNT NOTE: the prior plan said "8 reps", but only 7 accounts are actual
--  Sales/Rep users. Dulaj & Ramesh are COO management and Avishka is Co-CEO,
--  so they are intentionally NOT in this rep list. If you really want an 8th
--  rep password set, tell me which account and I'll add it.
--
--  PASSWORD DISTRIBUTION TABLE (give each rep ONLY their own row):
--    email                          | password
--    -------------------------------+----------------
--    chamindu@tecblitzweb.com       | Chamindu#2026Rep
--    rashitha@tecblitzweb.com       | Rashitha#2026Rep
--    sandaruwan@tecblitzweb.com     | Sandaruwan#2026Rep
--    mohammad@tecblitzweb.com       | Mohammad#2026Rep
--    manoj@tecblitzweb.com          | Manoj#2026Rep
--    himanthi@tecblitzweb.com       | Himanthi#2026Rep
--    dehami@tecblitzweb.com         | Dehami#2026Rep
--
--  After go-live, each rep should change their password on first login.
-- ============================================================================

BEGIN;

UPDATE auth.users
   SET encrypted_password = crypt('Chamindu#2026Rep', gen_salt('bf'))
 WHERE email = lower('chamindu@tecblitzweb.com');

UPDATE auth.users
   SET encrypted_password = crypt('Rashitha#2026Rep', gen_salt('bf'))
 WHERE email = lower('rashitha@tecblitzweb.com');

UPDATE auth.users
   SET encrypted_password = crypt('Sandaruwan#2026Rep', gen_salt('bf'))
 WHERE email = lower('sandaruwan@tecblitzweb.com');

UPDATE auth.users
   SET encrypted_password = crypt('Mohammad#2026Rep', gen_salt('bf'))
 WHERE email = lower('mohammad@tecblitzweb.com');

UPDATE auth.users
   SET encrypted_password = crypt('Manoj#2026Rep', gen_salt('bf'))
 WHERE email = lower('manoj@tecblitzweb.com');

UPDATE auth.users
   SET encrypted_password = crypt('Himanthi#2026Rep', gen_salt('bf'))
 WHERE email = lower('himanthi@tecblitzweb.com');

UPDATE auth.users
   SET encrypted_password = crypt('Dehami#2026Rep', gen_salt('bf'))
 WHERE email = lower('dehami@tecblitzweb.com');

-- Sanity check: every rep email below should report rows_updated = 1.
-- If any shows 0, that auth.users row does not exist yet (create the Auth
-- user first) — do NOT assume the password was set.
SELECT email,
       (encrypted_password IS NOT NULL) AS has_password,
       updated_at
  FROM auth.users
 WHERE email IN (
   lower('chamindu@tecblitzweb.com'),
   lower('rashitha@tecblitzweb.com'),
   lower('sandaruwan@tecblitzweb.com'),
   lower('mohammad@tecblitzweb.com'),
   lower('manoj@tecblitzweb.com'),
   lower('himanthi@tecblitzweb.com'),
   lower('dehami@tecblitzweb.com')
 )
 ORDER BY email;

COMMIT;

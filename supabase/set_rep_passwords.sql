-- ============================================================================
--  set_rep_passwords.sql
--  DO NOT RUN UNTIL GO-LIVE TONIGHT.
--  Sets a known bcrypt password for the 9 login accounts in auth.users:
--    CEO (Bisara) + Co-CEO (Avishka) + 7 sales reps.
--  Run as a single transaction in the Supabase SQL editor (service role).
--  Requires pgcrypto (enabled on Supabase by default).
-- ============================================================================
--
--  PASSWORD DISTRIBUTION TABLE (give each person ONLY their own row):
--    email                          | role    | password
--    -------------------------------+---------+--------------------
--    bisara@tecblitzweb.com         | CEO     | Bisara#2026CEO
--    avishka@tecblitzweb.com        | Co-CEO  | Avishka#2026CoCEO
--    chamindu@tecblitzweb.com       | Rep     | Chamindu#2026Rep
--    rashitha@tecblitzweb.com       | Rep     | Rashitha#2026Rep
--    sandaruwan@tecblitzweb.com     | Rep     | Sandaruwan#2026Rep
--    mohammad@tecblitzweb.com       | Rep     | Mohammad#2026Rep
--    manoj@tecblitzweb.com          | Rep     | Manoj#2026Rep
--    himanthi@tecblitzweb.com       | Rep     | Himanthi#2026Rep
--    dehami@tecblitzweb.com         | Rep     | Dehami#2026Rep
--
--  After go-live, everyone should change their password on first login.
-- ============================================================================

BEGIN;

UPDATE auth.users SET encrypted_password = crypt('Bisara#2026CEO',     gen_salt('bf')) WHERE email = lower('bisara@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Avishka#2026CoCEO',  gen_salt('bf')) WHERE email = lower('avishka@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Chamindu#2026Rep',   gen_salt('bf')) WHERE email = lower('chamindu@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Rashitha#2026Rep',   gen_salt('bf')) WHERE email = lower('rashitha@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Sandaruwan#2026Rep', gen_salt('bf')) WHERE email = lower('sandaruwan@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Mohammad#2026Rep',   gen_salt('bf')) WHERE email = lower('mohammad@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Manoj#2026Rep',      gen_salt('bf')) WHERE email = lower('manoj@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Himanthi#2026Rep',   gen_salt('bf')) WHERE email = lower('himanthi@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Dehami#2026Rep',     gen_salt('bf')) WHERE email = lower('dehami@tecblitzweb.com');

-- Sanity check: each of the 9 emails below should appear with has_password = true.
SELECT email, (encrypted_password IS NOT NULL) AS has_password, updated_at
  FROM auth.users
 WHERE email IN (
   lower('bisara@tecblitzweb.com'),
   lower('avishka@tecblitzweb.com'),
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

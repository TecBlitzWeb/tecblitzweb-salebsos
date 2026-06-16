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
--    bisara@tecblitzweb.com         | CEO     | Djsing@45
--    avishka@tecblitzweb.com        | Co-CEO  | Klirt@78
--    chamindu@tecblitzweb.com       | Rep     | Nuvrt@65
--    rashitha@tecblitzweb.com       | Rep     | Ogyh@09
--    sandaruwan@tecblitzweb.com     | Rep     | Rtsh@34
--    mohammad@tecblitzweb.com       | Rep     | Qaht@26
--    manoj@tecblitzweb.com          | Rep     | Erat@24
--    himanthi@tecblitzweb.com       | Rep     | Ctye@63
--    dehami@tecblitzweb.com         | Rep     | Tysr@89
--
--  After go-live, everyone should change their password on first login.
-- ============================================================================

BEGIN;

UPDATE auth.users SET encrypted_password = crypt('Djsing@45', gen_salt('bf')) WHERE email = lower('bisara@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Klirt@78',  gen_salt('bf')) WHERE email = lower('avishka@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Nuvrt@65',  gen_salt('bf')) WHERE email = lower('chamindu@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Ogyh@09',   gen_salt('bf')) WHERE email = lower('rashitha@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Rtsh@34',   gen_salt('bf')) WHERE email = lower('sandaruwan@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Qaht@26',   gen_salt('bf')) WHERE email = lower('mohammad@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Erat@24',   gen_salt('bf')) WHERE email = lower('manoj@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Ctye@63',   gen_salt('bf')) WHERE email = lower('himanthi@tecblitzweb.com');
UPDATE auth.users SET encrypted_password = crypt('Tysr@89',   gen_salt('bf')) WHERE email = lower('dehami@tecblitzweb.com');

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

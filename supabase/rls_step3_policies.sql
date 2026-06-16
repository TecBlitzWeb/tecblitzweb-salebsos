-- ============================================================================
-- Step 3: Role-scoped Row Level Security policies
-- Replaces the temporary permissive "temp_anon_all" policies.
--
-- Roles (sales_users.role):
--   CEO                         -> sees ALL rows
--   Co-CEO / COO                -> scoped managers: own rows + owned_reps' rows
--   Rep / Sales / (other)       -> only their own rows
--
-- Assignee columns store NAMES (and sometimes usernames); owned_reps stores IDs.
-- Helper functions bridge that gap and run as SECURITY DEFINER so policies on
-- sales_users do not recurse into sales_users' own RLS.
-- ============================================================================

-- ---- Helper functions (bypass RLS via SECURITY DEFINER) --------------------

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.sales_users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.my_owned_reps()
returns bigint[] language sql stable security definer set search_path = public as $$
  select coalesce(owned_reps, '{}'::bigint[])
  from public.sales_users where auth_user_id = auth.uid() limit 1;
$$;

-- Core visibility test for the name-keyed data tables.
create or replace function public.can_see_assignee(assignee text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  me public.sales_users;
  a  text := lower(trim(coalesce(assignee, '')));
begin
  select * into me from public.sales_users where auth_user_id = auth.uid() limit 1;
  if me.id is null then
    return false;                              -- unknown / not signed in: see nothing
  end if;

  if me.role = 'CEO' then
    return true;                               -- CEO sees everything (incl. legacy/empty)
  end if;

  if a = '' then
    return false;                              -- unassigned rows hidden from non-CEO
  end if;

  -- "mine": assignee matches my name / username / id
  if a in (lower(trim(me.name)), lower(trim(coalesce(me.username,''))), me.id::text) then
    return true;
  end if;

  -- scoped managers also see their owned reps' rows (empty owned_reps => self only)
  if me.role in ('Co-CEO','COO','Chief Operating Officer') then
    return exists (
      select 1 from public.sales_users s
      where s.id = any (coalesce(me.owned_reps, '{}'::bigint[]))
        and a in (lower(trim(s.name)), lower(trim(coalesce(s.username,''))), s.id::text)
    );
  end if;

  return false;                                -- plain rep: own rows only
end;
$$;

-- ---- sales_users -----------------------------------------------------------
drop policy if exists "temp_anon_all" on public.sales_users;

create policy "sales_users_select" on public.sales_users
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.my_role() = 'CEO'
    or (public.my_role() in ('Co-CEO','COO','Chief Operating Officer')
        and id = any (public.my_owned_reps()))
  );

-- Writes to the user table are CEO-only (Add Rep / Remove Rep / ownership edits).
-- NOTE: self-service profile/PIN edits are intentionally NOT allowed here, because
-- a row-level WITH CHECK cannot prevent a user from also escalating their own role.
-- Do those later via a dedicated RPC or a column-guarded trigger.
create policy "sales_users_insert" on public.sales_users
  for insert to authenticated with check (public.my_role() = 'CEO');
create policy "sales_users_update" on public.sales_users
  for update to authenticated
  using (public.my_role() = 'CEO') with check (public.my_role() = 'CEO');
create policy "sales_users_delete" on public.sales_users
  for delete to authenticated using (public.my_role() = 'CEO');

-- ---- prospects (assignee column: assignedto) -------------------------------
drop policy if exists "temp_anon_all" on public.prospects;
create policy "prospects_select" on public.prospects for select to authenticated
  using (public.can_see_assignee(assignedto));
create policy "prospects_insert" on public.prospects for insert to authenticated
  with check (public.can_see_assignee(assignedto));
create policy "prospects_update" on public.prospects for update to authenticated
  using (public.can_see_assignee(assignedto)) with check (public.can_see_assignee(assignedto));
create policy "prospects_delete" on public.prospects for delete to authenticated
  using (public.can_see_assignee(assignedto));

-- ---- calls (assignee column: rep) ------------------------------------------
drop policy if exists "temp_anon_all" on public.calls;
create policy "calls_select" on public.calls for select to authenticated
  using (public.can_see_assignee(rep));
create policy "calls_insert" on public.calls for insert to authenticated
  with check (public.can_see_assignee(rep));
create policy "calls_update" on public.calls for update to authenticated
  using (public.can_see_assignee(rep)) with check (public.can_see_assignee(rep));
create policy "calls_delete" on public.calls for delete to authenticated
  using (public.can_see_assignee(rep));

-- ---- interested_leads (assignee column: rep) -------------------------------
drop policy if exists "temp_anon_all" on public.interested_leads;
create policy "leads_select" on public.interested_leads for select to authenticated
  using (public.can_see_assignee(rep));
create policy "leads_insert" on public.interested_leads for insert to authenticated
  with check (public.can_see_assignee(rep));
create policy "leads_update" on public.interested_leads for update to authenticated
  using (public.can_see_assignee(rep)) with check (public.can_see_assignee(rep));
create policy "leads_delete" on public.interested_leads for delete to authenticated
  using (public.can_see_assignee(rep));

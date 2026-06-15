#!/usr/bin/env bash
# Raw-REST RLS verification. Run AFTER applying rls_step3_policies.sql and
# setting the test passwords. Requires: curl, jq.
set -euo pipefail

ANON="sb_publishable_dDHINeYjE0p7Gnt6tOMr0w_jsNp2ftf"
URL="https://fuahuebzjvnpdvkxakgj.supabase.co"

token () { # email password -> access_token
  curl -s "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.access_token // empty'
}

get () { # path bearer -> json
  curl -s "$URL/rest/v1/$1" -H "apikey: $ANON" -H "Authorization: Bearer $2"
}

echo "== DEFINITION OF DONE: anon key on sales_users must return NO rows =="
ROWS=$(get "sales_users?select=id" "$ANON")
echo "anon sales_users -> $ROWS"
[ "$ROWS" = "[]" ] && echo "PASS: anon sees nothing" || echo "FAIL: anon still sees rows!"
echo

REP=$(token chamindu@tecblitzweb.com TestRep123)
MGR=$(token avishka@tecblitzweb.com TestMgr123)
CEO=$(token bisara@tecblitzweb.com TestLogin123)

echo "== REP (Chamindu): prospects assignees should be ONLY Chamindu =="
get "prospects?select=assignedto" "$REP" | jq -r '[.[].assignedto] | unique'
echo

echo "== MANAGER (Avishka, owns Dehami/Chamindu/Rashitha/Sandaruwan + self): =="
get "prospects?select=assignedto" "$MGR" | jq -r '[.[].assignedto] | unique'
echo

echo "== CEO (Bisara): should see many distinct assignees incl. legacy junk =="
get "prospects?select=assignedto" "$CEO" | jq -r '[.[].assignedto] | unique'
echo

echo "== Row counts (rep <= manager <= ceo) =="
printf "rep=%s  mgr=%s  ceo=%s\n" \
  "$(get 'prospects?select=id' "$REP" | jq 'length')" \
  "$(get 'prospects?select=id' "$MGR" | jq 'length')" \
  "$(get 'prospects?select=id' "$CEO" | jq 'length')"

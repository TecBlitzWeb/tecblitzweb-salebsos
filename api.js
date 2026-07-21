(function(){
  /** Team/user rows — same table used at login (see index.html sales_users fetch). */
  var TEAM_TABLE = "sales_users";

  var TABLE_ASSIGNED_COL = {
    prospects: "assignedto",
    calls: "rep",
    interested_leads: "rep"
  };

  function getConfig(){
    const cfg = window.APP_CONFIG || {};
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = cfg;
    if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
      console.warn("Missing APP_CONFIG Supabase values in config.js");
    }
    return {
      SUPABASE_URL: SUPABASE_URL || "",
      SUPABASE_ANON_KEY: SUPABASE_ANON_KEY || "",
      TEAM_TABLE: TEAM_TABLE
    };
  }

  /**
   * Current logged-in user's access token, or null. Prefers the live value set
   * by config.js (onAuthStateChange), and falls back to the session that
   * supabase-js persists in localStorage so the very first fetch after a reload
   * still carries the token before getSession() resolves.
   */
  function getStoredAccessToken(){
    if(window.APP_ACCESS_TOKEN) return window.APP_ACCESS_TOKEN;
    try{
      var cfg = getConfig();
      var ref = "";
      try{ ref = new URL(cfg.SUPABASE_URL).hostname.split(".")[0]; }catch(_e){}
      if(ref && typeof localStorage !== "undefined"){
        var raw = localStorage.getItem("sb-" + ref + "-auth-token");
        if(raw){
          var j = JSON.parse(raw);
          var t = j && (j.access_token || (j.currentSession && j.currentSession.access_token));
          if(t) return t;
        }
      }
    }catch(_e2){}
    return null;
  }

  function getBaseHeaders(){
    var cfg = getConfig();
    var token = getStoredAccessToken();
    return {
      "Content-Type": "application/json",
      "apikey": cfg.SUPABASE_ANON_KEY || "",
      // Use the user's session token so RLS sees auth.uid(); fall back to anon
      // (which, under strict RLS, sees nothing — that is the intended behavior).
      "Authorization": "Bearer " + (token || cfg.SUPABASE_ANON_KEY || "")
    };
  }

  function teamUrl(query){
    var cfg = getConfig();
    return (cfg.SUPABASE_URL || "") + "/rest/v1/" + TEAM_TABLE + (query || "");
  }

  function tableUrl(table, query){
    var cfg = getConfig();
    return (cfg.SUPABASE_URL || "") + "/rest/v1/" + table + (query || "");
  }

  async function safeFetch(url, options){
    try{
      var res = await fetch(url, options || {});
      var text = await res.text();
      var payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch(e){ payload = text; }
      if(!res.ok){
        return { data: null, error: payload || { message: "Request failed", status: res.status } };
      }
      return { data: payload, error: null };
    } catch(err){
      return { data: null, error: { message: err && err.message ? err.message : "Network error" } };
    }
  }

  function canonRep(rep){
    if(typeof window.canonicalRepKey === "function") return window.canonicalRepKey(rep);
    return rep == null ? "" : String(rep).trim();
  }

  /** Coerce to bigint serial id (sales_users.id). */
  function toBigintId(val){
    if(val == null || val === "") return null;
    if(typeof val === "number" && isFinite(val) && val > 0) return Math.floor(val);
    var s = String(val).trim();
    if(/^\d+$/.test(s)){
      var n = parseInt(s, 10);
      return isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  /** owned_reps column: bigint[] of sales_users.id values. */
  function normalizeOwnedRepsBigint(raw){
    if(raw == null) return [];
    var list = raw;
    if(typeof raw === "string"){
      try{
        var j = JSON.parse(raw);
        list = Array.isArray(j) ? j : raw.split(",");
      }catch(_e){
        list = raw.split(",");
      }
    }
    if(!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    list.forEach(function(x){
      var id = toBigintId(x);
      if(id != null && !seen[id]){
        seen[id] = true;
        out.push(id);
      }
    });
    return out;
  }

  function lookupIdMapCaseInsensitive(map, key){
    if(!map || key == null || key === "") return null;
    if(map[key] != null) return map[key];
    var low = String(key).toLowerCase();
    var found = null;
    Object.keys(map).forEach(function(k){
      if(found != null) return;
      if(String(k).toLowerCase() === low) found = map[k];
    });
    return found;
  }

  function getSalesUserIdForKey(key, USERS){
    var id = toBigintId(key);
    if(id != null) return id;
    var k = canonRep(key);
    if(!k) return null;
    var mapped = lookupIdMapCaseInsensitive(window._salesUserIdByKey, k);
    if(mapped != null){
      return toBigintId(mapped);
    }
    if(typeof window.getRepSalesUserId === "function"){
      return toBigintId(window.getRepSalesUserId(k));
    }
    if(typeof window.ls === "function"){
      var tm = window.ls("tm_rep_" + k) || {};
      return toBigintId(tm.supabaseId);
    }
    return null;
  }

  function getUser(uid, USERS){
    return (USERS || window.USERS || {})[uid];
  }

  // Role predicates delegate to the canonical SALES_OS implementation (main.js)
  // so the definition lives in exactly one place. The inline expressions are a
  // load-order fallback for the rare case SALES_OS isn't ready yet.
  function isDirectorCEO(uid, USERS){
    if(window.SALES_OS && typeof window.SALES_OS.isDirectorCEO === "function"){
      return window.SALES_OS.isDirectorCEO(uid, USERS);
    }
    var u = getUser(uid, USERS);
    return !!(u && u.role === "CEO");
  }

  function isCoCEO(uid, USERS){
    if(window.SALES_OS && typeof window.SALES_OS.isCoCEO === "function"){
      return window.SALES_OS.isCoCEO(uid, USERS);
    }
    return getUser(uid, USERS)?.role === "Co-CEO";
  }

  function isCOORole(uid, USERS){
    if(window.SALES_OS && typeof window.SALES_OS.isCOO === "function"){
      return window.SALES_OS.isCOO(uid, USERS);
    }
    var u = getUser(uid, USERS);
    return !!(u && (u.role === "COO" || u.role === "Chief Operating Officer" || u.tier === "coo"));
  }

  function isScopedManager(uid, USERS){
    if(window.SALES_OS && typeof window.SALES_OS.isScopedManager === "function"){
      return window.SALES_OS.isScopedManager(uid, USERS);
    }
    return isCoCEO(uid, USERS) || isCOORole(uid, USERS);
  }

  function getOwnedRepIds(uid, USERS){
    if(window.SALES_OS && typeof window.SALES_OS.getOwnedRepIds === "function"){
      return window.SALES_OS.getOwnedRepIds(uid, USERS);
    }
    var u = getUser(uid, USERS);
    if(!u) return [];
    var owned = normalizeOwnedRepsBigint(u.owned_reps);
    if(!owned.length && typeof window.ls === "function"){
      var tm = window.ls("tm_rep_" + uid) || {};
      owned = normalizeOwnedRepsBigint(tm.owned_reps);
    }
    return owned;
  }

  /** Sales/Rep: match assignedto/rep by username (ilike) and optional numeric id. */
  function buildSalesRepAssigneeFilter(col, currentUid, USERS){
    var u = getUser(currentUid, USERS);
    var k = canonRep(currentUid);
    var tokens = [];
    if(k) tokens.push(String(k));
    if(u && u.name && String(u.name).trim()) tokens.push(String(u.name).trim());
    var seen = {};
    tokens = tokens.filter(function(t){
      var low = String(t).toLowerCase();
      if(!low || seen[low]) return false;
      seen[low] = true;
      return true;
    });
    if(!tokens.length) return "&" + col + "=eq.-1";

    var parts = tokens.map(function(t){
      return col + ".ilike." + encodeURIComponent(String(t));
    });
    var selfId = getSalesUserIdForKey(currentUid, USERS);
    if(selfId != null) parts.push(col + ".eq." + selfId);
    return parts.length === 1 ? "&" + parts[0] : "&or=(" + parts.join(",") + ")";
  }

  function buildRoleFilterQuery(table, currentUid, USERS){
    var col = TABLE_ASSIGNED_COL[table];
    if(!col || !currentUid) return "";
    var u = getUser(currentUid, USERS);
    if(!u) return "";
    if(isDirectorCEO(currentUid, USERS) || u.role === "CEO") return "";
    if(isCoCEO(currentUid, USERS) || isCOORole(currentUid, USERS)){
      // assignedto/rep columns store NAMES, but owned_reps are bigint IDs — a server-side
      // IN(ids) filter can never match. Fetch all rows and let canSeeAssignedRecord()
      // scope client-side (it resolves each record's name -> id against owned_reps).
      return "";
    }
    return buildSalesRepAssigneeFilter(col, currentUid, USERS);
  }

  var SYNC_TABLES = ["jobs", "prospects", "calls", "interested_leads", "closed_deals"];
  var PAGE_TABLE_MAP = {
    dashboard: ["calls", "interested_leads", "prospects"],
    prospects: ["prospects"],
    jobs: ["jobs", "interested_leads"],
    pipeline: ["interested_leads"],
    mycalls: ["calls"],
    followups: ["calls", "interested_leads"],
    allcalls: ["calls"],
    performance: ["calls"],
    revenue: ["calls", "closed_deals"],
    settings: [],
    aireport: ["calls"]
  };

  function getLocalStore(){
    return window.LOCAL_STORE || null;
  }

  function lsKeyForTable(table){
    return table;
  }

  function readMemoryTable(table){
    if(typeof window.ls !== "function") return table === "jobs" ? {} : [];
    var key = lsKeyForTable(table);
    var val = window.ls(key);
    if(table === "jobs"){
      return val && typeof val === "object" && !Array.isArray(val) ? val : {};
    }
    return Array.isArray(val) ? val : [];
  }

  function writeMemoryTable(table, value){
    if(typeof window.ls !== "function") return;
    window.ls(lsKeyForTable(table), value);
  }

  function rowUpdatedMillis(row){
    if(!row || typeof row !== "object") return 0;
    var fields = ["updated_at", "updatedAt", "created_at", "createdAt", "createdat", "t", "ts"];
    var max = 0;
    fields.forEach(function(f){
      var v = row[f];
      if(v == null || v === "") return;
      if(typeof v === "number" && isFinite(v)){ max = Math.max(max, v); return; }
      var t = Date.parse(v);
      if(!isNaN(t)) max = Math.max(max, t);
    });
    return max;
  }

  function tableFingerprint(table, value){
    if(table === "jobs"){
      var keys = Object.keys(value || {});
      var maxTs = 0;
      keys.forEach(function(k){
        maxTs = Math.max(maxTs, rowUpdatedMillis(value[k]));
      });
      return keys.length + ":" + maxTs;
    }
    var arr = Array.isArray(value) ? value : [];
    var maxA = 0;
    arr.forEach(function(r){ maxA = Math.max(maxA, rowUpdatedMillis(r)); });
    return arr.length + ":" + maxA;
  }

  function mergeRowsById(existing, incoming){
    var isJobs = !Array.isArray(existing) && existing && typeof existing === "object";
    if(isJobs){
      var out = Object.assign({}, existing || {});
      (Array.isArray(incoming) ? incoming : []).forEach(function(row){
        if(!row || row.id == null) return;
        var id = String(row.id);
        var prev = out[id];
        if(!prev || rowUpdatedMillis(row) >= rowUpdatedMillis(prev)) out[id] = row;
      });
      return out;
    }
    var byId = Object.create(null);
    (Array.isArray(existing) ? existing : []).forEach(function(row){
      if(row && row.id != null) byId[String(row.id)] = row;
    });
    (Array.isArray(incoming) ? incoming : []).forEach(function(row){
      if(!row || row.id == null) return;
      var id = String(row.id);
      var prev = byId[id];
      if(!prev || rowUpdatedMillis(row) >= rowUpdatedMillis(prev)) byId[id] = row;
    });
    return Object.keys(byId).map(function(k){ return byId[k]; });
  }

  function buildIncrementalQuery(table, roleFilter, since){
    var q = "?select=*" + (roleFilter || "");
    if(!since) return q;
    return q + "&updated_at=gt." + encodeURIComponent(since);
  }

  async function fetchTableRows(table, currentUid, USERS, opts){
    opts = opts || {};
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: [], error: { message: "Missing SUPABASE_URL" }, incremental: false };
    var store = getLocalStore();
    var since = opts.force ? null : (store ? await store.getMeta(table) : null);
    var roleFilter = "";
    if(table === "prospects" || table === "calls" || table === "interested_leads"){
      roleFilter = buildRoleFilterQuery(table, currentUid, USERS);
    }
    var query = buildIncrementalQuery(table, roleFilter, since);
    var res = await safeFetch(tableUrl(table, query), { headers: getBaseHeaders() });
    if(res.error && since){
      var full = await safeFetch(tableUrl(table, "?select=*" + roleFilter), { headers: getBaseHeaders() });
      return { data: full.data || [], error: full.error, incremental: false };
    }
    return { data: res.data || [], error: res.error, incremental: !!since };
  }

  async function hydrateFromIDB(){
    var store = getLocalStore();
    if(!store) return false;
    await store.init();
    for(var i = 0; i < SYNC_TABLES.length; i++){
      var table = SYNC_TABLES[i];
      if(table === "jobs"){
        var jobsMap = await store.getJobsMap();
        if(Object.keys(jobsMap).length) writeMemoryTable("jobs", jobsMap);
      } else {
        var rows = await store.getAll(table);
        if(rows && rows.length) writeMemoryTable(table, rows);
      }
    }
    return true;
  }

  async function persistTableToIDB(table, value){
    var store = getLocalStore();
    if(!store) return;
    await store.init();
    await store.persistFromMemory(lsKeyForTable(table), value);
  }

  function normalizeTableRows(table, rows){
    var fn = window.DATA_NORMALIZERS && window.DATA_NORMALIZERS[table];
    if(typeof fn !== "function") return Array.isArray(rows) ? rows : [];
    return (Array.isArray(rows) ? rows : []).map(function(row){
      return fn(row);
    }).filter(Boolean);
  }

  async function applySyncedRows(table, rows, opts){
    opts = opts || {};
    var store = getLocalStore();
    var normalized = normalizeTableRows(table, rows);
    if(table === "jobs"){
      normalized = normalized.map(function(row){
        return row;
      });
    }
    var prev = readMemoryTable(table);
    var merged = mergeRowsById(prev, normalized);
    var changed = tableFingerprint(table, prev) !== tableFingerprint(table, merged);
    writeMemoryTable(table, merged);
    if(store){
      var idbRows = table === "jobs" ? Object.keys(merged).map(function(k){ return merged[k]; }) : merged;
      await store.patchRows(table, normalized);
      if(!opts.incremental) await store.persistFromMemory(lsKeyForTable(table), merged);
      await store.setMeta(table, new Date().toISOString());
    }
    return { merged: merged, changed: changed };
  }

  var _syncInflight = Object.create(null);
  var _syncRetryTimers = Object.create(null);

  function scheduleSyncRetry(table, fn, attempt){
    if(_syncRetryTimers[table]) return;
    var delay = Math.min(60000, 2000 * Math.pow(2, attempt || 0));
    _syncRetryTimers[table] = setTimeout(function(){
      _syncRetryTimers[table] = null;
      fn();
    }, delay);
  }

  async function syncTable(table, currentUid, USERS, opts){
    opts = opts || {};
    if(table === "closed_deals" && window._closedDealsTableMissing) return { changed: false };
    var key = table + "\0" + (currentUid || "") + "\0" + (opts.force ? "1" : "0");
    if(_syncInflight[key]) return _syncInflight[key];
    var pending = (async function(){
      try{
        if(window.APP_API && typeof invalidateRoleTableCache === "function" && opts.force){
          invalidateRoleTableCache(table);
        }
        var res = await fetchTableRows(table, currentUid, USERS, opts);
        if(res.error){
          scheduleSyncRetry(table, function(){
            syncTable(table, currentUid, USERS, opts).catch(function(){});
          }, (opts._attempt || 0) + 1);
          return { changed: false, error: res.error };
        }
        var rows = Array.isArray(res.data) ? res.data : [];
        if(!rows.length && res.incremental) return { changed: false };
        var applied = await applySyncedRows(table, rows, { incremental: res.incremental });
        if(typeof opts.onSynced === "function") opts.onSynced(table, applied);
        return applied;
      } finally {
        delete _syncInflight[key];
      }
    })();
    _syncInflight[key] = pending;
    return pending;
  }

  async function syncTables(tables, currentUid, USERS, opts){
    var list = Array.isArray(tables) ? tables : [];
    var results = await Promise.all(list.map(function(table){
      return syncTable(table, currentUid, USERS, opts);
    }));
    var anyChanged = results.some(function(r){ return r && r.changed; });
    return { results: results, changed: anyChanged };
  }

  function syncTablesForPage(pageId, currentUid, USERS, opts){
    var tables = PAGE_TABLE_MAP[pageId] || [];
    if(!tables.length) return Promise.resolve({ changed: false });
    return syncTables(tables, currentUid, USERS, opts);
  }

  function syncAllTablesBackground(currentUid, USERS, opts){
    return syncTables(SYNC_TABLES.slice(), currentUid, USERS, opts);
  }

  async function flushWriteQueue(){
    var store = getLocalStore();
    if(!store) return;
    if(typeof navigator !== "undefined" && !navigator.onLine) return;
    var queue = await store.getWriteQueue();
    if(!queue.length) return;
    var client = createClient();
    for(var i = 0; i < queue.length; i++){
      var item = queue[i];
      if(!item || !item.table) continue;
      try{
        var table = item.table;
        var op = item.op || "upsert";
        var payload = item.payload;
        var res = null;
        if(op === "delete"){
          var delId = payload && payload.id != null ? payload.id : payload;
          res = await client.from(table).delete().eq("id", String(delId));
        } else {
          var rows = Array.isArray(payload) ? payload : [payload];
          res = await client.from(table).upsert(rows);
        }
        if(res && res.error) throw res.error;
        await store.dequeueWrite(item.id);
      }catch(_err){}
    }
  }

  async function writeThrough(table, op, payload, networkFn){
    var store = getLocalStore();
    var prev = readMemoryTable(table);
    var snapshot = table === "jobs"
      ? Object.assign({}, prev || {})
      : (Array.isArray(prev) ? prev.slice() : []);

    try{
      if(op === "delete"){
        if(table === "jobs"){
          var delId = String(payload.id);
          var nextJobs = Object.assign({}, prev || {});
          delete nextJobs[delId];
          writeMemoryTable(table, nextJobs);
          if(store) await store.deleteRow(table, delId);
        } else {
          var id = String(payload.id);
          writeMemoryTable(table, (Array.isArray(prev) ? prev : []).filter(function(r){ return String(r.id) !== id; }));
          if(store) await store.deleteRow(table, id);
        }
      } else {
        var rows = Array.isArray(payload) ? payload : [payload];
        var merged = mergeRowsById(prev, rows);
        writeMemoryTable(table, merged);
        if(store) await store.putRows(table, rows);
      }
    }catch(localErr){
      console.warn("Local write-through failed", table, localErr);
    }

    if(typeof networkFn !== "function"){
      return { ok: true, rolledBack: false };
    }

    var offline = (typeof navigator !== "undefined" && navigator.onLine === false);
    if(offline){
      if(store){
        await store.enqueueWrite({ table: table, op: op, payload: payload, offline: true });
      }
      return { ok: true, rolledBack: false, queued: true };
    }

    try{
      var net = await networkFn();
      if(net && net.error) throw net.error;
      return { ok: true, rolledBack: false, data: net && net.data };
    }catch(netErr){
      var msg = netErr && netErr.message ? String(netErr.message) : "";
      var looksOffline = msg === "Offline" || msg === "Network error" || (typeof navigator !== "undefined" && navigator.onLine === false);
      if(looksOffline){
        if(store){
          await store.enqueueWrite({ table: table, op: op, payload: payload, error: msg, offline: true });
        }
        return { ok: true, rolledBack: false, queued: true };
      }
      writeMemoryTable(table, snapshot);
      if(store) await store.persistFromMemory(lsKeyForTable(table), snapshot);
      if(store){
        await store.enqueueWrite({ table: table, op: op, payload: payload, error: msg });
      }
      return { ok: false, rolledBack: true, error: netErr };
    }
  }

  async function fetchRoleFilteredTable(table, currentUid, USERS, opts){
    opts = opts || {};
    var cacheKey = table + "\0" + (currentUid || "");
    if(!opts.force && _roleTableCache[cacheKey]){
      return _roleTableCache[cacheKey];
    }
    if(_roleTableInflight[cacheKey]){
      return _roleTableInflight[cacheKey];
    }
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: [], error: { message: "Missing SUPABASE_URL" } };
    var pending = fetchTableRows(table, currentUid, USERS, opts).then(async function(res){
      if(!res.error){
        if(res.data && res.data.length) _roleTableCache[cacheKey] = { data: res.data, error: null };
        if(res.data && res.data.length){
          await applySyncedRows(table, res.data, { incremental: res.incremental });
        }
      }
      delete _roleTableInflight[cacheKey];
      return { data: res.data, error: res.error };
    }).catch(function(err){
      delete _roleTableInflight[cacheKey];
      throw err;
    });
    _roleTableInflight[cacheKey] = pending;
    return pending;
  }

  function invalidateRoleTableCache(table){
    if(!table){
      _roleTableCache = Object.create(null);
      _roleTableInflight = Object.create(null);
      return;
    }
    Object.keys(_roleTableCache).forEach(function(k){
      if(k.indexOf(table + "\0") === 0) delete _roleTableCache[k];
    });
    Object.keys(_roleTableInflight).forEach(function(k){
      if(k.indexOf(table + "\0") === 0) delete _roleTableInflight[k];
    });
  }

  var _roleTableCache = Object.create(null);
  var _roleTableInflight = Object.create(null);
  var _teamMembersCache = null;
  var _teamMembersInflight = null;

  function invalidateTeamMembersCache(){
    _teamMembersCache = null;
    _teamMembersInflight = null;
  }

  async function fetchTeamMembers(){
    if(_teamMembersCache) return _teamMembersCache;
    if(_teamMembersInflight) return _teamMembersInflight;
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: [], error: { message: "Missing SUPABASE_URL" } };
    var pending = safeFetch(teamUrl("?select=*&order=id.asc"), { headers: getBaseHeaders() }).then(function(res){
      if(!res.error) _teamMembersCache = res;
      _teamMembersInflight = null;
      return res;
    }).catch(function(err){
      _teamMembersInflight = null;
      throw err;
    });
    _teamMembersInflight = pending;
    return pending;
  }

  async function loginWithEmailPassword(email, password){
    try{
      const authClient = window.APP_SUPABASE_CLIENT;
      if(!authClient || !authClient.auth || typeof authClient.auth.signInWithPassword !== "function"){
        return { data: null, error: { message: "Supabase auth not initialized" } };
      }
      const result = await authClient.auth.signInWithPassword({ email, password });
      if(result && result.error){
        return { data: null, error: result.error };
      }
      return { data: result ? result.data : null, error: null };
    } catch(err){
      return { data: null, error: { message: err && err.message ? err.message : "Auth login failed" } };
    }
  }

  /** Headers carrying the logged-in user's session token (falls back to anon). */
  function authedHeaders(accessToken){
    var cfg = getConfig();
    return {
      "Content-Type": "application/json",
      "apikey": cfg.SUPABASE_ANON_KEY || "",
      "Authorization": "Bearer " + (accessToken || cfg.SUPABASE_ANON_KEY || "")
    };
  }

  /**
   * Full Auth login: signInWithPassword, then load the sales_users profile row
   * linked by auth_user_id, using the session token so RLS (Step 3) is respected.
   */
  async function loginWithAuthAndProfile(email, password){
    var em = (email || "").trim().toLowerCase();
    var pw = password != null ? String(password) : "";
    if(!em || !pw) return { data: null, error: { message: "Please enter email and password" } };

    var auth = await loginWithEmailPassword(em, pw);
    if(auth.error || !auth.data || !auth.data.user){
      var amsg = auth.error && auth.error.message ? auth.error.message : "Invalid email or password";
      return { data: null, error: { message: amsg } };
    }

    var uid = auth.data.user.id;
    var token = auth.data.session && auth.data.session.access_token ? auth.data.session.access_token : null;

    var select = "id,name,username,email,role,owned_reps,auth_user_id";
    var res = await safeFetch(
      teamUrl("?select=" + select + "&auth_user_id=eq." + encodeURIComponent(uid) + "&limit=1"),
      { headers: authedHeaders(token) }
    );
    if(res.error) return { data: null, error: res.error };
    var rows = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
    var row = rows.length ? rows[0] : null;
    if(!row){
      return { data: null, error: { message: "No profile linked to this account. Contact an admin." } };
    }
    return { data: row, error: null };
  }

  /** Authenticate against sales_users.email + sales_users.password (not Supabase Auth). */
  async function loginWithSalesUser(email, password){
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: null, error: { message: "Missing SUPABASE_URL" } };
    var em = (email || "").trim();
    var pw = password != null ? String(password) : "";
    if(!em || !pw) return { data: null, error: { message: "Please enter email and password" } };

    function pickRow(payload){
      var rows = Array.isArray(payload) ? payload : (payload ? [payload] : []);
      return rows.length ? rows[0] : null;
    }

    var select = "id,name,username,email,password,role,owned_reps";
    var res = await safeFetch(
      teamUrl("?select=" + select + "&email=eq." + encodeURIComponent(em) + "&limit=1"),
      { headers: getBaseHeaders() }
    );
    if(res.error) return { data: null, error: res.error };
    var row = pickRow(res.data);
    if(!row){
      var ilike = await safeFetch(
        teamUrl("?select=" + select + "&email=ilike." + encodeURIComponent(em) + "&limit=1"),
        { headers: getBaseHeaders() }
      );
      if(ilike.error) return { data: null, error: ilike.error };
      row = pickRow(ilike.data);
    }
    if(!row) return { data: null, error: { message: "Invalid email or password" } };

    var stored = row.password != null ? String(row.password) : "";
    if(stored !== pw){
      return { data: null, error: { message: "Invalid email or password" } };
    }

    var safe = Object.assign({}, row);
    delete safe.password;
    return { data: safe, error: null };
  }

  async function insertLoginLogSafe(_row){
    try{ return; }catch(_e){}
  }

  function createClient(){
    var cfg = getConfig();
    // Recompute headers per call so the current session token is always used
    // (the token isn't known yet when the client is first constructed).
    return {
      from: function(table){
        var base = (cfg.SUPABASE_URL || "") + "/rest/v1/" + table;
        return {
          select: function(cols, opts){
            var q = "?select=" + encodeURIComponent(cols || "*");
            if(opts && opts.filter) q += opts.filter;
            return safeFetch(base + q, { headers: getBaseHeaders() });
          },
          upsert: function(rows){
            var body = Array.isArray(rows) ? rows : [rows];
            var headers = Object.assign({}, getBaseHeaders(), { "Prefer": "resolution=merge-duplicates,return=minimal" });
            return safeFetch(base, { method: "POST", headers: headers, body: JSON.stringify(body) });
          },
          insert: function(rows){
            return this.upsert(rows);
          },
          update: function(patch){
            var body = patch || {};
            return {
              eq: function(col, val){
                var headers = Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" });
                return safeFetch(
                  base + "?" + encodeURIComponent(col) + "=eq." + encodeURIComponent(String(val)),
                  { method: "PATCH", headers: headers, body: JSON.stringify(body) }
                );
              }
            };
          },
          delete: function(id){
            if(arguments.length > 0){
              var numId = toBigintId(id);
              var idFilter = numId != null ? String(numId) : (id != null ? String(id) : "");
              if(!idFilter) return Promise.resolve({ data: null, error: { message: "Invalid id" } });
              var headers = Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" });
              return safeFetch(base + "?id=eq." + encodeURIComponent(idFilter), { method: "DELETE", headers: headers });
            }
            return {
              eq: function(col, val){
                var headers = Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" });
                return safeFetch(
                  base + "?" + encodeURIComponent(col) + "=eq." + encodeURIComponent(String(val)),
                  { method: "DELETE", headers: headers }
                );
              }
            };
          }
        };
      }
    };
  }

  function generatePassword8(){
    var chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    var out = "";
    for(var i = 0; i < 8; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  /** Insert sales_users row — id is auto-generated bigint; do not send id. */
  async function insertSalesUser(repData){
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: null, error: { message: "Missing SUPABASE_URL" } };

    var username = (repData.username || "").trim();
    var name = (repData.name || repData.displayName || repData.fullName || username).trim();
    var email = (repData.email || "").trim();
    var role = repData.role || "Sales";
    var password = repData.password || "";
    if(!username) return { data: null, error: { message: "Username is required" } };
    if(!name) return { data: null, error: { message: "Name is required" } };
    if(!email) return { data: null, error: { message: "Email is required" } };

    var row = {
      name: name,
      username: username,
      email: email,
      role: role,
      password: password,
      created_at: repData.created_at || new Date().toISOString()
    };

    var res = await safeFetch(teamUrl(), {
      method: "POST",
      headers: Object.assign({}, getBaseHeaders(), { "Prefer": "return=representation" }),
      body: JSON.stringify(row)
    });
    if(res.error){
      var msg = res.error.message || res.error.msg || res.error.hint || "Insert failed";
      return { data: null, error: { message: msg, details: res.error } };
    }
    var inserted = Array.isArray(res.data) ? res.data[0] : res.data;
    var newId = inserted && inserted.id != null ? toBigintId(inserted.id) : null;
    return { data: { id: newId, row: inserted }, error: null };
  }

  async function addNewRep(formData){
    console.log("addNewRep (api) role:", formData && formData.role);
    return insertSalesUser(formData);
  }

  async function removeRep(userId, skipConfirm){
    console.log("removeRep (api) id type:", typeof userId, userId);
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: null, error: { message: "Missing SUPABASE_URL" } };
    var id = toBigintId(userId);
    if(id == null){
      var numericId = Number(userId);
      if(isFinite(numericId) && numericId > 0) id = Math.floor(numericId);
    }
    if(id == null) return { data: null, error: { message: "Missing or invalid user id (bigint)" } };
    if(!skipConfirm && typeof window.confirm === "function"){
      if(!window.confirm("Are you sure you want to remove this rep?")){
        return { data: null, error: { message: "Cancelled" } };
      }
    }
    return safeFetch(teamUrl("?id=eq." + id), {
      method: "DELETE",
      headers: Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" })
    });
  }

  async function deleteSalesUser(memberId){
    return removeRep(memberId, true);
  }

  async function deleteSalesUserByUsername(loginName){
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL || !loginName) return { data: null, error: { message: "Missing username" } };
    return safeFetch(teamUrl("?username=eq." + encodeURIComponent(loginName)), {
      method: "DELETE",
      headers: Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" })
    });
  }

  async function deleteSalesUserByName(loginName){
    var byUser = await deleteSalesUserByUsername(loginName);
    if(!byUser.error) return byUser;
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL || !loginName) return { data: null, error: { message: "Missing name" } };
    return safeFetch(teamUrl("?name=eq." + encodeURIComponent(loginName)), {
      method: "DELETE",
      headers: Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" })
    });
  }

  async function upsertTeamMemberOwnedReps(memberId, ownedReps){
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: null, error: { message: "Missing SUPABASE_URL" } };
    var id = toBigintId(memberId);
    if(id == null) return { data: null, error: { message: "Invalid member id (bigint)" } };
    var reps = normalizeOwnedRepsBigint(ownedReps);
    var body = JSON.stringify({ owned_reps: reps });
    var headers = Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" });
    return safeFetch(teamUrl("?id=eq." + id), { method: "PATCH", headers: headers, body: body });
  }

  async function patchProspectById(prospectId, patch){
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: null, error: { message: "Missing SUPABASE_URL" } };
    var id = toBigintId(prospectId);
    if(id == null) return { data: null, error: { message: "Invalid prospect id (bigint)" } };
    var headers = Object.assign({}, getBaseHeaders(), { "Prefer": "return=minimal" });
    return safeFetch(tableUrl("prospects", "?id=eq." + id), {
      method: "PATCH",
      headers: headers,
      body: JSON.stringify(patch)
    });
  }

  async function insertProspectRow(row){
    var cfg = getConfig();
    if(!cfg.SUPABASE_URL) return { data: null, error: { message: "Missing SUPABASE_URL" } };
    var headers = Object.assign({}, getBaseHeaders(), { "Prefer": "return=representation" });
    return safeFetch(tableUrl("prospects"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify(row)
    });
  }

  async function upsertTeamMemberRow(row){
    return insertSalesUser(row);
  }

  if(typeof window !== "undefined"){
    window.addEventListener("online", function(){
      flushWriteQueue().catch(function(){});
      if(window.currentUser){
        syncAllTablesBackground(window.currentUser, window.USERS, { force: true }).catch(function(){});
      }
    });
  }

  window.APP_API = {
    TEAM_TABLE: TEAM_TABLE,
    TABLE_ASSIGNED_COL: TABLE_ASSIGNED_COL,
    SYNC_TABLES: SYNC_TABLES,
    PAGE_TABLE_MAP: PAGE_TABLE_MAP,
    createClient: createClient,
    safeFetch: safeFetch,
    baseHeaders: getBaseHeaders,
    loginWithEmailPassword: loginWithEmailPassword,
    loginWithAuthAndProfile: loginWithAuthAndProfile,
    loginWithSalesUser: loginWithSalesUser,
    insertLoginLogSafe: insertLoginLogSafe,
    insertSalesUser: insertSalesUser,
    addNewRep: addNewRep,
    fetchTeamMembers: fetchTeamMembers,
    fetchRoleFilteredTable: fetchRoleFilteredTable,
    fetchTableRows: fetchTableRows,
    hydrateFromIDB: hydrateFromIDB,
    persistTableToIDB: persistTableToIDB,
    applySyncedRows: applySyncedRows,
    syncTable: syncTable,
    syncTables: syncTables,
    syncTablesForPage: syncTablesForPage,
    syncAllTablesBackground: syncAllTablesBackground,
    flushWriteQueue: flushWriteQueue,
    writeThrough: writeThrough,
    mergeRowsById: mergeRowsById,
    tableFingerprint: tableFingerprint,
    invalidateRoleTableCache: invalidateRoleTableCache,
    invalidateTeamMembersCache: invalidateTeamMembersCache,
    buildRoleFilterQuery: buildRoleFilterQuery,
    deleteSalesUser: deleteSalesUser,
    removeRep: removeRep,
    deleteSalesUserByUsername: deleteSalesUserByUsername,
    deleteSalesUserByName: deleteSalesUserByName,
    upsertTeamMemberOwnedReps: upsertTeamMemberOwnedReps,
    patchProspectById: patchProspectById,
    insertProspectRow: insertProspectRow,
    upsertTeamMemberRow: upsertTeamMemberRow,
    generatePassword8: generatePassword8,
    toBigintId: toBigintId,
    normalizeOwnedRepsBigint: normalizeOwnedRepsBigint,
    getSalesUserIdForKey: getSalesUserIdForKey,
    getOwnedRepIds: getOwnedRepIds
  };
})();


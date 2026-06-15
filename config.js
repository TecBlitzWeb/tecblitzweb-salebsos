(function(){
  const SUPABASE_URL = "https://fuahuebzjvnpdvkxakgj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_dDHINeYjE0p7Gnt6tOMr0w_jsNp2ftf";

  window.APP_CONFIG = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    // CEO "Add Rep" only — service role; never commit a real key to git
    SUPABASE_SERVICE_ROLE_KEY: ""
  };

  window.SB_URL = SUPABASE_URL;
  window.BASE_HDR = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY
  };

  // Create and export Supabase auth client when config is available.
  window.APP_SUPABASE_CLIENT =
    (window.supabase && typeof window.supabase.createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

  // Keep the logged-in user's access token available to api.js so REST data
  // fetches run as the authenticated user (required once RLS is strict).
  window.APP_ACCESS_TOKEN = null;
  if (window.APP_SUPABASE_CLIENT && window.APP_SUPABASE_CLIENT.auth) {
    try {
      window.APP_SUPABASE_CLIENT.auth.getSession().then(function (res) {
        var s = res && res.data ? res.data.session : null;
        window.APP_ACCESS_TOKEN = s ? s.access_token : null;
      });
      window.APP_SUPABASE_CLIENT.auth.onAuthStateChange(function (_event, session) {
        window.APP_ACCESS_TOKEN = session ? session.access_token : null;
      });
    } catch (_e) {}
  }
})();

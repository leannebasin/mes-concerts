// Configuration du client Supabase
const SUPABASE_PROJECT_URL = 'https://jokiruvgopcmumacfcie.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_HGeSTixoyCZMw_3ECAkLDg_N-nWBCo3';

if (window.supabase && typeof window.supabase.createClient === 'function') {
  window.supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
} else {
  console.error('Bibliothèque Supabase non chargée');
}

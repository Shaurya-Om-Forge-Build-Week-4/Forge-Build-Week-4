

const SUPABASE_URL = "https://boocborspzmgivjqrahr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LB3wTXMuOHWjK8n5tGA6LQ_pnWwplGP";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ══════════════════════════════════════════════════════
//  NovaCiné — Configuration Supabase
//  Remplacez les valeurs ci-dessous par celles de votre
//  projet Supabase (Settings > API)
// ══════════════════════════════════════════════════════

const SUPABASE_URL = "https://qldyrajeoqkibqybmchr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZHlyYWplb3FraWJxeWJtY2hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MTkwNCwiZXhwIjoyMDkwNjQ3OTA0fQ.Q4eZjvQh7hTMCvXb3k6-Xa7gWRSdljTgi3LU_eLE6ws";

// ══════════════════════════════════════════════════════
//  Initialisation du client Supabase
//  (ne pas modifier sauf si vous savez ce que vous faites)
// ══════════════════════════════════════════════════════

let supabaseClient = null;

function initSupabaseClient() {
  if (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
   SUPABASE_URL !== "https://VOTRE_PROJET.supabase.co" &&
    SUPABASE_ANON_KEY !== "VOTRE_CLE_ANON_ICI"
  ) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("[NovaCiné] Supabase initialisé avec succès.");
    } catch (e) {
      console.warn("[NovaCiné] Échec init Supabase, fallback localStorage.", e);
      supabaseClient = null;
    }
  } else {
    console.info("[NovaCiné] Clés Supabase non configurées — utilisation du localStorage.");
    supabaseClient = null;
  }
  return supabaseClient;
}

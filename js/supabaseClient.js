/**
 * Cliente único de Supabase para todo el sitio.
 * Requiere que config.js y el script UMD de @supabase/supabase-js
 * se hayan cargado antes que este archivo.
 */
(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error(
      "No se encontró la librería de Supabase. Revisa que el <script> de supabase-js esté antes de supabaseClient.js"
    );
    return;
  }
  window.danDb = window.supabase.createClient(
    window.DAN_CONFIG.SUPABASE_URL,
    window.DAN_CONFIG.SUPABASE_ANON_KEY
  );
})();

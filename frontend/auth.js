
const LIGHT_SUPABASE_URL = "https://vqkmyfhhvgprmnezjypg.supabase.co";

const LIGHT_SUPABASE_PUBLISHABLE_KEY ="sb_publishable_1dVpftDfVHGnLUpgDASZtQ_uOU9N1oC";

if (!window.supabase) {
  console.error("Supabase library has not loaded.");
} else {
  window.lightSupabase = window.supabase.createClient(
    LIGHT_SUPABASE_URL,
    LIGHT_SUPABASE_PUBLISHABLE_KEY
  );

  console.log("Light authentication initialized.");
}

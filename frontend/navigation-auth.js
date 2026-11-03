
async function updateLightNavigation() {
  if (!window.lightSupabase) {
    console.error("Light authentication is not initialized.");
    return;
  }

  const { data, error } =
    await window.lightSupabase.auth.getSession();

  if (error) {
    console.error("Session check failed:", error.message);
    return;
  }

  const isLoggedIn = Boolean(data.session);

  document.querySelectorAll("[data-auth='guest']").forEach(element => {
    element.hidden = isLoggedIn;
  });

  document.querySelectorAll("[data-auth='user']").forEach(element => {
    element.hidden = !isLoggedIn;
  });
}

if (window.lightSupabase) {
  updateLightNavigation();

  window.lightSupabase.auth.onAuthStateChange(() => {
    updateLightNavigation();
  });
}

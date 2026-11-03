
async function updateLightNavigation() {
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

updateLightNavigation();

window.lightSupabase.auth.onAuthStateChange(() => {
  updateLightNavigation();
});

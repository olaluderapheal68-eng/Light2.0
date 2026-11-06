
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

// Logout functionality
document.addEventListener("click", async (event) => {
  const logoutButton = event.target.closest("#logoutButton");

  if (!logoutButton) return;

  logoutButton.disabled = true;
  logoutButton.textContent = "Logging out...";

  try {
    const { error } = await window.lightSupabase.auth.signOut();

    if (error) {
      throw error;
    }

    window.location.replace("login.html");

  } catch (error) {
    console.error("Logout failed:", error.message);

    logoutButton.disabled = false;
    logoutButton.innerHTML = "↪ <span>Log out</span>";

    alert("Unable to log out. Please try again.");
  }
});

if (window.lightSupabase) {
  updateLightNavigation();

  window.lightSupabase.auth.onAuthStateChange(() => {
    updateLightNavigation();
  });
}


const accountMenuButton =
  document.getElementById("accountMenuButton");

const accountMenu =
  document.getElementById("accountMenu");

if (accountMenuButton && accountMenu) {
  accountMenuButton.addEventListener("click", () => {
    const isOpen = !accountMenu.hidden;

    accountMenu.hidden = isOpen;

    accountMenuButton.setAttribute(
      "aria-expanded",
      String(!isOpen)
    );
  });

  document.addEventListener("click", (event) => {
    if (
      !accountMenu.contains(event.target) &&
      !accountMenuButton.contains(event.target)
    ) {
      accountMenu.hidden = true;
      accountMenuButton.setAttribute("aria-expanded", "false");
    }
  });
}

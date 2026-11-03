
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!window.lightSupabase) {
    loginMessage.textContent =
      "Authentication is not available. Please refresh and try again.";
    return;
  }

  loginMessage.textContent = "Signing in...";

  const { data, error } =
    await window.lightSupabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    loginMessage.textContent = error.message;
    return;
  }

  if (!data.session?.access_token) {
    loginMessage.textContent =
      "Sign-in did not create an active session. Please try again.";
    return;
  }

  loginMessage.textContent = "Login successful!";

  window.location.href = new URL(
    "home.html",
    window.location.href
  ).href;
});

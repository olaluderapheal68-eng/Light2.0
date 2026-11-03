
const signupForm = document.getElementById("signupForm");
const signupMessage = document.getElementById("signupMessage");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  const country = document.getElementById("country").value;
  const password = document.getElementById("signupPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    signupMessage.textContent = "Passwords do not match.";
    return;
  }

  if (!window.lightSupabase) {
    signupMessage.textContent =
      "Authentication is not available. Refresh and try again.";
    return;
  }

  signupMessage.textContent = "Creating your account...";

  const emailRedirectTo = new URL(
    "home.html",
    window.location.href
  ).href;

  const { data, error } = await window.lightSupabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        country: country
      },
      emailRedirectTo
    }
  });

  if (error) {
    signupMessage.textContent = error.message;
    return;
  }

  if (data.session) {
    signupMessage.textContent =
      "Account created! Taking you to Light...";

    window.location.href = new URL(
      "home.html",
      window.location.href
    ).href;
  } else {
    signupMessage.textContent =
      "Account created! Please confirm your email before signing in.";
  }

  signupForm.reset();
});

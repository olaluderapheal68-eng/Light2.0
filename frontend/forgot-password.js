
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotMessage = document.getElementById("forgotMessage");
const resetButton = document.getElementById("resetButton");

forgotPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("forgotEmail").value.trim();

  if (!window.lightSupabase) {
    forgotMessage.textContent =
      "Authentication is unavailable. Please refresh and try again.";
    return;
  }

  try {
    resetButton.disabled = true;
    resetButton.textContent = "Sending...";
    forgotMessage.textContent = "";

    const { error } = await window.lightSupabase.auth
      .resetPasswordForEmail(email, {
       redirectTo: new URL(
       "reset-password.html",
      window.location.href
      ).href
});

    if (error) {
      throw error;
    }

    forgotMessage.textContent =
      "If an account exists with that email, a password reset link will be sent.";

  }  catch (error) {
  console.error("Password recovery error:", error);

  forgotMessage.textContent =
    error.message || "Unable to send the reset link.";

  console.log("Error details:", {
    message: error.message,
    status: error.status,
    code: error.code
  });
}
 finally {
    resetButton.disabled = false;
    resetButton.textContent = "Send Reset Link";
  }
});


const resetForm = document.getElementById("resetPasswordForm");
const resetMessage = document.getElementById("resetMessage");
const updateButton = document.getElementById("updatePasswordButton");

let recoverySessionReady = false;

async function checkRecoverySession() {
  if (!window.lightSupabase) {
    resetMessage.textContent = "Authentication is unavailable. Please refresh.";
    resetForm.hidden = true;
    return;
  }

  try {
    const { data, error } =
      await window.lightSupabase.auth.getSession();

    if (error || !data.session) {
      resetMessage.textContent =
        "Your password reset link is invalid or expired. Please request a new one.";
      resetForm.hidden = true;
      return;
    }

    recoverySessionReady = true;
  } catch (error) {
    console.error("Recovery session error:", error);
    resetMessage.textContent =
      "Unable to verify your reset link. Please request a new one.";
    resetForm.hidden = true;
  }
}

window.lightSupabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && session) {
    recoverySessionReady = true;
    resetForm.hidden = false;
    resetMessage.textContent = "";
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!recoverySessionReady) {
    resetMessage.textContent =
      "Your reset session is not ready. Please open the recovery link again.";
    return;
  }

  const password = document.getElementById("newPassword").value;
  const confirmPassword =
    document.getElementById("confirmPassword").value;

  if (password.length < 8) {
    resetMessage.textContent =
      "Your password must contain at least 8 characters.";
    return;
  }

  if (password !== confirmPassword) {
    resetMessage.textContent = "Passwords do not match.";
    return;
  }

  try {
    updateButton.disabled = true;
    updateButton.textContent = "Updating...";
    resetMessage.textContent = "";

    const { error } = await window.lightSupabase.auth.updateUser({
      password
    });

    if (error) {
      throw error;
    }

    resetMessage.textContent =
      "Password updated successfully! Redirecting to login...";

    await window.lightSupabase.auth.signOut();

    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);

  } catch (error) {
    console.error("Password update error:", error);
    resetMessage.textContent =
      error.message || "Unable to update your password.";

  } finally {
    updateButton.disabled = false;
    updateButton.textContent = "Update Password";
  }
});

checkRecoverySession();


// ======================================
// LIGHT — SETTINGS FUNCTIONALITY
// ======================================

document.addEventListener("DOMContentLoaded", initializeSettings);

let currentUser = null;
let currentProfile = null;
let profileKey = null;

async function initializeSettings() {
  const supabase = window.lightSupabase;

  if (!supabase) {
    showMessage("Authentication could not be initialized.", "error");
    return;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.replace("login.html");
    return;
  }

  currentUser = data.session.user;

  await loadAccountSettings();
  loadNotificationSettings();
  loadAppearanceSettings();
  setupSettingsNavigation();
  setupSettingsButtons();
}

// ======================================
// MESSAGE DISPLAY
// ======================================

function showMessage(message, type = "success") {
  const messageBox = document.getElementById("settingsMessage");

  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.className = `settings-message ${type}`;

  window.clearTimeout(showMessage.timeout);

  showMessage.timeout = window.setTimeout(() => {
    messageBox.className = "settings-message";
    messageBox.textContent = "";
  }, 4000);
}

// ======================================
// LOAD ACCOUNT INFORMATION
// ======================================

async function loadAccountSettings() {
  const supabase = window.lightSupabase;

  document.getElementById("email").value =
    currentUser.email || "";

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, username, is_private, creator_enabled")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile loading error:", error.message);
    showMessage("Could not load your profile information.", "error");
    return;
  }

  if (!data) {
    showMessage("Your profile record could not be found.", "error");
    return;
  }

  currentProfile = data;
  profileKey = "id";

  document.getElementById("firstName").value =
    data.first_name || "";

  document.getElementById("lastName").value =
    data.last_name || "";

  document.getElementById("username").value =
    data.username || "";

  document.getElementById("privateAccount").checked =
    Boolean(data.is_private);
}
// ======================================
// SAVE ACCOUNT INFORMATION
// ======================================

async function saveAccountSettings() {
  const firstName =
    document.getElementById("firstName").value.trim();

  const lastName =
    document.getElementById("lastName").value.trim();

  const username =
    document.getElementById("username").value.trim();

  if (!firstName || !lastName || !username) {
    showMessage("Please complete all account fields.", "error");
    return;
  }

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    showMessage(
      "Username must be 3–30 characters and contain only letters, numbers or underscores.",
      "error"
    );
    return;
  }

  const { data, error } = await window.lightSupabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      username: username
    })
    .eq("id", currentUser.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Account update error:", error.message);
    showMessage("Could not save your account changes.", "error");
    return;
  }

  if (!data) {
    showMessage("No profile was updated. Check your database permissions.", "error");
    return;
  }

  currentProfile = data;
  showMessage("Your account information has been updated.");
}

// ======================================
// PRIVATE ACCOUNT
// ======================================

async function savePrivacySettings() {
  if (!currentProfile || !profileKey) {
    showMessage("Your profile could not be loaded.", "error");
    return;
  }

  const privacyField =
    "is_private" in currentProfile
      ? "is_private"
      : "private_account" in currentProfile
        ? "private_account"
        : null;

  if (!privacyField) {
    showMessage(
      "Private-account settings are not yet supported by your profiles table.",
      "error"
    );

    document.getElementById("privateAccount").checked = false;
    return;
  }

  const privateValue =
    document.getElementById("privateAccount").checked;

  const { data, error } = await window.lightSupabase
    .from("profiles")
    .update({ [privacyField]: privateValue })
    .eq(profileKey, currentUser.id)
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error("Privacy update error:", error?.message);
    showMessage("Could not save your privacy settings.", "error");
    return;
  }

  currentProfile = data;
  showMessage("Privacy settings updated.");
}

// ======================================
// NOTIFICATION PREFERENCES
// ======================================

function loadNotificationSettings() {
  const saved = JSON.parse(
    localStorage.getItem("lightNotificationSettings") || "{}"
  );

  document.getElementById("likeNotifications").checked =
    saved.likes !== false;

  document.getElementById("replyNotifications").checked =
    saved.replies !== false;

  document.getElementById("followNotifications").checked =
    saved.follows !== false;
}

function saveNotificationSettings() {
  const preferences = {
    likes: document.getElementById("likeNotifications").checked,
    replies: document.getElementById("replyNotifications").checked,
    follows: document.getElementById("followNotifications").checked
  };

  localStorage.setItem(
    "lightNotificationSettings",
    JSON.stringify(preferences)
  );

  showMessage("Notification preferences saved on this device.");
}

// ======================================
// APPEARANCE / THEME
// ======================================

function loadAppearanceSettings() {
  const savedTheme =
    localStorage.getItem("lightTheme") || "light";

  document.getElementById("themeSelect").value = savedTheme;

  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (window.applyLightTheme) {
    window.applyLightTheme(theme);
  } else {
    document.body.classList.toggle("dark-theme", theme === "dark");
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
  }
}

function saveAppearanceSettings() {
  const theme =
    document.getElementById("themeSelect").value;

  localStorage.setItem("lightTheme", theme);

  applyTheme(theme);

  showMessage("Your appearance preference has been saved.");
}

// ======================================
// CHANGE PASSWORD
// ======================================

async function changePassword() {
  const newPassword = window.prompt(
    "Enter your new password (at least 8 characters):"
  );

  if (newPassword === null) return;

  if (newPassword.length < 8) {
    showMessage("Your password must contain at least 8 characters.", "error");
    return;
  }

  const confirmation = window.prompt(
    "Confirm your new password:"
  );

  if (confirmation === null) return;

  if (newPassword !== confirmation) {
    showMessage("The passwords do not match.", "error");
    return;
  }

  const { error } = await window.lightSupabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error("Password update error:", error.message);
    showMessage("Could not update your password.", "error");
    return;
  }

  showMessage("Your password has been updated.");
}

// ======================================
// SETTINGS NAVIGATION
// ======================================

function setupSettingsNavigation() {
  const links = document.querySelectorAll(".settings-nav-link");

  links.forEach(link => {
    link.addEventListener("click", () => {
      links.forEach(item => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

// ======================================
// BUTTON EVENTS
// ======================================

function setupSettingsButtons() {
  document.getElementById("saveAccount")
    .addEventListener("click", saveAccountSettings);

  document.getElementById("privateAccount")
    .addEventListener("change", savePrivacySettings);

  document.getElementById("saveNotifications")
    .addEventListener("click", saveNotificationSettings);

  document.getElementById("saveAppearance")
    .addEventListener("click", saveAppearanceSettings);

  document.getElementById("changePassword")
    .addEventListener("click", changePassword);
}

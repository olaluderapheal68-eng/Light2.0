
/* ======================================
   LIGHT — GLOBAL THEME SYSTEM
====================================== */

(function () {
  const savedTheme = localStorage.getItem("lightTheme") || "light";

  function applyTheme(theme) {
    document.body.classList.toggle("dark-theme", theme === "dark");
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
  }

  // Apply the saved theme immediately.
  applyTheme(savedTheme);

  // Allow other pages and scripts to change the theme.
  window.applyLightTheme = function (theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    localStorage.setItem("lightTheme", selectedTheme);
    applyTheme(selectedTheme);
  };

  // Keep the theme synchronized if another tab changes it.
  window.addEventListener("storage", function (event) {
    if (event.key === "lightTheme") {
      applyTheme(event.newValue || "light");
    }
  });
})();

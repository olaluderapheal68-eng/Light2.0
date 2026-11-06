// LIGHT — GLOBAL THEME INITIALIZATION

(function () {
  const savedTheme = localStorage.getItem("lightTheme") || "light";

  document.body.classList.toggle(
    "dark-theme",
    savedTheme === "dark"
  );
})();
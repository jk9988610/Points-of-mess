(function () {
  window.POM_VERSION = "0.2.9";

  function applyVersionUi() {
    const label = `v${window.POM_VERSION}`;
    const header = document.getElementById("appVersion");
    if (header) {
      header.textContent = label;
    }
    document.title = `Points-of-mess ${label}`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyVersionUi);
  } else {
    applyVersionUi();
  }
})();

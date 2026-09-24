/**
 * MenuQR Pro - Ruleta de Premios Widget Embebible
 * Uso:
 * <div id="menuqr-ruleta" data-slug="mi-restaurante"></div>
 * <script src="https://menuqr.ubicame.cc/ruleta-widget.js" async></script>
 */
(function () {
  function initMenuQRRuleta() {
    var containers = document.querySelectorAll("#menuqr-ruleta, [data-menuqr-ruleta]");
    if (!containers || containers.length === 0) return;

    containers.forEach(function (container) {
      if (container.getAttribute("data-loaded") === "true") return;
      container.setAttribute("data-loaded", "true");

      var slug = container.getAttribute("data-slug") || "demo";
      var host = window.location.origin;

      var iframe = document.createElement("iframe");
      iframe.src = host + "/api/ruleta/embed/" + slug;
      iframe.style.width = "100%";
      iframe.style.minHeight = "620px";
      iframe.style.border = "none";
      iframe.style.borderRadius = "24px";
      iframe.style.overflow = "hidden";
      iframe.setAttribute("allow", "clipboard-write");

      container.appendChild(iframe);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMenuQRRuleta);
  } else {
    initMenuQRRuleta();
  }
})();

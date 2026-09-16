/**
 * Swaps the hero's CTA to name and link the visitor's own platform once the
 * page loads. Every `data-url-*`/`data-label-*` pair is filled at build time
 * with real release assets, so this script only ever picks among real links —
 * it never invents one. Falls back to the default "Baixar Slot2Sync" (linking
 * to #download) on mobile or when detection is inconclusive.
 */
(function () {
  var link = document.querySelector("[data-platform-cta]");
  if (!link) return;

  var ua = navigator.userAgent;
  var platform = navigator.platform || "";
  var id = null;

  if (/Windows/.test(ua) || /Win/.test(platform)) {
    id = "windows";
  } else if (/Macintosh/.test(ua) || /Mac/.test(platform)) {
    // The browser exposes no reliable Apple Silicon vs. Intel signal, so this
    // defaults to the common case and leaves a visible link to switch chip.
    id = "macArm";
  } else if (/Linux/.test(platform) && !/Android/.test(ua)) {
    id = "linux";
  }
  if (!id) return;

  var url = link.getAttribute("data-url-" + id);
  var label = link.getAttribute("data-label-" + id);
  if (!url || !label) return;

  link.setAttribute("href", url);
  link.textContent = label;

  if (id === "macArm") {
    var altSwitch = document.querySelector("[data-platform-alt]");
    var altUrl = link.getAttribute("data-url-macIntel");
    if (altSwitch && altUrl) {
      altSwitch.hidden = false;
      altSwitch.querySelector("a").setAttribute("href", altUrl);
    }
  }
})();

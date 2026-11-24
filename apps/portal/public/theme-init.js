// Applique le thème avant le premier rendu pour éviter un flash (script externe : compatible CSP stricte).
(function () {
  try {
    var stored = localStorage.getItem('tp-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    /* stockage indisponible : thème clair */
  }
})();

(function () {
  async function cargarLibreria(url, globalName) {
    if (window[globalName]) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  window.MAUPdfSplitter = { cargarLibreria };
})();

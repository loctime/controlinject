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

  async function dividirPdfPorRangos(file, mapeos) {
    await cargarLibreria("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js", "PDFLib");
    const bytes = await file.arrayBuffer();
    const src = await window.PDFLib.PDFDocument.load(bytes);
    const paginasTotales = src.getPageCount();
    const resultados = [];

    for (const map of mapeos) {
      const nuevo = await window.PDFLib.PDFDocument.create();
      const indices = [];
      for (let i = map.desde; i <= map.hasta; i++) {
        if (i >= 1 && i <= paginasTotales) indices.push(i - 1);
      }
      const pages = await nuevo.copyPages(src, indices);
      pages.forEach((p) => nuevo.addPage(p));
      const out = await nuevo.save();
      const etiqueta = (map.nombre || map.requerimiento || "parte").replace(/[/\\?%*:|"<>]/g, "-");
      resultados.push(
        new File([out], `${file.name.replace(/\.pdf$/i, "")}-${etiqueta}.pdf`, { type: "application/pdf" })
      );
    }
    return resultados;
  }

  /**
   * Fallback neutral: arma un bloque por pagina usando solo metadata generica.
   * El flujo principal de trabajo usa el mapeo visual guardado, no reglas de tipo.
   */
  function detectarBloques(textosPorPagina, _reglasOverride) {
    const orden = [...(textosPorPagina || [])].sort((a, b) => a.pagina - b.pagina);
    if (!orden.length) return [];
    return orden.map((p) => ({
      id: "pagina",
      familia: "pagina",
      metaClave: "",
      nombre: armarNombreBloque(p),
      desde: p.pagina,
      hasta: p.pagina,
      cuil: p.cuil || "",
      apellido: p.apellido || "",
      nombreEmp: p.nombre || "",
      patente: p.patente || "",
      periodo: p.periodo || "",
      desestimar: false
    }));
  }

  function armarNombreBloque(p) {
    const base = `Pagina ${p.pagina || ""}`.trim() || "Pagina";
    const extras = [];
    if (p.apellido || p.nombre) extras.push(`${p.apellido || ""} ${p.nombre || ""}`.trim());
    if (p.patente) extras.push(`patente ${p.patente}`);
    return extras.length ? `${base} â€” ${extras.join(" Â· ")}` : base;
  }

  window.MAUPdfSplitter = { dividirPdfPorRangos, detectarBloques, cargarLibreria };
})();

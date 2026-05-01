// ─────────────────────────────────────────────
//  mapeos.js — Gestión de mapeos + Mappear Nuevo
// ─────────────────────────────────────────────

const KEY_PATRON_ACTIVO = "controlinject_patron_activo";

// ── Estado global ──
let patrones = [];
let patronActivo = null;
let expandedCard = null; // nombre del patron con expand abierto

// ── Estado de "Mappear Nuevo" ──
let nuevoFile = null;
let nuevoImagenes = [];           // [{ pagina, base64 }] — todas las páginas renderizadas
let nuevoSeleccion = new Set();
let nuevoBloques = [];            // [{ id, nombre, paginas, requerimientos }]
let nuevoBloquesResaltados = new Set();
let nuevoUltimoClic = null;
let nuevoModoEdicion = null;      // { nombre, bloquesBase, controlStorageRef }
let sobresDisponibles = [];       // opciones del cmbSobre de CD
let nuevoPreviewCache = new Map(); // pagina -> dataUrl en alta resolucion para preview
let nuevoFuentes = [];
let nuevoPdfPreviewDisponible = false;

// ── Elementos DOM ──
const estadoEl = document.getElementById("estado");
const wsFilenameEl = document.getElementById("ws-filename");
const wsStatusEl = document.getElementById("ws-status");
const wsCambiarPdfEl = document.getElementById("ws-cambiar-pdf");

// ─────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────
function mostrar(msg, tipo) {
  estadoEl.textContent = msg;
  estadoEl.className = tipo || "";
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function normalizarDataUrlImagen(base64, mediaType = "image/jpeg") {
  const s = String(base64 || "");
  return s.startsWith("data:") ? s : `data:${mediaType};base64,${s}`;
}

function paginasAsignadas(exceptId = null) {
  const set = new Set();
  for (const b of nuevoBloques) {
    if (exceptId != null && b.id === exceptId) continue;
    (b.paginas || []).forEach(p => set.add(p));
  }
  return set;
}

function paginasDuplicadasEnBloques(bloques) {
  const vistas = new Set();
  const duplicadas = new Set();
  for (const b of bloques || []) {
    for (const p of b.paginas || []) {
      if (vistas.has(p)) duplicadas.add(p);
      vistas.add(p);
    }
  }
  return [...duplicadas].sort((a, b) => a - b);
}

function validarBloquesMapeo(bloques, { permitirSinRequerimiento = false } = {}) {
  const validos = (bloques || []).filter(b => (b.paginas || []).length > 0);
  if (!validos.length) return "Armá al menos un bloque con páginas antes de guardar.";

  const duplicadas = paginasDuplicadasEnBloques(validos);
  if (duplicadas.length) {
    return `Hay páginas asignadas a más de un bloque: ${duplicadas.join(", ")}. Cada página debe pertenecer a un solo bloque.`;
  }

  if (!permitirSinRequerimiento) {
    const sinReq = validos.filter(b => !(b.requerimientos || []).length);
    if (sinReq.length) {
      const nombres = sinReq.map(b => b.nombre || `Bloque ${b.id || ""}`.trim()).join(", ");
      return `Hay bloque(s) sin requerimientos: ${nombres}. Asigná al menos un requerimiento o eliminá esos bloques.`;
    }
  }

  return "";
}

function formatFecha(ts) {
  if (!ts) return null;
  try { return new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return null; }
}

function mapearBloquesParaWorkspace(bloques = [], { conservarPaginas = false } = {}) {
  return bloques.map((b, i) => ({
    id: i + 1,
    nombre: b.nombre || `Bloque ${i + 1}`,
    paginas: conservarPaginas ? [...(b.paginas || [])] : [],
    requerimientos: [...(b.requerimientos || [])],
    meta: { ...(b.meta || {}) }
  }));
}

function abrirWorkspaceConImagenes({ nombre, imagenes, bloques, status, fileLabel }) {
  nuevoFile = null;
  nuevoPdfPreviewDisponible = false;
  nuevoImagenes = Array.isArray(imagenes)
    ? imagenes
        .map((img, i) => ({
          pagina: Number(img?.pagina) || (i + 1),
          base64: img?.base64 || ""
        }))
        .filter(img => img.base64)
        .sort((a, b) => a.pagina - b.pagina)
    : [];
  nuevoSeleccion.clear();
  nuevoBloquesResaltados.clear();
  nuevoUltimoClic = null;
  nuevoPreviewCache.clear();
  nuevoBloques = Array.isArray(bloques) ? bloques : [];
  nuevoFuentes = fileLabel ? [fileLabel] : [];

  dropzone.style.display = "none";
  document.getElementById("nuevo-workspace").style.display = "flex";
  wsFilenameEl.textContent = fileLabel || nombre || "Referencia guardada";
  setWsStatus(status || `${nuevoImagenes.length} página(s) listas`);
  wsCambiarPdfEl.style.display = "";
  document.getElementById("ws-crear-bloque").disabled = true;
  document.getElementById("ws-save-status").textContent = "";
  document.getElementById("ws-save-status").className = "ws-save-status";

  renderThumbs();
  renderBloques();
  actualizarInfoSeleccion();
}

// ─────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.remove("active", "active-green");
  });
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const pane = document.getElementById(`tab-${tabName}`);
  if (!btn || !pane) return;

  if (tabName === "nuevo") {
    btn.classList.add("active-green");
  } else {
    btn.classList.add("active");
  }
  pane.classList.add("active");
}

// ─────────────────────────────────────────────
//  STORAGE
// ─────────────────────────────────────────────
async function leerPatronActivo() {
  const data = await chrome.storage.local.get(KEY_PATRON_ACTIVO);
  return data[KEY_PATRON_ACTIVO] || null;
}

async function guardarPatronActivo(nombre) {
  await chrome.storage.local.set({ [KEY_PATRON_ACTIVO]: nombre });
}

// ─────────────────────────────────────────────
//  MIS MAPEOS — carga y render de cards
// ─────────────────────────────────────────────
async function cargarPatrones({ sync = false } = {}) {
  if (sync) {
    try {
      mostrar("Sincronizando mapeos desde Firestore…", "");
      await chrome.runtime.sendMessage({ action: "firebase:syncDown" });
    } catch (e) {
      console.warn("[MAU][MAPEOS] No se pudo sincronizar desde Firestore; se usa caché local.", e);
    }
  }

  const [r, activo] = await Promise.all([
    chrome.runtime.sendMessage({ action: "storage:leerPatronesSabana" }),
    leerPatronActivo()
  ]);
  patrones = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
  patronActivo = activo;
  renderCards();
}

function renderCards() {
  const container = document.getElementById("cards-container");
  container.innerHTML = "";

  if (!patrones.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>No tenés mapeos guardados</strong>
        <p>Creá uno en la pestaña "+ Mappear Nuevo" o importá uno existente.</p>
      </div>`;
    return;
  }

  for (const p of patrones) {
    const nombre = p.nombre || "(sin nombre)";
    const bloques = Array.isArray(p.bloquesModal) ? p.bloquesModal : [];
    const totalPags = p.totalPaginas || bloques.reduce((acc, b) => acc + (b.paginas?.length || 0), 0);
    const fecha = formatFecha(p.updatedAt || p.createdAt);
    const esActivo = nombre === patronActivo;
    const estaExpanded = expandedCard === nombre;

    const wrap = document.createElement("div");
    wrap.className = "card-wrap";

    // ── Card principal ──
    const card = document.createElement("article");
    card.className = "card" + (esActivo ? " card-active" : "") + (estaExpanded ? " card-expanded" : "");

    card.innerHTML = `
      <div class="card-title">
        ${escapeHtml(nombre)}
        ${esActivo ? '<span class="badge-active">Activo</span>' : ""}
      </div>
      <div class="card-meta">
        ${fecha ? `<span>Actualizado: ${fecha}</span>` : ""}
        <span>${bloques.length} bloque(s) · ${totalPags} página(s)</span>
      </div>
      <div class="chips">
        ${bloques.slice(0, 8).map(b => `<span class="chip">${escapeHtml(b.nombre || "Bloque")}</span>`).join("")}
        ${bloques.length > 8 ? `<span class="chip">+${bloques.length - 8} más</span>` : ""}
      </div>
      <div class="card-actions">
        ${!esActivo ? `<button class="alt sm btn-activar" data-nombre="${escapeHtml(nombre)}">Usar</button>` : ""}
        <button class="sm btn-remapear" data-nombre="${escapeHtml(nombre)}">✏ Editar mapeo</button>
        <button class="alt sm btn-exportar" data-nombre="${escapeHtml(nombre)}">Exportar</button>
        <button class="danger sm btn-eliminar" data-nombre="${escapeHtml(nombre)}">Eliminar</button>
      </div>`;

    // Eventos de la card
    card.querySelector(".btn-activar")?.addEventListener("click", async () => {
      await guardarPatronActivo(nombre);
      mostrar(`"${nombre}" marcado como activo.`, "ok");
      await cargarPatrones();
    });

    card.querySelector(".btn-remapear").addEventListener("click", () => {
      abrirRemapear(p);
    });

    card.querySelector(".btn-exportar").addEventListener("click", () => exportarPatron(nombre, p));
    card.querySelector(".btn-eliminar").addEventListener("click", () => eliminarPatron(nombre));

    wrap.appendChild(card);

    // ── Panel expandido de edición ──
    if (estaExpanded) {
      wrap.appendChild(buildExpandPanel(nombre, p));
    }

    container.appendChild(wrap);
  }
}

// ─────────────────────────────────────────────
//  CARD EXPAND — edición inline de bloques
// ─────────────────────────────────────────────
function buildExpandPanel(nombrePatron, patron) {
  const bloques = Array.isArray(patron.bloquesModal) ? patron.bloquesModal : [];
  const panel = document.createElement("div");
  panel.className = "card-expand";
  let imagenesRef = [];
  let cargandoImagenes = false;
  let intentoCargarImagenes = false;

  // Estado local para edición
  const editBloques = bloques.map(b => ({
    nombre: b.nombre || "Bloque",
    paginas: [...(b.paginas || [])],
    requerimientos: [...(b.requerimientos || [])],
    meta: b.meta || {}
  }));

  function render() {
    panel.innerHTML = "";

    if (!editBloques.length) {
      panel.innerHTML = `<p style="font-size:12px;color:var(--muted);">Este mapeo no tiene bloques. Usá "Re-mapear" para asignar páginas.</p>`;
    }

    for (let i = 0; i < editBloques.length; i++) {
      const b = editBloques[i];
      const div = document.createElement("div");
      div.className = "expand-bloque";

      const reqsHtml = b.requerimientos.map((r, ri) => `
        <span class="req-chip">
          ${escapeHtml(r)}
          <button class="req-chip-del" data-bi="${i}" data-ri="${ri}" title="Quitar">×</button>
        </span>`).join("");

      div.innerHTML = `
        <div class="expand-bloque-header">
          <strong>Bloque ${i + 1}</strong>
          <input type="text" class="edit-nombre" data-i="${i}" value="${escapeHtml(b.nombre)}" />
        </div>
        <div class="expand-pags">Páginas: ${b.paginas.length ? b.paginas.join(", ") : "(sin asignar)"}</div>
        ${renderPreviewBloque(b, i)}
        <div class="expand-reqs" id="expand-reqs-${i}">
          ${reqsHtml}
          <div class="expand-add-req">
            <input type="text" class="add-req-input" data-i="${i}" placeholder="Agregar requerimiento…" list="dl-sobres" autocomplete="off" />
            <button class="alt sm btn-add-req" data-i="${i}">+</button>
          </div>
        </div>`;

      panel.appendChild(div);
    }

    // Eventos
    panel.querySelectorAll(".edit-nombre").forEach(inp => {
      inp.addEventListener("input", () => {
        editBloques[parseInt(inp.dataset.i)].nombre = inp.value;
      });
    });

    panel.querySelectorAll(".req-chip-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const bi = parseInt(btn.dataset.bi);
        const ri = parseInt(btn.dataset.ri);
        editBloques[bi].requerimientos.splice(ri, 1);
        render();
      });
    });

    panel.querySelectorAll(".btn-add-req").forEach(btn => {
      btn.addEventListener("click", () => agregarReqInline(parseInt(btn.dataset.i)));
    });

    panel.querySelectorAll(".add-req-input").forEach(inp => {
      inp.addEventListener("keydown", e => {
        if (e.key === "Enter") agregarReqInline(parseInt(inp.dataset.i));
      });
    });

    panel.querySelectorAll(".expand-page-thumb").forEach(btn => {
      btn.addEventListener("click", () => {
        const pagina = parseInt(btn.dataset.pagina, 10);
        const img = imagenesRef.find(x => x.pagina === pagina);
        if (!img?.base64) return;
        abrirPreviewPagina(normalizarDataUrlImagen(img.base64), pagina);
      });
    });
    // Botones de acción al final
    const acciones = document.createElement("div");
    acciones.className = "expand-actions";
    acciones.innerHTML = `
      <button class="alt sm" id="expand-cancelar">Cancelar</button>
      <button class="green sm" id="expand-guardar">Guardar cambios</button>`;
    panel.appendChild(acciones);

    panel.querySelector("#expand-cancelar").addEventListener("click", () => {
      expandedCard = null;
      renderCards();
    });

    panel.querySelector("#expand-guardar").addEventListener("click", () => guardarEdicionCard(nombrePatron, editBloques, patron));
  }

  function agregarReqInline(bi) {
    const inp = panel.querySelector(`.add-req-input[data-i="${bi}"]`);
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) return;
    if (!editBloques[bi].requerimientos.includes(val)) {
      editBloques[bi].requerimientos.push(val);
    }
    inp.value = "";
    render();
  }

  function renderPreviewBloque(b, idx) {
    if (!b.paginas.length) return "";
    if (cargandoImagenes) {
      return `<div class="expand-pages-preview muted">Cargando vistas de páginas…</div>`;
    }
    if (!imagenesRef.length) {
      const msg = intentoCargarImagenes
        ? "No hay imágenes guardadas para este mapeo. Usá Re-mapear para regenerar la referencia visual."
        : "Preparando vistas de páginas…";
      return `<div class="expand-pages-preview muted">${msg}</div>`;
    }

    const html = b.paginas.map(pag => {
      const img = imagenesRef.find(x => x.pagina === pag);
      if (!img?.base64) return `<span class="expand-page-missing">Pág. ${pag}</span>`;
      return `
        <button type="button" class="expand-page-thumb" data-bloque="${idx}" data-pagina="${pag}" title="Ver página ${pag}">
          <span class="expand-page-doc">
            <img src="${normalizarDataUrlImagen(img.base64)}" alt="Página ${pag}" />
          </span>
          <span>Pág. ${pag}</span>
        </button>`;
    }).join("");

    return `<div class="expand-pages-preview">${html}</div>`;
  }

  async function cargarImagenesReferencia() {
    if (intentoCargarImagenes || cargandoImagenes) return;
    cargandoImagenes = true;
    intentoCargarImagenes = true;
    render();
    try {
      const r = await chrome.runtime.sendMessage({
        action: "storage:descargarImagenesPatronRemoto",
        payload: {
          nombre: nombrePatron,
          controlStorageRef: patron.controlStorageRef || null
        }
      });
      imagenesRef = Array.isArray(r?.data?.imagenes) ? r.data.imagenes : [];
    } catch (e) {
      console.warn(`[MAU][MAPEOS] No se pudieron cargar imágenes de "${nombrePatron}"`, e);
      imagenesRef = [];
    } finally {
      cargandoImagenes = false;
      render();
    }
  }

  render();
  cargarImagenesReferencia();
  return panel;
}

async function guardarEdicionCard(nombrePatron, editBloques, patronOriginal) {
  mostrar("Guardando cambios…", "");
  try {
    const bloquesActualizados = editBloques.map(b => ({
      nombre: b.nombre,
      paginas: b.paginas,
      requerimientos: b.requerimientos,
      meta: b.meta
    }));

    const errorValidacion = validarBloquesMapeo(bloquesActualizados);
    if (errorValidacion) throw new Error(errorValidacion);

    mostrar("Actualizando referencia remota…", "");
    const refRemota = await chrome.runtime.sendMessage({
      action: "storage:descargarImagenesPatronRemoto",
      payload: { nombre: nombrePatron }
    });
    const imagenesRef = refRemota?.data?.imagenes || [];
    if (!refRemota?.ok || !imagenesRef.length) {
      throw new Error(refRemota?.error || "No se encontraron imágenes remotas para actualizar este mapeo.");
    }

    const rImg = await chrome.runtime.sendMessage({
      action: "storage:guardarImagenesPatronRemoto",
      payload: {
        nombre: nombrePatron,
        imagenes: imagenesRef,
        bloques: bloquesActualizados
      }
    });
    if (!rImg?.ok) throw new Error(rImg?.error || "No se pudo actualizar la referencia remota.");

    const payload = {
      nombre: nombrePatron,
      bloquesModal: bloquesActualizados,
      firmaTipos: patronOriginal.firmaTipos || [],
      totalPaginas: patronOriginal.totalPaginas || 0,
      controlStorageRef: rImg.data?.controlStorageRef || patronOriginal.controlStorageRef || null
    };

    const r = await chrome.runtime.sendMessage({ action: "storage:guardarPatronSabana", payload });
    if (!r?.ok) throw new Error(r?.error || "Error guardando");

    mostrar(`"${nombrePatron}" actualizado.`, "ok");
    expandedCard = null;
    await cargarPatrones();
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
}

// ─────────────────────────────────────────────
//  RE-MAPEAR (abre tab Nuevo con patrón e imágenes pre-cargadas)
// ─────────────────────────────────────────────
async function abrirRemapear(patron) {
  const bloques = Array.isArray(patron.bloquesModal) ? patron.bloquesModal : [];
  nuevoModoEdicion = {
    nombre: patron.nombre,
    controlStorageRef: patron.controlStorageRef || null,
    bloquesBase: mapearBloquesParaWorkspace(bloques, { conservarPaginas: true })
  };

  document.getElementById("nuevo-nombre").value = patron.nombre || "";
  resetearWorkspace();
  switchTab("nuevo");
  mostrar(`Abriendo "${patron.nombre}"…`, "");

  try {
    const r = await chrome.runtime.sendMessage({
      action: "storage:descargarImagenesPatronRemoto",
      payload: {
        nombre: patron.nombre,
        controlStorageRef: patron.controlStorageRef || null
      }
    });
    const imagenes = Array.isArray(r?.data?.imagenes) ? r.data.imagenes : [];
    if (!r?.ok || !imagenes.length) {
      throw new Error(r?.error || "No se encontraron imágenes guardadas para este mapeo.");
    }

    abrirWorkspaceConImagenes({
      nombre: patron.nombre,
      imagenes,
      bloques: mapearBloquesParaWorkspace(bloques, { conservarPaginas: true }),
      fileLabel: `${patron.nombre} · referencia guardada`,
      status: `${imagenes.length} página(s) restauradas`
    });
    mostrar(`"${patron.nombre}" listo para editar.`, "ok");
  } catch (e) {
    // Mostrar workspace con bloques pero sin imágenes — el usuario puede subir el PDF manualmente
    abrirWorkspaceConImagenes({
      nombre: patron.nombre,
      imagenes: [],
      bloques: mapearBloquesParaWorkspace(bloques, { conservarPaginas: true }),
      fileLabel: patron.nombre,
      status: `Subí el PDF de referencia para ver páginas`
    });
    mostrar(`No se encontraron páginas guardadas. Subí el PDF de sábana para reasignar páginas.`, "err");
  }
}

// ─────────────────────────────────────────────
//  EXPORTAR / ELIMINAR
// ─────────────────────────────────────────────
function exportarPatron(nombre, patron) {
  const datos = {
    version: 1,
    exportadoEl: new Date().toISOString(),
    patrones_sabana: [patron],
    mapeos_aprendidos: {}
  };
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mapeo-${nombre.replace(/[^a-zA-Z0-9_-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  mostrar(`"${nombre}" exportado.`, "ok");
}

async function eliminarPatron(nombre) {
  if (!confirm(`¿Eliminar el mapeo "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    mostrar(`Eliminando "${nombre}"…`, "");
    const r = await chrome.runtime.sendMessage({
      action: "storage:eliminarPatronSabana",
      payload: { nombre }
    });
    if (!r?.ok) throw new Error(r?.error || "No se pudo eliminar.");
    if (patronActivo === nombre) await guardarPatronActivo(null);
    if (expandedCard === nombre) expandedCard = null;
    const storage = r.data?.storage;
    if (storage && storage.ok === false) {
      mostrar(`"${nombre}" eliminado de Firestore. No se pudo borrar el archivo remoto: ${storage.error}`, "err");
    } else {
      mostrar(`"${nombre}" eliminado.`, "ok");
    }
    await cargarPatrones({ sync: true });
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
}
// ─────────────────────────────────────────────
//  IMPORTAR
// ─────────────────────────────────────────────
document.getElementById("btn-importar").addEventListener("click", () => {
  document.getElementById("input-importar").click();
});

document.getElementById("input-importar").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    mostrar("Importando mapeo…", "");
    const datos = JSON.parse(await file.text());
    const r = await chrome.runtime.sendMessage({ action: "storage:importarMapeo", payload: datos });
    if (!r?.ok) throw new Error(r?.error || "No se pudo importar.");
    mostrar(`Importado: ${r.data.patrones} patrón(es), ${r.data.mapeos} mapeo(s).`, "ok");
    await cargarPatrones();
  } catch (e) {
    mostrar(`Error al importar: ${e.message}`, "err");
  }
  e.target.value = "";
});

// ─────────────────────────────────────────────
//  SOBRES — carga desde CD y datalist
// ─────────────────────────────────────────────
async function cargarSobres() {
  try {
    const r = await chrome.runtime.sendMessage({ action: "mapeos:getSobres" });
    sobresDisponibles = Array.isArray(r?.data) ? r.data : [];
    const dl = document.getElementById("dl-sobres");
    dl.innerHTML = sobresDisponibles.map(s => `<option value="${escapeHtml(s)}"></option>`).join("");
  } catch {
    // sin pestaña CD abierta — los inputs quedan libres igual
  }
}

// ─────────────────────────────────────────────
//  MAPPEAR NUEVO — setup de controles
// ─────────────────────────────────────────────
const dropzone = document.getElementById("nuevo-dropzone");
const fileInput = document.getElementById("nuevo-file-input");

document.getElementById("nuevo-btn-pdf").addEventListener("click", () => fileInput.click());
document.getElementById("ws-cambiar-pdf").addEventListener("click", () => {
  if (nuevoImagenes.length) {
    const ok = confirm("Cambiar PDF va a limpiar las páginas y bloques del mapeo actual. ¿Querés continuar?");
    if (!ok) return;
  }
  resetearWorkspace();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const files = [...(fileInput.files || [])].filter(f => /\.pdf$/i.test(f.name));
  if (files.length) manejarCargaPrincipalArchivos(files);
  fileInput.value = "";
});

// Drag & drop en el dropzone
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const files = [...(e.dataTransfer.files || [])];
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name));
  if (pdfs.length === 1) cargarPDF(pdfs[0]);
  else if (pdfs.length > 1) cargarMultiplesPDF(pdfs);
  else if (files.length) mostrar("Solo se aceptan archivos PDF.", "err");
});

document.getElementById("ws-crear-bloque").addEventListener("click", crearBloqueConSeleccion);
document.getElementById("ws-btn-guardar").addEventListener("click", guardarNuevoMapeo);

// ─────────────────────────────────────────────
//  CARGAR PDF → renderizar thumbnails
// ─────────────────────────────────────────────
async function cargarPDF(file) {
  nuevoFile = file;
  nuevoPdfPreviewDisponible = true;
  nuevoSeleccion.clear();
  nuevoBloquesResaltados.clear();
  nuevoBloques = [];
  nuevoPreviewCache.clear();
  nuevoFuentes = [file.name];

  if (nuevoModoEdicion?.bloquesBase?.length) {
    nuevoBloques = mapearBloquesParaWorkspace(nuevoModoEdicion.bloquesBase, { conservarPaginas: false });
  }

  dropzone.style.display = "none";
  const workspace = document.getElementById("nuevo-workspace");
  workspace.style.display = "flex";

  wsFilenameEl.textContent = file.name;
  wsCambiarPdfEl.style.display = "";
  setWsStatus("Renderizando páginas…");
  document.getElementById("ws-crear-bloque").disabled = true;
  renderBloques();

  try {
    nuevoImagenes = await renderizarPdfEnImagenes(file, { pageOffset: 0 });

    setWsStatus(`${nuevoImagenes.length} página(s) listas`);
    renderThumbs();
    renderBloques();

  } catch (e) {
    setWsStatus("Error: " + e.message);
    mostrar("No se pudo renderizar el PDF: " + e.message, "err");
  }
}

async function manejarCargaPrincipalArchivos(files) {
  const pdfs = (files || []).filter(f => /\.pdf$/i.test(f.name));
  if (!pdfs.length) return;

  if (nuevoImagenes.length) {
    await agregarArchivosAlMapeo(pdfs);
    return;
  }

  if (pdfs.length === 1) {
    await cargarPDF(pdfs[0]);
    return;
  }

  await cargarMultiplesPDF(pdfs);
}

async function cargarMultiplesPDF(files) {
  const pdfs = (files || []).filter(f => /\.pdf$/i.test(f.name));
  if (!pdfs.length) return;
  if (pdfs.length === 1) {
    await cargarPDF(pdfs[0]);
    return;
  }

  nuevoFile = null;
  nuevoPdfPreviewDisponible = false;
  nuevoSeleccion.clear();
  nuevoBloques = [];
  nuevoPreviewCache.clear();
  nuevoFuentes = pdfs.map(f => f.name);

  if (nuevoModoEdicion?.bloquesBase?.length) {
    nuevoBloques = mapearBloquesParaWorkspace(nuevoModoEdicion.bloquesBase, { conservarPaginas: false });
  }

  dropzone.style.display = "none";
  const workspace = document.getElementById("nuevo-workspace");
  workspace.style.display = "flex";

  wsFilenameEl.textContent = `${pdfs.length} archivo(s) seleccionados`;
  wsCambiarPdfEl.style.display = "";
  setWsStatus("Preparando archivos…");
  document.getElementById("ws-crear-bloque").disabled = true;
  renderBloques();

  try {
    nuevoImagenes = [];
    let offset = 0;
    for (let i = 0; i < pdfs.length; i++) {
      const file = pdfs[i];
      const imgs = await renderizarPdfEnImagenes(file, {
        pageOffset: offset,
        statusPrefix: `Renderizando ${file.name}`
      });
      nuevoImagenes.push(...imgs);
      offset += imgs.length;
      setWsStatus(`Procesados ${i + 1} de ${pdfs.length} archivo(s)…`);
    }

    wsFilenameEl.textContent = `${pdfs.length} archivo(s) en la referencia`;
    setWsStatus(`${nuevoImagenes.length} página(s) listas`);
    renderThumbs();
    renderBloques();
    actualizarInfoSeleccion();
    mostrar(`${pdfs.length} archivos cargados en una sola referencia.`, "ok");
  } catch (e) {
    setWsStatus("Error: " + e.message);
    mostrar("No se pudieron cargar los PDFs: " + e.message, "err");
  }
}

async function agregarArchivosAlMapeo(files) {
  if (!nuevoImagenes.length) {
    mostrar("Primero subí archivos o abrí un mapeo.", "err");
    return;
  }

  const pdfs = (files || []).filter(f => /\.pdf$/i.test(f.name));
  if (!pdfs.length) return;

  try {
    const paginaBase = nuevoImagenes.reduce((max, img) => Math.max(max, Number(img?.pagina) || 0), 0);
    let offset = paginaBase;
    const nuevasImagenes = [];
    nuevoPdfPreviewDisponible = false;
    nuevoFile = null;

    for (let i = 0; i < pdfs.length; i++) {
      const file = pdfs[i];
      setWsStatus(`Agregando archivo ${i + 1} de ${pdfs.length}: ${file.name}…`);
      const imgs = await renderizarPdfEnImagenes(file, {
        pageOffset: offset,
        statusPrefix: `Agregando ${file.name}`
      });
      nuevasImagenes.push(...imgs);
      offset += imgs.length;
      nuevoFuentes.push(file.name);
    }

    nuevoImagenes = [...nuevoImagenes, ...nuevasImagenes].sort((a, b) => a.pagina - b.pagina);
    wsFilenameEl.textContent =
      nuevoFuentes.length === 1 ? nuevoFuentes[0] : `${nuevoFuentes.length} archivo(s) en la referencia`;
    setWsStatus(`${nuevoImagenes.length} página(s) listas`);
    renderThumbs();
    renderBloques();
    actualizarInfoSeleccion();
    mostrar(`${pdfs.length} archivo(s) agregado(s) al mapeo.`, "ok");
  } catch (e) {
    setWsStatus("Error: " + e.message);
    mostrar("No se pudieron agregar los archivos: " + e.message, "err");
  }
}

async function renderizarPdfEnImagenes(file, { pageOffset = 0, statusPrefix = "Renderizando" } = {}) {
  if (window.pdfjsLib?.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
  }

  const ab = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  try {
    const imagenes = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      setWsStatus(`${statusPrefix}: página ${i} de ${pdf.numPages}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      imagenes.push({
        pagina: pageOffset + i,
        base64: canvas.toDataURL("image/jpeg", 0.82).split(",")[1]
      });
    }
    return imagenes;
  } finally {
    try { pdf.destroy(); } catch {}
  }
}

function setWsStatus(msg) {
  wsStatusEl.textContent = msg;
}

function resetearWorkspace() {
  nuevoFile = null;
  nuevoImagenes = [];
  nuevoFuentes = [];
  nuevoPdfPreviewDisponible = false;
  nuevoPreviewCache.clear();
  nuevoSeleccion.clear();
  nuevoBloquesResaltados.clear();
  nuevoBloques = [];
  nuevoUltimoClic = null;

  dropzone.style.display = "flex";
  document.getElementById("nuevo-workspace").style.display = "none";
  wsFilenameEl.textContent = "";
  wsStatusEl.textContent = "";
  wsCambiarPdfEl.style.display = "none";
  document.getElementById("ws-thumbs-grid").innerHTML = "";
  document.getElementById("ws-bloques-list").innerHTML = "";
  document.getElementById("ws-sel-info").textContent = "Seleccioná páginas a la izquierda";
  document.getElementById("ws-crear-bloque").disabled = true;
  document.getElementById("ws-save-status").textContent = "";
  document.getElementById("ws-save-status").className = "ws-save-status";

  if (!nuevoModoEdicion) {
    document.getElementById("nuevo-nombre").value = "";
  }
}

// ─────────────────────────────────────────────
//  THUMBNAILS
// ─────────────────────────────────────────────
function renderThumbs() {
  const grid = document.getElementById("ws-thumbs-grid");
  grid.innerHTML = "";

  if (!nuevoImagenes.length) {
    const msg = document.createElement("p");
    msg.style.cssText = "color:var(--muted);font-size:12px;padding:8px 4px;grid-column:1/-1;";
    msg.textContent = `Usá "Cambiar PDF" para cargar el PDF de referencia y ver las páginas.`;
    grid.appendChild(msg);
    refrescarThumbsVisual();
    return;
  }

  for (const { pagina, base64 } of nuevoImagenes) {
    const div = document.createElement("div");
    div.className = "thumb";
    div.dataset.pagina = pagina;

    const doc = document.createElement("div");
    doc.className = "thumb-doc";

    const badge = document.createElement("span");
    badge.className = "thumb-badge";

    const img = document.createElement("img");
    img.src = `data:image/jpeg;base64,${base64}`;
    img.alt = `Página ${pagina}`;

    const eyeBtn = document.createElement("button");
    eyeBtn.className = "thumb-eye";
    eyeBtn.type = "button";
    eyeBtn.title = "Ver página completa";
    eyeBtn.innerHTML = "&#128065;";
    eyeBtn.addEventListener("click", e => {
      e.stopPropagation();
      abrirPreviewPagina(`data:image/jpeg;base64,${base64}`, pagina);
    });

    doc.appendChild(badge);
    doc.appendChild(img);
    doc.appendChild(eyeBtn);

    const num = document.createElement("span");
    num.className = "thumb-num";
    num.textContent = pagina;

    const tag = document.createElement("div");
    tag.className = "thumb-tag";
    tag.textContent = "";

    div.appendChild(doc);
    div.appendChild(num);
    div.appendChild(tag);

    div.addEventListener("click", e => manejarClicThumb(e, pagina));
    grid.appendChild(div);
  }

  refrescarThumbsVisual();
}

async function renderizarPaginaPreview(pagina) {
  if (nuevoPreviewCache.has(pagina)) return nuevoPreviewCache.get(pagina);
  if (!nuevoPdfPreviewDisponible || !nuevoFile) {
    const img = nuevoImagenes.find(x => x.pagina === pagina);
    if (img?.base64) {
      const dataUrl = normalizarDataUrlImagen(img.base64);
      nuevoPreviewCache.set(pagina, dataUrl);
      return dataUrl;
    }
    throw new Error("No hay PDF cargado.");
  }

  if (window.pdfjsLib?.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");
  }

  const ab = await nuevoFile.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  try {
    const page = await pdf.getPage(pagina);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    nuevoPreviewCache.set(pagina, dataUrl);
    return dataUrl;
  } finally {
    try { pdf.destroy(); } catch {}
  }
}

function abrirPreviewPagina(dataUrl, pagina) {
  const bloquesDeEsta = nuevoBloques.filter(b => b.paginas.includes(pagina));
  const label = bloquesDeEsta.length
    ? bloquesDeEsta.map(b => b.nombre).join(" · ")
    : "Sin bloque asignado";

  const overlay = document.createElement("div");
  overlay.className = "thumb-preview-overlay";
  overlay.innerHTML = `
    <div class="thumb-preview-img-wrap">
      <img src="${dataUrl}" alt="Página ${pagina}" />
    </div>
    <div class="thumb-preview-toolbar">
      <button class="thumb-zoom-out" title="Alejar">−</button>
      <span class="thumb-preview-zoom-label">100%</span>
      <button class="thumb-zoom-in" title="Acercar">+</button>
      <button class="thumb-zoom-reset" title="Restablecer">⟳</button>
    </div>
    <button class="thumb-preview-close" title="Cerrar">&times;</button>
    <div class="thumb-preview-label">Página ${pagina} — ${escapeHtml(label)}</div>
    <div class="thumb-preview-status">Cargando vista nítida…</div>
  `;

  const wrap = overlay.querySelector(".thumb-preview-img-wrap");
  const img = overlay.querySelector("img");
  const lbl = overlay.querySelector(".thumb-preview-zoom-label");
  const status = overlay.querySelector(".thumb-preview-status");
  let scale = 1;
  let tx = 0;
  let ty = 0;

  function aplicar(animate) {
    img.style.transition = animate ? "transform .15s" : "none";
    img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    lbl.textContent = Math.round(scale * 100) + "%";
  }

  function cambiarZoom(delta, cx = 0, cy = 0) {
    const prev = scale;
    scale = Math.min(8, Math.max(0.2, scale * (1 + delta)));
    const r = scale / prev;
    tx = cx + (tx - cx) * r;
    ty = cy + (ty - cy) * r;
    aplicar(false);
  }

  overlay.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    cambiarZoom(e.deltaY < 0 ? 0.15 : -0.15, cx, cy);
  }, { passive: false });

  overlay.querySelector(".thumb-zoom-in").addEventListener("click", e => {
    e.stopPropagation();
    cambiarZoom(0.25);
  });
  overlay.querySelector(".thumb-zoom-out").addEventListener("click", e => {
    e.stopPropagation();
    cambiarZoom(-0.25);
  });
  overlay.querySelector(".thumb-zoom-reset").addEventListener("click", e => {
    e.stopPropagation();
    scale = 1;
    tx = 0;
    ty = 0;
    aplicar(true);
  });

  let drag = null;
  wrap.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX - tx, y: e.clientY - ty };
    wrap.classList.add("dragging");
  });

  function onMouseMove(e) {
    if (!drag) return;
    tx = e.clientX - drag.x;
    ty = e.clientY - drag.y;
    aplicar(false);
  }

  function onMouseUp() {
    drag = null;
    wrap.classList.remove("dragging");
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  function cerrar() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }
  function onKey(e) {
    if (e.key === "Escape") cerrar();
  }

  overlay.querySelector(".thumb-preview-close").addEventListener("click", cerrar);
  overlay.addEventListener("click", ev => {
    if (ev.target === overlay) cerrar();
  });
  document.addEventListener("keydown", onKey);

  img.onload = () => {
    const fitScale = Math.min(
      (window.innerWidth * 0.88) / img.naturalWidth,
      (window.innerHeight * 0.88) / img.naturalHeight,
      1
    );
    scale = fitScale;
    tx = 0;
    ty = 0;
    aplicar(false);
  };

  document.body.appendChild(overlay);

  renderizarPaginaPreview(pagina)
    .then(previewUrl => {
      if (!document.body.contains(overlay)) return;
      if (img.src !== previewUrl) {
        img.src = previewUrl;
        scale = 1;
        tx = 0;
        ty = 0;
      }
      if (status) status.remove();
    })
    .catch(err => {
      if (!document.body.contains(overlay) || !status) return;
      status.textContent = "No se pudo mejorar la vista: " + err.message;
    });
}

function manejarClicThumb(e, pagina) {
  const asignadas = paginasAsignadas();
  const bloquesDeEsta = nuevoBloques.filter(b => b.paginas.includes(pagina));

  if (bloquesDeEsta.length) {
    nuevoBloquesResaltados = new Set(bloquesDeEsta.map(b => b.id));
    nuevoSeleccion.clear();
    nuevoUltimoClic = pagina;
    refrescarThumbsVisual();
    actualizarInfoSeleccion();
    renderBloques();
    desplazarABloqueResaltado();
    return;
  }

  nuevoBloquesResaltados.clear();

  if (e.shiftKey && nuevoUltimoClic != null) {
    const desde = Math.min(nuevoUltimoClic, pagina);
    const hasta = Math.max(nuevoUltimoClic, pagina);
    for (let i = desde; i <= hasta; i++) {
      if (!asignadas.has(i)) nuevoSeleccion.add(i);
    }
  } else if (e.ctrlKey || e.metaKey) {
    if (asignadas.has(pagina)) return;
    if (nuevoSeleccion.has(pagina)) nuevoSeleccion.delete(pagina);
    else nuevoSeleccion.add(pagina);
  } else {
    // toggle simple
    if (asignadas.has(pagina)) return;
    if (nuevoSeleccion.has(pagina)) nuevoSeleccion.delete(pagina);
    else nuevoSeleccion.add(pagina);
  }
  nuevoUltimoClic = pagina;
  refrescarThumbsVisual();
  actualizarInfoSeleccion();
}

function refrescarThumbsVisual() {
  document.querySelectorAll(".thumb").forEach(el => {
    const pag = parseInt(el.dataset.pagina, 10);
    const sel = nuevoSeleccion.has(pag);
    el.classList.toggle("selected", sel);

    const bloquesDeEsta = nuevoBloques.filter(b => b.paginas.includes(pag));
    el.classList.toggle("assigned", bloquesDeEsta.length > 0 && !sel);
    el.classList.toggle("focused", bloquesDeEsta.some(b => nuevoBloquesResaltados.has(b.id)));
    if (bloquesDeEsta.length > 0 && sel) {
      nuevoSeleccion.delete(pag);
      el.classList.remove("selected");
      el.classList.add("assigned");
    }

    const badge = el.querySelector(".thumb-badge");
    if (badge) badge.textContent = "\u2713";

    const tag = el.querySelector(".thumb-tag");
    if (bloquesDeEsta.length > 0) {
      tag.textContent = bloquesDeEsta.map(b => b.nombre).join(" · ");
      tag.style.color = "var(--green)";
    } else {
      tag.textContent = "";
      tag.style.color = "";
    }
  });
}

function actualizarInfoSeleccion() {
  const n = nuevoSeleccion.size;
  const resaltados = nuevoBloques.filter(b => nuevoBloquesResaltados.has(b.id));
  document.getElementById("ws-sel-info").textContent =
    resaltados.length
      ? `Bloque resaltado: ${resaltados.map(b => b.nombre).join(" · ")}`
      : n === 0
        ? "Seleccioná páginas a la izquierda"
        : `${n} página(s) seleccionada(s): ${[...nuevoSeleccion].sort((a, b) => a - b).join(", ")}`;
  document.getElementById("ws-crear-bloque").disabled = n === 0;
}

// ─────────────────────────────────────────────
//  BLOQUES
// ─────────────────────────────────────────────
function siguienteId() {
  const usados = new Set(nuevoBloques.map(b => b.id));
  let n = 1;
  while (usados.has(n)) n++;
  return n;
}

function crearBloqueConSeleccion() {
  if (!nuevoSeleccion.size) return;
  const asignadas = paginasAsignadas();
  const paginas = [...nuevoSeleccion].filter(p => !asignadas.has(p)).sort((a, b) => a - b);
  if (!paginas.length) {
    nuevoSeleccion.clear();
    refrescarThumbsVisual();
    actualizarInfoSeleccion();
    mostrar("Las páginas seleccionadas ya pertenecen a otro bloque.", "err");
    return;
  }
  const id = siguienteId();
  nuevoBloquesResaltados.clear();
  nuevoBloques.push({
    id,
    nombre: `Bloque ${id}`,
    paginas,
    requerimientos: []
  });
  nuevoSeleccion.clear();
  refrescarThumbsVisual();
  actualizarInfoSeleccion();
  renderBloques();
}

function renderBloques() {
  const lista = document.getElementById("ws-bloques-list");
  lista.innerHTML = "";

  if (!nuevoBloques.length) {
    lista.innerHTML = `<div style="font-size:11px;color:var(--muted);padding:4px 0;">Seleccioná páginas y apretá "+ Crear bloque".</div>`;
    return;
  }

  for (const b of nuevoBloques) {
    const div = document.createElement("div");
    div.className = "ws-bloque";
    div.dataset.id = b.id;

    const activo = b.paginas.some(p => nuevoSeleccion.has(p));
    if (activo) div.classList.add("active");
    if (nuevoBloquesResaltados.has(b.id)) div.classList.add("focused");

    const reqsHtml = b.requerimientos.map((r, ri) => `
      <span class="req-chip" style="font-size:11px;">
        ${escapeHtml(r)}
        <button class="req-chip-del" data-bid="${b.id}" data-ri="${ri}" title="Quitar">×</button>
      </span>`).join("");

    div.innerHTML = `
      <div class="ws-bloque-header">
        <strong>#${b.id}</strong>
        <input type="text" class="bloque-nombre" data-bid="${b.id}" value="${escapeHtml(b.nombre)}" />
        <button class="ws-bloque-del" data-bid="${b.id}" title="Eliminar bloque">✕</button>
      </div>
      <div class="ws-pags">${b.paginas.length ? "Páginas: " + b.paginas.join(", ") : "Sin páginas asignadas"}</div>
      <div class="ws-reqs-label">Requerimientos:</div>
      <div class="ws-reqs-chips">${reqsHtml}</div>
      <div class="ws-add-req">
        <input type="text" class="bloque-add-req" data-bid="${b.id}" placeholder="Nombre del requerimiento…" list="dl-sobres" autocomplete="off" />
        <button class="alt sm bloque-btn-add-req" data-bid="${b.id}">+</button>
      </div>`;

    lista.appendChild(div);
  }

  // Eventos
  lista.querySelectorAll(".bloque-nombre").forEach(inp => {
    inp.addEventListener("input", () => {
      const b = nuevoBloques.find(x => x.id === parseInt(inp.dataset.bid));
      if (b) { b.nombre = inp.value; refrescarThumbsVisual(); }
    });
  });

  lista.querySelectorAll(".ws-bloque-del").forEach(btn => {
    btn.addEventListener("click", () => {
      nuevoBloquesResaltados.delete(parseInt(btn.dataset.bid));
      nuevoBloques = nuevoBloques.filter(x => x.id !== parseInt(btn.dataset.bid));
      renderBloques();
      refrescarThumbsVisual();
      actualizarInfoSeleccion();
    });
  });

  lista.querySelectorAll(".req-chip-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const b = nuevoBloques.find(x => x.id === parseInt(btn.dataset.bid));
      if (b) {
        b.requerimientos.splice(parseInt(btn.dataset.ri), 1);
        renderBloques();
      }
    });
  });

  lista.querySelectorAll(".bloque-btn-add-req").forEach(btn => {
    btn.addEventListener("click", () => agregarReqBloque(parseInt(btn.dataset.bid)));
  });

  lista.querySelectorAll(".bloque-add-req").forEach(inp => {
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") agregarReqBloque(parseInt(inp.dataset.bid));
    });
  });
}

function desplazarABloqueResaltado() {
  const primerId = [...nuevoBloquesResaltados][0];
  if (!primerId) return;
  const el = document.querySelector(`.ws-bloque[data-id="${primerId}"]`);
  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function agregarReqBloque(bid) {
  const inp = document.querySelector(`.bloque-add-req[data-bid="${bid}"]`);
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  const b = nuevoBloques.find(x => x.id === bid);
  if (b && !b.requerimientos.includes(val)) {
    b.requerimientos.push(val);
    renderBloques();
  }
  inp.value = "";
}

// ─────────────────────────────────────────────
//  GUARDAR NUEVO MAPEO
// ─────────────────────────────────────────────
async function guardarNuevoMapeo() {
  const nombre = document.getElementById("nuevo-nombre").value.trim();
  const saveStatus = document.getElementById("ws-save-status");

  if (!nombre) {
    mostrar("Ingresá un nombre para el mapeo.", "err");
    document.getElementById("nuevo-nombre").focus();
    return;
  }
  if (!nuevoBloques.length) {
    mostrar("Armá al menos un bloque antes de guardar.", "err");
    return;
  }
  const bloquesSinPags = nuevoBloques.filter(b => !b.paginas.length);
  if (bloquesSinPags.length) {
    if (!confirm(`${bloquesSinPags.length} bloque(s) no tienen páginas asignadas y se ignorarán. ¿Continuar?`)) return;
  }

  const bloquesValidos = nuevoBloques.filter(b => b.paginas.length > 0);
  const errorValidacion = validarBloquesMapeo(bloquesValidos);
  if (errorValidacion) {
    mostrar(errorValidacion, "err");
    saveStatus.textContent = errorValidacion;
    saveStatus.className = "ws-save-status err";
    return;
  }

  saveStatus.textContent = "Guardando patrón…";
  saveStatus.className = "ws-save-status";

  try {
    saveStatus.textContent = "Subiendo imágenes de referencia…";
    const paginasMapeadas = new Set(bloquesValidos.flatMap(b => b.paginas));
    const imagenesFiltradas = nuevoImagenes.filter(img => paginasMapeadas.has(img.pagina));
    const rImg = await chrome.runtime.sendMessage({
      action: "storage:guardarImagenesPatronRemoto",
      payload: {
        nombre,
        imagenes: imagenesFiltradas,
        bloques: bloquesValidos
      }
    });
    if (!rImg?.ok) throw new Error(rImg?.error || "No se pudieron subir las imágenes de referencia.");

    saveStatus.textContent = "Guardando patrón…";

    // 1) Guardar patrón en chrome.storage
    const totalPaginas = imagenesFiltradas.length;
    const r1 = await chrome.runtime.sendMessage({
      action: "storage:guardarPatronSabana",
      payload: {
        nombre,
        bloquesModal: bloquesValidos,
        firmaTipos: [],
        totalPaginas,
        controlStorageRef: rImg.data?.controlStorageRef || null
      }
    });
    if (!r1?.ok) throw new Error(r1?.error || "No se pudo guardar el patrón.");

    saveStatus.textContent = `"${nombre}" guardado ✓`;
    saveStatus.className = "ws-save-status ok";
    mostrar(`Mapeo "${nombre}" guardado correctamente.`, "ok");

    // Limpiar estado de edición
    nuevoModoEdicion = null;

    // Refrescar lista de Mis Mapeos
    await cargarPatrones();

    // Ofrecer ir a Mis Mapeos
    setTimeout(() => {
      expandedCard = null;
      switchTab("mis-mapeos");
      renderCards();
    }, 1200);

  } catch (e) {
    saveStatus.textContent = "Error: " + e.message;
    saveStatus.className = "ws-save-status err";
    mostrar("Error al guardar: " + e.message, "err");
  }
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
async function init() {
  try {
    const r = await chrome.runtime.sendMessage({ action: "firebase:status" });
    const loggedIn = !!(r?.ok && r.data?.user);
    document.getElementById("no-sesion").style.display = loggedIn ? "none" : "flex";
    document.getElementById("tab-mis-mapeos").style.display = loggedIn ? "" : "none";
    document.getElementById("tab-nuevo").style.display = loggedIn ? "" : "none";
    document.querySelector('.tabs-nav').style.display = loggedIn ? "" : "none";
    if (loggedIn) {
      await cargarPatrones({ sync: true });
      cargarSobres(); // sin await — no bloquea la carga
    }
  } catch {
    document.getElementById("no-sesion").style.display = "flex";
    document.querySelector('.tabs-nav').style.display = "none";
  }
}

init();

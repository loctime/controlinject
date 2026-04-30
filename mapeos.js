const estadoEl = document.getElementById("estado");
const noSesionEl = document.getElementById("no-sesion");
const contenidoEl = document.getElementById("contenido-principal");
const cardsContainer = document.getElementById("cards-container");

const KEY_PATRON_ACTIVO = "controlinject_patron_activo";

function mostrar(msg, tipo) {
  estadoEl.textContent = msg;
  estadoEl.className = tipo || "";
}

function formatFecha(ts) {
  if (!ts) return null;
  try { return new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch (_) { return null; }
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function leerPatronActivo() {
  const data = await chrome.storage.local.get(KEY_PATRON_ACTIVO);
  return data[KEY_PATRON_ACTIVO] || null;
}

async function guardarPatronActivo(nombre) {
  await chrome.storage.local.set({ [KEY_PATRON_ACTIVO]: nombre });
}

async function cargarPatrones() {
  const [r, patronActivo] = await Promise.all([
    chrome.runtime.sendMessage({ action: "storage:leerPatronesSabana" }),
    leerPatronActivo()
  ]);
  const patrones = Array.isArray(r) ? r : [];
  renderCards(patrones, patronActivo);
}

function renderCards(patrones, patronActivo) {
  cardsContainer.innerHTML = "";

  if (!patrones.length) {
    cardsContainer.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <strong>No tenés mapeos guardados</strong>
        <p>Creá uno nuevo o importá uno existente.</p>
      </div>`;
    return;
  }

  for (const p of patrones) {
    const nombre = p.nombre || "(sin nombre)";
    const bloques = Array.isArray(p.bloquesModal) ? p.bloquesModal : [];
    const totalPags = p.totalPaginas || bloques.reduce((acc, b) => acc + (b.paginas?.length || 0), 0);
    const fecha = formatFecha(p.updatedAt || p.createdAt);
    const esActivo = nombre === patronActivo;

    const card = document.createElement("article");
    card.className = "card" + (esActivo ? " card-active" : "");
    card.innerHTML = `
      <h2 class="card-title">
        ${escapeHtml(nombre)}
        ${esActivo ? '<span class="badge-active">Activo</span>' : ""}
      </h2>
      <div class="card-meta">
        ${fecha ? `<span>Actualizado: ${fecha}</span>` : ""}
        <span>${bloques.length} bloque(s) · ${totalPags} página(s)</span>
      </div>
      <div class="chips">
        ${bloques.slice(0, 8).map(b => `<span class="chip">${escapeHtml(b.nombre || "Bloque")}</span>`).join("")}
        ${bloques.length > 8 ? `<span class="chip">+${bloques.length - 8} más</span>` : ""}
      </div>
      <div class="card-actions">
        ${!esActivo ? `<button class="alt btn-activar" data-nombre="${escapeHtml(nombre)}">Usar como activo</button>` : ""}
        <button class="alt btn-exportar" data-nombre="${escapeHtml(nombre)}">Exportar</button>
        <button class="danger btn-eliminar" data-nombre="${escapeHtml(nombre)}">Eliminar</button>
      </div>`;

    card.querySelector(".btn-exportar")?.addEventListener("click", () => exportarPatron(nombre, p));
    card.querySelector(".btn-eliminar")?.addEventListener("click", () => eliminarPatron(nombre, patrones, patronActivo));
    card.querySelector(".btn-activar")?.addEventListener("click", async () => {
      await guardarPatronActivo(nombre);
      mostrar(`"${nombre}" marcado como activo.`, "ok");
      await cargarPatrones();
    });

    cardsContainer.appendChild(card);
  }
}

function exportarPatron(nombre, patron) {
  const datos = {
    version: 1,
    exportadoEl: new Date().toISOString(),
    patrones_sabana: [patron],
    mapeos_aprendidos: {}
  };
  const json = JSON.stringify(datos, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = nombre.replace(/[^a-zA-Z0-9_-]/g, "_");
  a.href = url;
  a.download = `mapeo-${nombreArchivo}-${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
  mostrar(`"${nombre}" exportado.`, "ok");
}

async function eliminarPatron(nombre, patronesActuales, patronActivo) {
  if (!confirm(`¿Eliminar el mapeo "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    const nuevos = patronesActuales.filter(p => p.nombre !== nombre);
    const r = await chrome.runtime.sendMessage({ action: "storage:guardarPatronesSabana", payload: nuevos });
    if (!r?.ok && r !== undefined) throw new Error("No se pudo eliminar.");
    if (patronActivo === nombre) await guardarPatronActivo(null);
    mostrar(`"${nombre}" eliminado.`, "ok");
    await cargarPatrones();
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
}

document.getElementById("btn-crear").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://controldocumentario.com" });
});

document.getElementById("btn-importar").addEventListener("click", () => {
  document.getElementById("input-importar").click();
});

document.getElementById("input-importar").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    mostrar("Importando mapeo…", "");
    const texto = await file.text();
    const datos = JSON.parse(texto);
    const r = await chrome.runtime.sendMessage({ action: "storage:importarMapeo", payload: datos });
    if (!r?.ok) throw new Error(r?.error || "No se pudo importar.");
    mostrar(`Importado: ${r.data.patrones} patrón(es), ${r.data.mapeos} mapeo(s).`, "ok");
    await cargarPatrones();
  } catch (e) {
    mostrar(`Error al importar: ${e.message}`, "err");
  }
  e.target.value = "";
});

async function init() {
  try {
    const r = await chrome.runtime.sendMessage({ action: "firebase:status" });
    const loggedIn = !!(r?.ok && r.data?.user);
    noSesionEl.hidden = loggedIn;
    contenidoEl.hidden = !loggedIn;
    if (loggedIn) await cargarPatrones();
  } catch (_) {
    noSesionEl.hidden = false;
    contenidoEl.hidden = true;
  }
}

init();

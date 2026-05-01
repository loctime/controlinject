# Rediseño Panel + Página de Mapeos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el flujo de Aprender del panel lateral: el panel queda solo para trabajar con login obligatorio; los mapeos pasan a una página dedicada `mapeos.html`.

**Architecture:** Se modifica `panel.html`/`panel.js` para quitar la tab Aprender y agregar pantalla de login Firebase. Se crea `mapeos.html` + `mapeos.js` como página de extensión independiente con mismo estilo que `options.html`. `manifest.json` registra los nuevos recursos. `background.js` y `options.js` no se tocan.

**Tech Stack:** Chrome Extension MV3, JS vanilla, CSS inline (panel), `chrome.runtime.sendMessage` para Firebase/storage, `chrome.storage.local` directo para patrón activo.

---

## Mapa de archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `panel.html` | Modificar | Quitar tabs + sábana, agregar login screen, actualizar header |
| `panel.js` | Modificar | Quitar lógica aprender, agregar login check + handlers |
| `mapeos.html` | Crear | Página completa de gestión de mapeos |
| `mapeos.js` | Crear | Lógica de la página de mapeos |
| `manifest.json` | Modificar | Agregar mapeos.html y mapeos.js a web_accessible_resources |

---

## Task 1: Actualizar panel.html

**Files:**
- Modify: `panel.html`

- [ ] **Step 1: Reemplazar el contenido de panel.html**

El archivo actual tiene las tabs, el modo sábana y un header sin los botones nuevos. Reemplazarlo completo con:

```html
<aside id="docauto-panel" class="mau-panel">
  <header class="mau-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <img src="" class="mau-header-logo" alt="Logo" id="mau-logo" width="28" height="28" />
      <strong>DocAutomatización</strong>
      <span class="mau-header-badge">PRO</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button id="mau-btn-mapeos" title="Gestión de Mapeos" style="font-size:13px;width:auto;padding:4px 8px;gap:4px;display:flex;align-items:center;">🗂 Mapeos</button>
      <button id="mau-btn-settings" title="Ajustes">⚙</button>
      <button id="mau-minimizar" title="Minimizar">—</button>
    </div>
  </header>

  <section class="mau-body">

    <!-- ══ PANTALLA DE LOGIN ══ -->
    <div id="mau-login-screen">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">Iniciá sesión para usar la extensión.</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <input id="mau-login-email" type="email" placeholder="Email" style="background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.2);border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:14px;outline:none;width:100%;box-sizing:border-box;" />
        <input id="mau-login-pass" type="password" placeholder="Contraseña" style="background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.2);border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:14px;outline:none;width:100%;box-sizing:border-box;" />
        <button id="mau-login-btn" class="mau-btn">Ingresar</button>
        <button id="mau-login-google-btn" class="mau-btn mau-btn-secondary">Ingresar con Google</button>
        <p id="mau-login-error" style="color:#f87171;font-size:12px;margin:0;min-height:16px;"></p>
      </div>
    </div>

    <!-- ══ MODO TRABAJAR ══ -->
    <div id="mau-modo-trabajar" hidden>
      <p class="mau-modo-hint">Subí cualquier documento (recibos, comprobantes, etc.). Claude lo identifica y lo asigna al requerimiento correcto usando el mapeo guardado.</p>

      <div id="mau-dropzone" class="mau-dropzone">
        Arrastrá archivos PDF acá
      </div>
      <div class="mau-actions">
        <button id="mau-seleccionar" class="mau-btn mau-btn-secondary">Seleccionar archivos</button>
        <input id="mau-file-input" type="file" accept="application/pdf,.pdf" multiple hidden />
      </div>
      <div class="mau-actions">
        <button id="mau-detectar" class="mau-btn">Detectar requerimientos pendientes</button>
      </div>

      <div class="mau-progress-wrap">
        <div id="mau-progress-text">Sin procesamiento en curso</div>
        <div class="mau-progress-bar">
          <div id="mau-progress-inner"></div>
        </div>
      </div>

      <table class="mau-tabla">
        <thead>
          <tr>
            <th>Requerimiento</th>
            <th>Archivo asignado</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody id="mau-tabla-body"></tbody>
      </table>

      <button id="mau-procesar" class="mau-btn mau-btn-main">Procesar todo</button>
    </div>

  </section>
  <div id="mau-toast" class="mau-toast" role="status" aria-live="polite" hidden></div>
</aside>
```

- [ ] **Step 2: Verificar visualmente que el HTML no tiene referencias a modoSabana**

```bash
grep -n "mau-modo-sabana\|mau-tab\|sabana\|aprender\|mau-abrir-mapeo" panel.html
# Debe devolver 0 resultados
```

- [ ] **Step 3: Commit**

```bash
git add panel.html
git commit -m "feat: panel.html — quita Aprender, agrega login screen y botones header"
```

---

## Task 2: Actualizar panel.js — Quitar código de Aprender

**Files:**
- Modify: `panel.js` (secciones dispersas)

### Paso A: Actualizar el objeto `ui`

- [ ] **Step 1: Reemplazar el bloque `ui` (líneas ~19-45)**

Ubicar el bloque que empieza con `const ui = {` y reemplazarlo por la versión sin las referencias de sábana y con las nuevas:

```js
  const ui = {
    panel: document.getElementById("docauto-panel"),
    minimizar: document.getElementById("mau-minimizar"),
    btnSettings: document.getElementById("mau-btn-settings"),
    btnMapeos: document.getElementById("mau-btn-mapeos"),
    loginScreen: document.getElementById("mau-login-screen"),
    loginEmail: document.getElementById("mau-login-email"),
    loginPass: document.getElementById("mau-login-pass"),
    loginBtn: document.getElementById("mau-login-btn"),
    loginGoogleBtn: document.getElementById("mau-login-google-btn"),
    loginError: document.getElementById("mau-login-error"),
    modoTrabajar: document.getElementById("mau-modo-trabajar"),
    dropzone: document.getElementById("mau-dropzone"),
    seleccionar: document.getElementById("mau-seleccionar"),
    fileInput: document.getElementById("mau-file-input"),
    detectar: document.getElementById("mau-detectar"),
    tabla: document.getElementById("mau-tabla-body"),
    procesar: document.getElementById("mau-procesar"),
    pText: document.getElementById("mau-progress-text"),
    pInner: document.getElementById("mau-progress-inner"),
    toast: document.getElementById("mau-toast")
  };
```

### Paso B: Quitar event listeners de tabs y sábana, agregar login + header

- [ ] **Step 2: Reemplazar el bloque de event listeners de tabs (líneas ~51-70)**

Ubicar este bloque:
```js
  // ── Tabs de modo ──
  function activarTab(modo) {
    const esTrab = modo === "trabajar";
    ui.modoTrabajar.hidden = !esTrab;
    ui.modoSabana.hidden = esTrab;
    ui.tabTrabajar.classList.toggle("mau-tab-active", esTrab);
    ui.tabSabana.classList.toggle("mau-tab-active", !esTrab);
  }
  if (ui.tabTrabajar) ui.tabTrabajar.addEventListener("click", () => activarTab("trabajar"));
  if (ui.tabSabana) ui.tabSabana.addEventListener("click", () => activarTab("sabana"));
```

Y reemplazarlo por:
```js
  // ── Login ──
  async function verificarSesion() {
    try {
      const r = await chrome.runtime.sendMessage({ action: "firebase:status" });
      const loggedIn = !!(r?.ok && r.data?.user);
      ui.loginScreen.hidden = loggedIn;
      ui.modoTrabajar.hidden = !loggedIn;
    } catch (_) {
      ui.loginScreen.hidden = false;
      ui.modoTrabajar.hidden = true;
    }
  }

  if (ui.loginBtn) ui.loginBtn.addEventListener("click", async () => {
    const email = ui.loginEmail.value.trim();
    const pass = ui.loginPass.value;
    ui.loginError.textContent = "";
    if (!email || !pass) { ui.loginError.textContent = "Completá email y contraseña."; return; }
    ui.loginBtn.disabled = true;
    ui.loginBtn.textContent = "Ingresando…";
    try {
      const r = await chrome.runtime.sendMessage({ action: "firebase:login", payload: { email, password: pass } });
      if (!r?.ok) throw new Error(r?.error || "No se pudo iniciar sesión.");
      ui.loginScreen.hidden = true;
      ui.modoTrabajar.hidden = false;
    } catch (e) {
      ui.loginError.textContent = e.message;
    } finally {
      ui.loginBtn.disabled = false;
      ui.loginBtn.textContent = "Ingresar";
    }
  });

  if (ui.loginGoogleBtn) ui.loginGoogleBtn.addEventListener("click", async () => {
    ui.loginError.textContent = "";
    ui.loginGoogleBtn.disabled = true;
    try {
      const r = await chrome.runtime.sendMessage({ action: "firebase:loginGoogle" });
      if (!r?.ok) throw new Error(r?.error || "No se pudo iniciar sesión con Google.");
      ui.loginScreen.hidden = true;
      ui.modoTrabajar.hidden = false;
    } catch (e) {
      ui.loginError.textContent = e.message;
    } finally {
      ui.loginGoogleBtn.disabled = false;
    }
  });
```

- [ ] **Step 3: Reemplazar los event listeners de abrirMapeo y sabanaCancelar (líneas ~68-70)**

Ubicar:
```js
  if (ui.abrirMapeo) ui.abrirMapeo.addEventListener("click", abrirGestorMapeo);

  if (ui.sabanaCancelar) ui.sabanaCancelar.addEventListener("click", cancelarEditorSabana);
```

Reemplazar por:
```js
  if (ui.btnSettings) ui.btnSettings.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  });

  if (ui.btnMapeos) ui.btnMapeos.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("mapeos.html") });
  });
```

- [ ] **Step 4: Agregar llamada a `verificarSesion()` justo después del bloque de event listeners iniciales**

Ubicar la línea (aproximadamente ~95):
```js
  instalarBloqueoGlobalDrop();
```

Y justo debajo agregar:
```js
  verificarSesion();
```

### Paso C: Actualizar mensajes de toast que referencian "Aprender"

- [ ] **Step 5: Actualizar el mensaje cuando no hay mapeo (líneas ~385-388)**

Ubicar:
```js
      mostrarToast("No hay mapeo guardado. Primero subí una sábana en la pestaña «Subir sábana».");
```

Reemplazar por:
```js
      mostrarToast("No hay mapeo guardado. Abrí la página de Mapeos para crear uno.");
```

- [ ] **Step 6: Actualizar el mensaje cuando no hay imágenes de referencia (líneas ~417-420)**

Ubicar:
```js
      mostrarToast(`No hay mapeos con imágenes guardadas. Hacé un mapeo primero desde "Aprender".`);
```

Reemplazar por:
```js
      mostrarToast(`No hay mapeos con imágenes guardadas. Creá un mapeo desde la página de Mapeos.`);
```

### Paso D: Eliminar funciones de sábana

- [ ] **Step 7: Eliminar la función `procesarArchivosPdfSabana` y `mostrarSeccionSabana` (líneas ~500-526)**

Ubicar y eliminar el bloque:
```js
  // ── Flujo sábana (modo aprendizaje) — se activa desde la tab «Subir sábana» ──
  async function procesarArchivosPdfSabana(archivos, origen) {
    // ... (hasta el cierre de la función)
  }

  function mostrarSeccionSabana(visible) {
    if (ui.sabanaWrap) ui.sabanaWrap.hidden = !visible;
    if (visible && ui.sabanaEditor) ui.sabanaEditor.hidden = true;
  }
```

- [ ] **Step 8: Eliminar las funciones `resetSabanaUi` y `cancelarEditorSabana` (líneas ~750-759)**

Ubicar y eliminar:
```js
  function resetSabanaUi() {
    estado.sabanaPendiente = null;
    if (ui.sabanaWrap) ui.sabanaWrap.hidden = true;
    if (ui.sabanaTablaBody) ui.sabanaTablaBody.innerHTML = "";
    actualizarProgreso(0, 0, "Sin procesamiento en curso");
  }

  function cancelarEditorSabana() {
    ui.pText.textContent = "Sin procesamiento en curso";
  }
```

- [ ] **Step 9: Eliminar las funciones `pedirPdfAlUsuario`, `elegirPatronUI` y `abrirGestorMapeo` (líneas ~2268-2453)**

Ubicar y eliminar el bloque completo desde:
```js
  function pedirPdfAlUsuario() {
```
Hasta el cierre de `abrirGestorMapeo`:
```js
        resetSabanaUi();
        await aplicarBloquesModal(file, bloquesConTexto);
      }
    });
  }
```

- [ ] **Step 10: Eliminar `sabanaPendiente` del estado inicial (línea ~8)**

Ubicar:
```js
    sabanaPendiente: null
```
Y eliminar esa línea (incluyendo la coma de la línea anterior si aplica).

- [ ] **Step 11: Verificar que no queden referencias rotas**

```bash
grep -n "modoSabana\|tabSabana\|tabTrabajar\|abrirMapeo\|sabanaWrap\|sabanaEditor\|sabanaTablaBody\|sabanaConfirmar\|sabanaCancelar\|pTextSabana\|pInnerSabana\|sabanaPendiente\|procesarArchivosPdfSabana\|mostrarSeccionSabana\|resetSabanaUi\|cancelarEditorSabana\|pedirPdfAlUsuario\|elegirPatronUI\|abrirGestorMapeo" panel.js
# Debe devolver 0 resultados
```

- [ ] **Step 12: Commit**

```bash
git add panel.js
git commit -m "feat: panel.js — login obligatorio, quita toda la lógica de Aprender/sábana"
```

---

## Task 3: Crear mapeos.html

**Files:**
- Create: `mapeos.html`

- [ ] **Step 1: Crear el archivo mapeos.html**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ControlBun - Mapeos</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #5b6473;
      --line: #d7dfeb;
      --primary: #0f5cc0;
      --primary-2: #2b7be6;
      --ok-bg: #ecfdf3;
      --ok-text: #0f7a3d;
      --err-bg: #fef2f2;
      --err-text: #b42318;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Segoe UI", "Trebuchet MS", sans-serif;
      background:
        radial-gradient(circle at 20% 0%, #dcecff 0%, transparent 35%),
        radial-gradient(circle at 100% 100%, #ffe7d3 0%, transparent 30%),
        var(--bg);
      color: var(--text);
      padding: 24px;
    }

    .container {
      max-width: 980px;
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }

    .hero {
      background: linear-gradient(130deg, #0f5cc0, #2b7be6);
      color: #fff;
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 10px 25px rgba(15, 92, 192, 0.2);
    }

    .hero-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .hero h1 { margin: 0; font-size: 24px; }

    .hero p {
      margin: 6px 0 0;
      color: #e8f1ff;
      font-size: 14px;
      line-height: 1.5;
    }

    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .cards-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }

    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 3px 14px rgba(16, 24, 40, 0.06);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .card.card-active {
      border-color: var(--primary-2);
      box-shadow: 0 3px 14px rgba(43, 123, 230, 0.18);
    }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge-active {
      font-size: 10px;
      font-weight: 600;
      background: var(--primary);
      color: #fff;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .card-meta {
      font-size: 12px;
      color: var(--muted);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .chip {
      font-size: 11px;
      background: #eef3fb;
      color: #1f3f74;
      border: 1px solid #d7e5ff;
      border-radius: 999px;
      padding: 2px 9px;
    }

    .card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: auto;
    }

    button {
      border: 0;
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      color: #fff;
      transition: transform 0.12s ease;
    }

    button:hover { transform: translateY(-1px); }

    button.alt {
      background: #eef3fb;
      color: #1f3f74;
      border: 1px solid #d7e5ff;
    }

    button.danger {
      background: #fef2f2;
      color: var(--err-text);
      border: 1px solid #f7c3c0;
    }

    button.danger:hover { background: #fee2e2; }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--muted);
      font-size: 15px;
      background: var(--card);
      border-radius: 16px;
      border: 1px dashed var(--line);
    }

    .empty-state p { margin: 8px 0 0; }

    #estado {
      position: sticky;
      bottom: 12px;
      margin: 0;
      padding: 11px 12px;
      border-radius: 10px;
      background: #eef2f8;
      color: #2a3648;
      border: 1px solid #d7dfeb;
      font-size: 13px;
      min-height: 18px;
      z-index: 3;
    }

    #estado.ok { background: var(--ok-bg); color: var(--ok-text); border-color: #b8eacb; }
    #estado.err { background: var(--err-bg); color: var(--err-text); border-color: #f7c3c0; }

    #no-sesion {
      text-align: center;
      padding: 48px 24px;
      color: var(--muted);
      background: var(--card);
      border-radius: 16px;
      border: 1px solid var(--line);
    }

    input[type="file"] { display: none; }

    @media (max-width: 640px) {
      body { padding: 14px; }
      .hero h1 { font-size: 21px; }
    }
  </style>
</head>
<body>
  <main class="container">

    <section class="hero">
      <div class="hero-top">
        <img src="icons/icon128.png" alt="Logo" width="38" height="38" style="border-radius:10px;background:#fff;padding:4px;" />
        <h1>Gestión de Mapeos</h1>
      </div>
      <p>Cada mapeo guarda la estructura de una sábana. Podés tener varios y activar el que necesités.</p>
    </section>

    <div id="no-sesion" hidden>
      <strong>No hay sesión activa</strong>
      <p>Iniciá sesión desde la extensión para ver tus mapeos.</p>
    </div>

    <div id="contenido-principal">
      <div class="toolbar">
        <button id="btn-crear" type="button">+ Crear nuevo mapeo</button>
        <button id="btn-importar" type="button" class="alt">Importar mapeo</button>
        <input id="input-importar" type="file" accept=".json" />
      </div>

      <div id="cards-container" class="cards-grid" style="margin-top:14px;">
        <!-- Cards generadas por JS -->
      </div>
    </div>

  </main>

  <p id="estado"></p>

  <script src="mapeos.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add mapeos.html
git commit -m "feat: mapeos.html — nueva página de gestión de mapeos"
```

---

## Task 4: Crear mapeos.js

**Files:**
- Create: `mapeos.js`

- [ ] **Step 1: Crear el archivo mapeos.js**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add mapeos.js
git commit -m "feat: mapeos.js — lógica completa de la página de gestión de mapeos"
```

---

## Task 5: Actualizar manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Agregar `mapeos.html` y `mapeos.js` al bloque `web_accessible_resources`**

Ubicar el bloque existente:
```json
    {
      "resources": [
        "panel.html",
        "panel.css",
        "panel.js",
        "matcher.js",
        "storage.js",
        "imagedb.js",
        "pdf-splitter.js",
        "ocr-engine.js",
        "modal-seleccion.js",
        "page-inject-confirm-patch.js",
        "vencimientos.js"
      ],
      "matches": [
        "https://controldocumentario.com/*"
      ]
    }
```

Reemplazar por:
```json
    {
      "resources": [
        "panel.html",
        "panel.css",
        "panel.js",
        "matcher.js",
        "storage.js",
        "imagedb.js",
        "pdf-splitter.js",
        "ocr-engine.js",
        "modal-seleccion.js",
        "page-inject-confirm-patch.js",
        "vencimientos.js",
        "mapeos.html",
        "mapeos.js"
      ],
      "matches": [
        "https://controldocumentario.com/*"
      ]
    }
```

- [ ] **Step 2: Verificar que el JSON es válido**

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: manifest.json — registra mapeos.html y mapeos.js como web_accessible_resources"
```

---

## Checklist de verificación final

- [ ] Recargar la extensión en `chrome://extensions` → "Reload"
- [ ] Abrir controldocumentario.com → el panel debe mostrar la pantalla de login (no las tabs)
- [ ] Ingresar con email/pass → el panel debe mostrar el modo trabajar
- [ ] El botón "⚙" abre options.html en nueva pestaña
- [ ] El botón "🗂 Mapeos" abre mapeos.html en nueva pestaña
- [ ] En mapeos.html sin sesión: se muestra el mensaje de "Iniciá sesión"
- [ ] En mapeos.html con sesión: se muestra la grilla de patrones (o empty state si no hay)
- [ ] Botón "Exportar" en una card descarga un JSON con ese patrón
- [ ] Botón "Eliminar" pide confirmación y borra la card
- [ ] Botón "Usar como activo" marca la card con badge "Activo" al recargar
- [ ] El flujo de subir PDFs en modo trabajar sigue funcionando exactamente igual
- [ ] DevTools Console no muestra errores de referencias indefinidas (modoSabana, etc.)

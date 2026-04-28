# Firebase Auth + Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar login con email/contraseña y Google a la extensión, y sincronizar automáticamente el mapeo, config de Telegram, API key y credenciales de CD a Firestore — para que nunca se pierdan al limpiar Chrome y para poder vender a múltiples empresas.

**Architecture:** Firebase REST API (no SDK) para ser compatible con MV3 sin bundler. Todo el código Firebase vive en `background.js` que actúa como hub. `options.js` comunica con background via `chrome.runtime.sendMessage`. Cada empresa es un usuario Firebase separado. Firestore guarda config + patrones de sábana; IndexedDB sigue guardando las imágenes localmente (se regeneran subiendo el PDF original).

**Tech Stack:** Firebase Auth REST API, Firestore REST API, Chrome Extensions MV3, chrome.identity (Google Auth), chrome.storage.local (caché local + token).

---

## Prerequisitos — Datos que el usuario debe proveer

Antes de empezar el código, el usuario necesita abrir la consola de Firebase y traer:
- `FIREBASE_API_KEY` — en Configuración del proyecto → General → Tu app web → apiKey
- `FIREBASE_PROJECT_ID` — en Configuración del proyecto → General → ID del proyecto
- `GOOGLE_OAUTH_CLIENT_ID` — en Google Cloud Console → APIs y servicios → Credenciales → ID de cliente OAuth 2.0 para app web

También necesita:
1. Ir a Firebase Console → Authentication → Métodos de acceso → habilitar Email/contraseña y Google
2. Obtener el ID de la extensión: chrome://extensions → activar modo desarrollador → copiar el ID
3. En Google Cloud Console → Credenciales → el OAuth client → agregar URI de redireccionamiento autorizado: `https://<EXTENSION_ID>.chromiumapp.org/`
4. En Firebase Console → Authentication → Dominios autorizados → agregar `chrome-extension://<EXTENSION_ID>` (puede no ser necesario con el flujo launchWebAuthFlow)

---

## Estructura de Firestore

```
users/{uid}/
  config  (documento único)
    apiKey: string
    modelo: string
    cdUser: string
    cdPass: string          ← encriptado en tránsito por HTTPS, en reposo en Firestore
    tgToken: string
    tgChatId: string
    tgDiasPersonal: number
    tgDiasVehiculos: number
    tgFrecuencia: number
    tgActivo: boolean
    tgSilencioDesde: string
    tgSilencioHasta: string
    mapeosAprendidos: object  ← el KEY_MAPEOS (mapa nombre→requerimiento, pequeño)

  patrones/  (subcolección)
    {nombrePatron}  (un documento por patrón)
      nombre: string
      bloquesModal: array
      firmaTipos: array
      bloques: array | null    ← formato legacy, mantener para compatibilidad
      firma: array | null      ← formato legacy
      actualizadoEl: timestamp
```

**Límite Firestore:** cada documento máx 1MB. Los patrones solo guardan metadata (sin imágenes). Las imágenes quedan en IndexedDB local — si el usuario limpia Chrome debe volver a subir el PDF sábana para regenerarlas (las imágenes se derivan del PDF, no son datos únicos).

---

## Reglas de seguridad Firestore

Antes del Task 1, el usuario debe pegar estas reglas en Firebase Console → Firestore → Reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Task 1: Constantes Firebase y funciones de Auth en background.js

**Files:**
- Modify: `background.js` (agregar al principio, después de las constantes existentes)
- Modify: `manifest.json` (host_permissions + identity permission)

### Qué hace este task
Agrega las funciones Firebase al background service worker: login email, login Google, logout, refresh token, leer usuario actual desde chrome.storage.

- [ ] **Step 1: Agregar host_permissions de Firebase en manifest.json**

En `manifest.json`, el campo `host_permissions` debe quedar:
```json
"host_permissions": [
  "https://controldocumentario.com/*",
  "https://api.anthropic.com/*",
  "https://api.telegram.org/*",
  "https://identitytoolkit.googleapis.com/*",
  "https://securetoken.googleapis.com/*",
  "https://firestore.googleapis.com/*",
  "https://accounts.google.com/*"
],
```

Y agregar `"identity"` al array `permissions`:
```json
"permissions": ["activeTab", "storage", "scripting", "alarms", "tabs", "identity"],
```

- [ ] **Step 2: Agregar constantes Firebase en background.js**

Después de la línea `const ALARMA_TG_POLL = "matesin_alarma_tg_poll";`, agregar:

```js
// ── Firebase ─────────────────────────────────────────────────
const FB_API_KEY = "REEMPLAZAR_CON_FIREBASE_API_KEY";
const FB_PROJECT_ID = "REEMPLAZAR_CON_PROJECT_ID";
const GOOGLE_CLIENT_ID = "REEMPLAZAR_CON_OAUTH_CLIENT_ID";

const KEY_FB_ID_TOKEN = "fb_id_token";
const KEY_FB_REFRESH_TOKEN = "fb_refresh_token";
const KEY_FB_UID = "fb_uid";
const KEY_FB_EMAIL = "fb_email";
const KEY_FB_DISPLAY_NAME = "fb_display_name";

const FB_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;
const FB_TOKEN_URL = `https://securetoken.googleapis.com/v1/token`;
const FB_FS_URL = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT_ID}/databases/(default)/documents`;
```

- [ ] **Step 3: Agregar función fbFetch helper**

Antes de la función `normalizar`, agregar:

```js
async function fbFetch(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Firebase error ${res.status}`);
  return json;
}
```

- [ ] **Step 4: Agregar función fbGetToken (con refresh automático)**

Después de `fbFetch`:

```js
async function fbGetToken() {
  const data = await chrome.storage.local.get([KEY_FB_ID_TOKEN, KEY_FB_REFRESH_TOKEN, KEY_FB_UID]);
  if (!data[KEY_FB_REFRESH_TOKEN]) return null;

  // Intentar con el token actual primero (expira en 1 hora)
  // Siempre refrescamos para simplicidad — en producción se puede cachear la expiración
  const refreshed = await fbRefreshToken(data[KEY_FB_REFRESH_TOKEN]);
  return refreshed;
}

async function fbRefreshToken(refreshToken) {
  const res = await fbFetch(`${FB_TOKEN_URL}?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken })
  });
  const idToken = res.id_token;
  const newRefresh = res.refresh_token;
  await chrome.storage.local.set({ [KEY_FB_ID_TOKEN]: idToken, [KEY_FB_REFRESH_TOKEN]: newRefresh });
  return idToken;
}
```

- [ ] **Step 5: Agregar función fbLoginEmail**

```js
async function fbLoginEmail(email, password) {
  const data = await fbFetch(`${FB_AUTH_URL}:signInWithPassword?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  await chrome.storage.local.set({
    [KEY_FB_ID_TOKEN]: data.idToken,
    [KEY_FB_REFRESH_TOKEN]: data.refreshToken,
    [KEY_FB_UID]: data.localId,
    [KEY_FB_EMAIL]: data.email,
    [KEY_FB_DISPLAY_NAME]: data.displayName || data.email
  });
  return { uid: data.localId, email: data.email, displayName: data.displayName || data.email };
}
```

- [ ] **Step 6: Agregar función fbLoginGoogle**

```js
async function fbLoginGoogle() {
  // Obtener access_token de Google via chrome.identity
  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("scope", "email profile openid");

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true }, (url) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(url);
    });
  });

  const params = new URLSearchParams(new URL(responseUrl).hash.substring(1));
  const accessToken = params.get("access_token");
  if (!accessToken) throw new Error("No se obtuvo access_token de Google.");

  const data = await fbFetch(`${FB_AUTH_URL}:signInWithIdp?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestUri: redirectUri,
      postBody: `access_token=${accessToken}&providerId=google.com`,
      returnSecureToken: true,
      returnIdpCredential: true
    })
  });
  await chrome.storage.local.set({
    [KEY_FB_ID_TOKEN]: data.idToken,
    [KEY_FB_REFRESH_TOKEN]: data.refreshToken,
    [KEY_FB_UID]: data.localId,
    [KEY_FB_EMAIL]: data.email,
    [KEY_FB_DISPLAY_NAME]: data.displayName || data.email
  });
  return { uid: data.localId, email: data.email, displayName: data.displayName || data.email };
}
```

- [ ] **Step 7: Agregar fbLogout y fbGetStatus**

```js
async function fbLogout() {
  await chrome.storage.local.remove([KEY_FB_ID_TOKEN, KEY_FB_REFRESH_TOKEN, KEY_FB_UID, KEY_FB_EMAIL, KEY_FB_DISPLAY_NAME]);
}

async function fbGetStatus() {
  const data = await chrome.storage.local.get([KEY_FB_UID, KEY_FB_EMAIL, KEY_FB_DISPLAY_NAME, KEY_FB_REFRESH_TOKEN]);
  if (!data[KEY_FB_UID] || !data[KEY_FB_REFRESH_TOKEN]) return null;
  return { uid: data[KEY_FB_UID], email: data[KEY_FB_EMAIL], displayName: data[KEY_FB_DISPLAY_NAME] };
}
```

- [ ] **Step 8: Agregar handlers de mensajes Firebase en manejarMensaje**

Al principio de la función `manejarMensaje`, antes del primer `if (accion === ...)`, agregar:

```js
  if (accion === "firebase:login") {
    const { email, password } = mensaje?.payload || {};
    return await fbLoginEmail(email, password);
  }

  if (accion === "firebase:loginGoogle") {
    return await fbLoginGoogle();
  }

  if (accion === "firebase:logout") {
    await fbLogout();
    return { ok: true };
  }

  if (accion === "firebase:status") {
    return await fbGetStatus();
  }
```

- [ ] **Step 9: Commit**

```bash
git add background.js manifest.json
git commit -m "feat: add Firebase Auth functions to background (email + Google)"
```

---

## Task 2: Funciones Firestore (leer y escribir datos)

**Files:**
- Modify: `background.js` (agregar funciones Firestore)

### Qué hace este task
Funciones para leer y escribir config + patrones en Firestore usando la REST API.

- [ ] **Step 1: Agregar helper fsToValue (convierte valor JS a formato Firestore)**

Después de `fbGetStatus`, agregar:

```js
function fsToValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(fsToValue) } };
  if (typeof val === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, fsToValue(v)])) } };
  return { stringValue: String(val) };
}

function fsFromValue(v) {
  if (!v) return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsFromValue);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, val]) => [k, fsFromValue(val)]));
  return null;
}

function fsDocToObj(doc) {
  if (!doc?.fields) return {};
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, fsFromValue(v)]));
}

function objToFsFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fsToValue(v)]));
}
```

- [ ] **Step 2: Agregar fsWriteDoc y fsReadDoc**

```js
async function fsWriteDoc(path, data) {
  const idToken = await fbGetToken();
  if (!idToken) throw new Error("No hay sesión activa.");
  const fields = objToFsFields(data);
  await fbFetch(`${FB_FS_URL}/${path}?updateMask.fieldPaths=${Object.keys(data).join("&updateMask.fieldPaths=")}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields })
  });
}

async function fsReadDoc(path) {
  const idToken = await fbGetToken();
  if (!idToken) return null;
  try {
    const doc = await fbFetch(`${FB_FS_URL}/${path}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    return fsDocToObj(doc);
  } catch (e) {
    if (e.message?.includes("NOT_FOUND")) return null;
    throw e;
  }
}

async function fsListCollection(collectionPath) {
  const idToken = await fbGetToken();
  if (!idToken) return [];
  try {
    const res = await fbFetch(`${FB_FS_URL}/${collectionPath}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    return (res.documents || []).map(doc => fsDocToObj(doc));
  } catch (e) {
    return [];
  }
}

async function fsDeleteDoc(path) {
  const idToken = await fbGetToken();
  if (!idToken) return;
  await fetch(`${FB_FS_URL}/${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` }
  });
}
```

- [ ] **Step 3: Agregar fbSyncConfigUp (local → Firestore)**

```js
async function fbSyncConfigUp() {
  const user = await fbGetStatus();
  if (!user) return;
  const data = await chrome.storage.local.get([
    KEY_API_KEY, KEY_MODELO,
    KEY_CD_USER, KEY_CD_PASS,
    KEY_TG_TOKEN, KEY_TG_CHATID, KEY_TG_DIAS_PERSONAL, KEY_TG_DIAS_VEHICULOS,
    KEY_TG_FRECUENCIA, KEY_TG_ACTIVO, KEY_TG_SILENCIO_DESDE, KEY_TG_SILENCIO_HASTA,
    KEY_MAPEOS
  ]);
  const config = {
    apiKey: data[KEY_API_KEY] || "",
    modelo: data[KEY_MODELO] || MODELO_DEFAULT,
    cdUser: data[KEY_CD_USER] || "",
    cdPass: data[KEY_CD_PASS] || "",
    tgToken: data[KEY_TG_TOKEN] || "",
    tgChatId: data[KEY_TG_CHATID] || "",
    tgDiasPersonal: data[KEY_TG_DIAS_PERSONAL] || 7,
    tgDiasVehiculos: data[KEY_TG_DIAS_VEHICULOS] || 15,
    tgFrecuencia: data[KEY_TG_FRECUENCIA] || 180,
    tgActivo: !!data[KEY_TG_ACTIVO],
    tgSilencioDesde: data[KEY_TG_SILENCIO_DESDE] || "22:00",
    tgSilencioHasta: data[KEY_TG_SILENCIO_HASTA] || "08:00",
    mapeosAprendidos: data[KEY_MAPEOS] || {}
  };
  await fsWriteDoc(`users/${user.uid}/config`, config);
}
```

- [ ] **Step 4: Agregar fbSyncConfigDown (Firestore → local)**

```js
async function fbSyncConfigDown() {
  const user = await fbGetStatus();
  if (!user) return 0;
  const config = await fsReadDoc(`users/${user.uid}/config`);
  if (!config) return 0;
  const toSave = {};
  if (config.apiKey) toSave[KEY_API_KEY] = config.apiKey;
  if (config.modelo) toSave[KEY_MODELO] = config.modelo;
  if (config.cdUser) toSave[KEY_CD_USER] = config.cdUser;
  if (config.cdPass) toSave[KEY_CD_PASS] = config.cdPass;
  if (config.tgToken) toSave[KEY_TG_TOKEN] = config.tgToken;
  if (config.tgChatId) toSave[KEY_TG_CHATID] = config.tgChatId;
  if (config.tgDiasPersonal) toSave[KEY_TG_DIAS_PERSONAL] = config.tgDiasPersonal;
  if (config.tgDiasVehiculos) toSave[KEY_TG_DIAS_VEHICULOS] = config.tgDiasVehiculos;
  if (config.tgFrecuencia) toSave[KEY_TG_FRECUENCIA] = config.tgFrecuencia;
  if (typeof config.tgActivo === "boolean") toSave[KEY_TG_ACTIVO] = config.tgActivo;
  if (config.tgSilencioDesde) toSave[KEY_TG_SILENCIO_DESDE] = config.tgSilencioDesde;
  if (config.tgSilencioHasta) toSave[KEY_TG_SILENCIO_HASTA] = config.tgSilencioHasta;
  if (config.mapeosAprendidos) toSave[KEY_MAPEOS] = config.mapeosAprendidos;
  await chrome.storage.local.set(toSave);
  return Object.keys(toSave).length;
}
```

- [ ] **Step 5: Agregar fbSyncPatronesUp y fbSyncPatronesDown**

```js
async function fbSyncPatronesUp() {
  const user = await fbGetStatus();
  if (!user) return 0;
  const data = await chrome.storage.local.get(KEY_PATRONES_SABANA);
  const patrones = data[KEY_PATRONES_SABANA] || [];
  for (const patron of patrones) {
    const nombre = patron.nombre;
    if (!nombre) continue;
    const docData = {
      nombre,
      bloquesModal: patron.bloquesModal || [],
      firmaTipos: patron.firmaTipos || [],
      bloques: patron.bloques || [],
      firma: patron.firma || [],
      actualizadoEl: Date.now()
    };
    // Firestore no acepta slash en IDs — sanear nombre
    const docId = nombre.replace(/\//g, "_").replace(/\./g, "_");
    await fsWriteDoc(`users/${user.uid}/patrones/${docId}`, docData);
  }
  return patrones.length;
}

async function fbSyncPatronesDown() {
  const user = await fbGetStatus();
  if (!user) return 0;
  const docs = await fsListCollection(`users/${user.uid}/patrones`);
  if (!docs.length) return 0;
  await chrome.storage.local.set({ [KEY_PATRONES_SABANA]: docs });
  return docs.length;
}
```

- [ ] **Step 6: Agregar handlers de sync en manejarMensaje**

Junto a los otros handlers de firebase, agregar:

```js
  if (accion === "firebase:syncUp") {
    const user = await fbGetStatus();
    if (!user) throw new Error("No hay sesión activa.");
    const [, nPatrones] = await Promise.all([fbSyncConfigUp(), fbSyncPatronesUp()]);
    return { config: true, patrones: nPatrones };
  }

  if (accion === "firebase:syncDown") {
    const user = await fbGetStatus();
    if (!user) throw new Error("No hay sesión activa.");
    const [nConfig, nPatrones] = await Promise.all([fbSyncConfigDown(), fbSyncPatronesDown()]);
    return { config: nConfig, patrones: nPatrones };
  }
```

- [ ] **Step 7: Commit**

```bash
git add background.js
git commit -m "feat: add Firestore read/write sync functions"
```

---

## Task 3: Auto-sync al guardar (hooks en manejarMensaje)

**Files:**
- Modify: `background.js` (modificar handlers existentes para auto-sincronizar)

### Qué hace este task
Cada vez que el usuario guarda la API key, config Telegram, credenciales CD, o un nuevo patrón → se sube automáticamente a Firestore si hay sesión activa.

- [ ] **Step 1: Auto-sync en storage:setApiKey**

Encontrar el bloque:
```js
  if (accion === "storage:setApiKey") {
    const apiKey = String(mensaje?.payload?.apiKey || "").trim();
    const modelo = String(mensaje?.payload?.modelo || MODELO_DEFAULT).trim();
    await chrome.storage.local.set({ [KEY_API_KEY]: apiKey, [KEY_MODELO]: modelo });
    return { saved: true };
  }
```

Reemplazarlo por:
```js
  if (accion === "storage:setApiKey") {
    const apiKey = String(mensaje?.payload?.apiKey || "").trim();
    const modelo = String(mensaje?.payload?.modelo || MODELO_DEFAULT).trim();
    await chrome.storage.local.set({ [KEY_API_KEY]: apiKey, [KEY_MODELO]: modelo });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }
```

- [ ] **Step 2: Auto-sync en auth:setCreds**

Encontrar el bloque:
```js
    await chrome.storage.local.set({ [KEY_CD_USER]: user, [KEY_CD_PASS]: pass });
    return { saved: true };
```

Agregar la línea de sync antes del return:
```js
    await chrome.storage.local.set({ [KEY_CD_USER]: user, [KEY_CD_PASS]: pass });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
```

- [ ] **Step 3: Auto-sync en tg:setConfig**

Buscar el handler `tg:setConfig` (donde se hace `chrome.storage.local.set` con los datos de Telegram). Agregar `fbSyncConfigUp().catch(() => {});` justo antes de su `return { saved: true }`.

- [ ] **Step 4: Auto-sync en storage:guardarPatronSabana**

Encontrar la línea:
```js
    await chrome.storage.local.set({ [KEY_PATRONES_SABANA]: arr });
```

(hay una sola, al final del handler `storage:guardarPatronSabana`). Agregar después:
```js
    fbSyncPatronesUp().catch(() => {});
```

- [ ] **Step 5: Auto-sync down al hacer login**

En los handlers `firebase:login` y `firebase:loginGoogle`, después de hacer el login y guardar los tokens, agregar auto-sync down:

En `firebase:login`:
```js
  if (accion === "firebase:login") {
    const { email, password } = mensaje?.payload || {};
    const user = await fbLoginEmail(email, password);
    // Bajar datos guardados en la nube
    Promise.all([fbSyncConfigDown(), fbSyncPatronesDown()]).catch(() => {});
    return user;
  }
```

En `firebase:loginGoogle`:
```js
  if (accion === "firebase:loginGoogle") {
    const user = await fbLoginGoogle();
    Promise.all([fbSyncConfigDown(), fbSyncPatronesDown()]).catch(() => {});
    return user;
  }
```

- [ ] **Step 6: Commit**

```bash
git add background.js
git commit -m "feat: auto-sync to Firestore on every save"
```

---

## Task 4: UI de cuenta en options.html + options.js

**Files:**
- Modify: `options.html` (agregar sección Cuenta al principio del body)
- Modify: `options.js` (agregar lógica de login/logout/sync)

### Qué hace este task
El usuario ve una sección "Cuenta" al abrir Opciones. Si no está logueado: formulario email+contraseña + botón Google. Si está logueado: nombre/email + estado sync + botón sincronizar + botón cerrar sesión.

- [ ] **Step 1: Agregar sección Cuenta en options.html**

Después de `<body>` y el div del logo/título, y ANTES de `<h2>Inteligencia artificial`, agregar:

```html
  <!-- ── CUENTA ──────────────────────────────────────── -->
  <div id="seccion-login">
    <h2 style="margin-top:0;">Cuenta</h2>
    <p class="hint">Guardá tus datos en la nube para que no se pierdan si limpiás Chrome o cambiás de PC.</p>

    <div id="login-form">
      <div class="row">
        <label for="fb-email">Email</label>
        <input id="fb-email" type="text" placeholder="empresa@mail.com" autocomplete="email" />
      </div>
      <div class="row">
        <label for="fb-password">Contraseña</label>
        <input id="fb-password" type="password" placeholder="••••••••" autocomplete="current-password" />
      </div>
      <div class="acciones">
        <button id="btn-login-email" type="button">Ingresar</button>
        <button id="btn-login-google" type="button" class="alt">🔑 Entrar con Google</button>
      </div>
    </div>

    <div id="login-info" style="display:none;">
      <div class="row" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span id="fb-user-label" style="font-size:13px;color:#34d399;"></span>
        <div style="display:flex;gap:8px;">
          <button id="btn-sync" type="button" class="alt">☁ Sincronizar ahora</button>
          <button id="btn-logout" type="button" class="alt">Cerrar sesión</button>
        </div>
      </div>
      <div id="sync-status" class="hint" style="margin-top:4px;"></div>
    </div>
  </div>
  <hr style="border-color:rgba(148,163,184,0.1);margin:24px 0;" />
  <!-- ── FIN CUENTA ──────────────────────────────────── -->
```

- [ ] **Step 2: Agregar lógica de cuenta en options.js**

Al principio de `options.js`, después de las declaraciones de variables, agregar:

```js
// ── Cuenta Firebase ──────────────────────────────────────────

async function actualizarUILogin() {
  const r = await chrome.runtime.sendMessage({ action: "firebase:status" });
  const user = r?.ok ? r.data : null;
  document.getElementById("login-form").style.display = user ? "none" : "block";
  document.getElementById("login-info").style.display = user ? "block" : "none";
  if (user) {
    document.getElementById("fb-user-label").textContent = `✓ ${user.displayName || user.email}`;
  }
}

document.getElementById("btn-login-email").addEventListener("click", async () => {
  const email = document.getElementById("fb-email").value.trim();
  const password = document.getElementById("fb-password").value;
  if (!email || !password) { mostrar("Completá email y contraseña.", "err"); return; }
  try {
    mostrar("Ingresando…", "");
    await chrome.runtime.sendMessage({ action: "firebase:login", payload: { email, password } });
    mostrar("Sesión iniciada. Descargando datos de la nube…", "ok");
    await actualizarUILogin();
    setTimeout(() => cargarConfig(), 1200);
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("btn-login-google").addEventListener("click", async () => {
  try {
    mostrar("Abriendo ventana de Google…", "");
    await chrome.runtime.sendMessage({ action: "firebase:loginGoogle" });
    mostrar("Sesión iniciada. Descargando datos de la nube…", "ok");
    await actualizarUILogin();
    setTimeout(() => cargarConfig(), 1200);
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "firebase:logout" });
  mostrar("Sesión cerrada.", "ok");
  await actualizarUILogin();
});

document.getElementById("btn-sync").addEventListener("click", async () => {
  try {
    document.getElementById("sync-status").textContent = "Sincronizando…";
    const r = await chrome.runtime.sendMessage({ action: "firebase:syncUp" });
    if (!r?.ok) throw new Error(r?.error || "Error");
    document.getElementById("sync-status").textContent = `Subido: config + ${r.data.patrones} patrón(es). ${new Date().toLocaleTimeString()}`;
    mostrar("Sincronizado con la nube.", "ok");
  } catch (e) {
    mostrar(`Error al sincronizar: ${e.message}`, "err");
  }
});
```

- [ ] **Step 3: Llamar actualizarUILogin al cargar la página**

Al final de `options.js`, después de `cargarConfig();`, agregar:

```js
actualizarUILogin();
```

- [ ] **Step 4: Verificar que el layout queda bien visualmente**

Abrir la extensión → clic derecho → Opciones. Verificar:
- Sección "Cuenta" aparece arriba con form email/contraseña + botón Google
- Al ingresar email/contraseña correctos → muestra nombre/email + botones sync/logout
- Al hacer sync → aparece el mensaje de cuántos patrones subió

- [ ] **Step 5: Commit**

```bash
git add options.html options.js
git commit -m "feat: add account login/logout/sync UI to options page"
```

---

## Task 5: Ajustes finales y prueba end-to-end

**Files:**
- Modify: `manifest.json` (asegurarse que login.html no es necesario — usamos options directamente)

### Qué hace este task
Verificar el flujo completo: login → datos se bajan → guardar config → se sube automáticamente → logout → login en otra instancia → datos se restauran.

- [ ] **Step 1: Crear cuenta de prueba en Firebase Console**

Ir a Firebase Console → Authentication → Users → Agregar usuario manualmente.
Email: test@test.com, Contraseña: test1234

- [ ] **Step 2: Probar login email/contraseña**

1. Abrir Opciones de la extensión
2. Ingresar test@test.com / test1234
3. Verificar que aparece "✓ test@test.com"
4. Verificar en Chrome DevTools (Extensions → service worker) que no hay errores de auth

- [ ] **Step 3: Probar auto-sync al guardar**

1. Con sesión activa, ingresar una API key en Opciones y guardar
2. Abrir Firebase Console → Firestore → users/{uid}/config → verificar que `apiKey` se guardó

- [ ] **Step 4: Probar sync down al re-loguearse**

1. Cerrar sesión desde Opciones
2. Limpiar storage local: ir a chrome://extensions → tu extensión → "Clear storage"
3. Volver a Opciones → loguear → verificar que la API key se restauró automáticamente

- [ ] **Step 5: Probar sync de patrones**

1. Con sesión activa, ir al modo Aprender → crear un patrón de sábana
2. Verificar en Firestore → users/{uid}/patrones que aparece el patrón
3. Borrar storage local → re-logear → verificar que el patrón vuelve

- [ ] **Step 6: Agregar las Firestore Security Rules**

En Firebase Console → Firestore → Rules → reemplazar con:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Publicar las reglas.

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "feat: complete Firebase Auth + Firestore sync integration"
```

---

## Notas de implementación

### Qué se sincroniza vs qué queda local

| Dato | Dónde se guarda | Se sincroniza |
|---|---|---|
| API key Claude | Firestore + local | ✓ |
| Modelo Claude | Firestore + local | ✓ |
| Usuario/pass CD | Firestore + local | ✓ |
| Token Telegram | Firestore + local | ✓ |
| Chat ID Telegram | Firestore + local | ✓ |
| Config TG (días, frecuencia) | Firestore + local | ✓ |
| Patrones de sábana (metadata) | Firestore + local | ✓ |
| Imágenes de referencia | Solo IndexedDB | ✗ (local only) |
| Mapeos aprendidos | Firestore + local | ✓ |

Las imágenes de referencia se regeneran al subir el PDF sábana nuevamente (flujo Aprender).

### Seguridad de datos sensibles
- Las credenciales de CD (usuario/contraseña) y el token de Telegram se guardan en Firestore. Están protegidos por las Firestore Security Rules (solo el uid dueño puede leer/escribir) y por HTTPS. Esto es aceptable para el caso de uso.
- Si en el futuro se requiere más seguridad, se puede cifrar en el cliente antes de guardar en Firestore.

### Google Auth — ID de extensión
El OAuth client ID de Google requiere que el URI de redireccionamiento `https://<EXTENSION_ID>.chromiumapp.org/` esté autorizado. El EXTENSION_ID cambia si la extensión se reinstala en modo desarrollador. Para producción (publicada en Chrome Web Store), el ID es fijo.

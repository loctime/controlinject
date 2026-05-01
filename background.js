chrome.runtime.onInstalled.addListener(() => {
  console.log("DocAutomatización instalado correctamente.");
  migrarStorageLegacy().catch((e) => console.warn("[ControlInject] Migracion legacy fallo:", e));
});

const KEY_MAPEOS = "controlinject_mapeos_aprendidos";
const KEY_PATRONES_SABANA = "controlinject_patrones_sabana";
const KEY_API_KEY = "controlinject_anthropic_api_key";
const KEY_MODELO = "controlinject_anthropic_modelo";
const KEY_AI_PROXY_URL = "controlinject_ai_proxy_url";
const KEY_CONTROLFILE_BASE_URL = "controlinject_controlfile_base_url";

const KEY_CD_USER = "controlinject_cd_user";
const KEY_CD_PASS = "controlinject_cd_pass";

const KEY_TG_TOKEN = "controlinject_tg_token";
const KEY_TG_CHATID = "controlinject_tg_chatid";
const KEY_TG_DIAS = "controlinject_tg_dias"; // legacy dentro del flujo de Telegram
const KEY_TG_DIAS_PERSONAL = "controlinject_tg_dias_personal";
const KEY_TG_DIAS_VEHICULOS = "controlinject_tg_dias_vehiculos";
const KEY_TG_FRECUENCIA = "controlinject_tg_frecuencia";
const KEY_TG_ACTIVO = "controlinject_tg_activo";
const KEY_TG_SILENCIO_DESDE = "controlinject_tg_silencio_desde";
const KEY_TG_SILENCIO_HASTA = "controlinject_tg_silencio_hasta";
const KEY_TG_ULTIMO_HASH = "controlinject_tg_ultimo_hash";
const KEY_TG_UPDATE_OFFSET = "controlinject_tg_update_offset";
const KEY_TG_PENDIENTE_DOC = "controlinject_tg_pendiente_doc";
const KEY_TG_PENDIENTE_SABANA = "controlinject_tg_pendiente_sabana";

const ALARMA_TG = "controlinject_alarma_telegram";
const ALARMA_TG_POLL = "controlinject_alarma_tg_poll";

// Tope práctico para descarga de archivos por Bot API de Telegram (~20 MB).
const TG_MAX_PDF_BYTES = 20 * 1024 * 1024;

const MODELO_DEFAULT = "claude-haiku-4-5-20251001";
const IA_PROXY_URL_HARDCODED = "https://controlinject.vercel.app/api/anthropic/messages";

// ===================== FIREBASE =====================
const FB_API_KEY = "AIzaSyAOwCob-DvmU0R0nbyk12XlBLxirV1gXVs";
const FB_PROJECT_ID = "controlstorage-eb796";
const FB_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";
const FB_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";
const FB_FS_URL = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT_ID}/databases/(default)/documents`;
const GOOGLE_CLIENT_ID = "909876364192-da3m0kr3of77fhk1f9jnjjobogv9a8jd.apps.googleusercontent.com";
const KEY_FB_AUTH = "controlinject_fb_auth";
const APP_FS_ID = "control-inject";
const CF_UPLOAD_MAPPING_PATH = "/api/apps/controlinject/upload-mapping";
const CF_DOWNLOAD_MAPPING_PATH = "/api/apps/controlinject/download-mapping";

const LEGACY_STORAGE_PREFIX = atob("bWF0ZXNpbg==");
const legacyStorageKey = (suffix) => `${LEGACY_STORAGE_PREFIX}_${suffix}`;
const LEGACY_STORAGE_KEYS = Object.fromEntries([
  ["mapeos_aprendidos", KEY_MAPEOS],
  ["patrones_sabana", KEY_PATRONES_SABANA],
  ["anthropic_api_key", KEY_API_KEY],
  ["anthropic_modelo", KEY_MODELO],
  ["ai_proxy_url", KEY_AI_PROXY_URL],
  ["controlfile_base_url", KEY_CONTROLFILE_BASE_URL],
  ["cd_user", KEY_CD_USER],
  ["cd_pass", KEY_CD_PASS],
  ["tg_token", KEY_TG_TOKEN],
  ["tg_chatid", KEY_TG_CHATID],
  ["tg_dias", KEY_TG_DIAS],
  ["tg_dias_personal", KEY_TG_DIAS_PERSONAL],
  ["tg_dias_vehiculos", KEY_TG_DIAS_VEHICULOS],
  ["tg_frecuencia", KEY_TG_FRECUENCIA],
  ["tg_activo", KEY_TG_ACTIVO],
  ["tg_silencio_desde", KEY_TG_SILENCIO_DESDE],
  ["tg_silencio_hasta", KEY_TG_SILENCIO_HASTA],
  ["tg_ultimo_hash", KEY_TG_ULTIMO_HASH],
  ["tg_update_offset", KEY_TG_UPDATE_OFFSET],
  ["fb_auth", KEY_FB_AUTH],
  ["tg_pendiente_doc", KEY_TG_PENDIENTE_DOC],
  ["tg_pendiente_sabana", KEY_TG_PENDIENTE_SABANA]
].map(([suffix, currentKey]) => [legacyStorageKey(suffix), currentKey]));

async function migrarStorageLegacy() {
  const legacyKeys = Object.keys(LEGACY_STORAGE_KEYS);
  const currentKeys = [...new Set(Object.values(LEGACY_STORAGE_KEYS))];
  const data = await chrome.storage.local.get([...legacyKeys, ...currentKeys]);
  const migrado = {};
  for (const [legacyKey, currentKey] of Object.entries(LEGACY_STORAGE_KEYS)) {
    if (data[currentKey] === undefined && data[legacyKey] !== undefined) {
      migrado[currentKey] = data[legacyKey];
    }
  }
  if (Object.keys(migrado).length) await chrome.storage.local.set(migrado);
}

migrarStorageLegacy().catch((e) => console.warn("[ControlInject] Migracion legacy fallo:", e));

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fbFetch(url, init = {}) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Firebase error ${res.status}`);
  return json;
}

async function fbGetAuth() {
  const data = await chrome.storage.local.get(KEY_FB_AUTH);
  return data[KEY_FB_AUTH] || null;
}

async function fbSetAuth(auth) {
  await chrome.storage.local.set({ [KEY_FB_AUTH]: auth });
}

async function fbClearAuth() {
  await chrome.storage.local.remove(KEY_FB_AUTH);
}

async function fbRefreshIdToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const data = await fbFetch(`${FB_TOKEN_URL}?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token || refreshToken,
    uid: data.user_id,
    email: null
  };
}

async function fbGetValidAuth() {
  const auth = await fbGetAuth();
  if (!auth) return null;
  const now = Date.now();
  if (!auth.expiresAt || auth.expiresAt <= now + 60000) {
    if (!auth.refreshToken) return null;
    const refreshed = await fbRefreshIdToken(auth.refreshToken);
    const merged = {
      ...auth,
      ...refreshed,
      expiresAt: now + 55 * 60 * 1000
    };
    await fbSetAuth(merged);
    return merged;
  }
  return auth;
}

async function fbLoginEmail(email, password) {
  const data = await fbFetch(`${FB_AUTH_URL}:signInWithPassword?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const auth = {
    uid: data.localId,
    email: data.email || email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    provider: "password",
    expiresAt: Date.now() + (parseInt(data.expiresIn, 10) || 3600) * 1000
  };
  await fbSetAuth(auth);
  return { uid: auth.uid, email: auth.email, provider: auth.provider };
}

async function fbRegisterEmail(email, password) {
  const data = await fbFetch(`${FB_AUTH_URL}:signUp?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const auth = {
    uid: data.localId,
    email: data.email || email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    provider: "password",
    expiresAt: Date.now() + (parseInt(data.expiresIn, 10) || 3600) * 1000
  };
  await fbSetAuth(auth);
  return { uid: auth.uid, email: auth.email, provider: auth.provider };
}

async function fbLoginGoogle() {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("prompt", "select_account");

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true }, (url) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!url) return reject(new Error("No se recibió respuesta de Google."));
      resolve(url);
    });
  });

  const hash = responseUrl.split("#")[1] || "";
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  if (!accessToken) throw new Error("No se obtuvo access_token de Google.");

  const data = await fbFetch(`${FB_AUTH_URL}:signInWithIdp?key=${FB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postBody: `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`,
      requestUri: redirectUri,
      returnSecureToken: true,
      returnIdpCredential: true
    })
  });

  const auth = {
    uid: data.localId,
    email: data.email || "",
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    provider: "google.com",
    expiresAt: Date.now() + (parseInt(data.expiresIn, 10) || 3600) * 1000
  };
  await fbSetAuth(auth);
  return { uid: auth.uid, email: auth.email, provider: auth.provider };
}

function fsToValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsToValue) } };
  if (typeof v === "object") {
    const fields = {};
    Object.entries(v).forEach(([k, val]) => { fields[k] = fsToValue(val); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fsFromValue(v) {
  if (!v || typeof v !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(v, "stringValue")) return v.stringValue;
  if (Object.prototype.hasOwnProperty.call(v, "booleanValue")) return v.booleanValue;
  if (Object.prototype.hasOwnProperty.call(v, "integerValue")) return parseInt(v.integerValue, 10);
  if (Object.prototype.hasOwnProperty.call(v, "doubleValue")) return v.doubleValue;
  if (Object.prototype.hasOwnProperty.call(v, "nullValue")) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fsFromValue);
  if (v.mapValue) {
    const out = {};
    Object.entries(v.mapValue.fields || {}).forEach(([k, val]) => { out[k] = fsFromValue(val); });
    return out;
  }
  return null;
}

function fsFromDoc(doc) {
  const out = {};
  Object.entries(doc?.fields || {}).forEach(([k, val]) => { out[k] = fsFromValue(val); });
  return out;
}

async function fsSetDoc(path, payload, idToken) {
  const url = `${FB_FS_URL}/${path}`;
  return await fbFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, fsToValue(v)])) })
  });
}

async function fsGetDoc(path, idToken) {
  const url = `${FB_FS_URL}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Firestore error ${res.status}`);
  return fsFromDoc(json);
}

async function fsListCollection(path, idToken) {
  const url = `${FB_FS_URL}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return [];
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Firestore error ${res.status}`);
  return (json.documents || []).map((d) => {
    const data = fsFromDoc(d);
    const id = (d.name || "").split("/").pop();
    return { id, ...data };
  });
}

function fbSafeDocId(value) {
  return String(value || "").replace(/[/.#?[\]]/g, "_").slice(0, 150);
}

function fsAppPath(path = "") {
  const clean = String(path || "").replace(/^\/+/, "");
  return clean ? `apps/${APP_FS_ID}/${clean}` : `apps/${APP_FS_ID}`;
}

function fsUserDocPath(uid) {
  return fsAppPath(`users/${uid}`);
}

function fsPatronDocPath(uid, docId) {
  return fsAppPath(`users/${uid}/patrones/${docId}`);
}

function fsPatronesCollectionPath(uid) {
  return fsAppPath(`users/${uid}/patrones`);
}

async function cfGetBackendBaseUrl() {
  const auth = await fbGetValidAuth();
  if (!auth?.uid) throw new Error("No hay sesión Firebase activa.");
  const data = await chrome.storage.local.get([KEY_CONTROLFILE_BASE_URL]);
  const baseUrl = String(data[KEY_CONTROLFILE_BASE_URL] || "").trim();
  if (!baseUrl) {
    throw new Error(`Falta configurar ControlStorage baseUrl (clave ${KEY_CONTROLFILE_BASE_URL}).`);
  }
  if (!auth?.idToken) throw new Error("No hay token Firebase válido.");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), auth };
}

function normalizarSegmentoPath(valor) {
  return String(valor || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "sin_nombre";
}

async function cfSubirReferenciaPatronRemoto(payload) {
  const nombre = String(payload?.nombre || "").trim();
  const imagenes = Array.isArray(payload?.imagenes) ? payload.imagenes : [];
  const bloques = Array.isArray(payload?.bloques) ? payload.bloques : [];
  if (!nombre) throw new Error("Falta nombre de patrón.");
  if (!imagenes.length) throw new Error("No hay imágenes para subir.");

  const fecha = new Date().toISOString().slice(0, 10);
  const path = ["mapeos", normalizarSegmentoPath(nombre), fecha];

  const snapshot = {
    nombre,
    imagenes,
    bloques,
    guardadoEn: Date.now(),
    version: 1
  };
  const { baseUrl, auth } = await cfGetBackendBaseUrl();
  const fileName = `referencia-${normalizarSegmentoPath(nombre)}.json`;
  const res = await fetch(`${baseUrl}${CF_UPLOAD_MAPPING_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`
    },
    body: JSON.stringify({
      appId: "controlinject",
      nombre,
      fileName,
      path,
      snapshot
    })
  });
  const uploaded = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(uploaded?.error || uploaded?.message || `Upload mapping falló (${res.status}).`);

  const fileId = uploaded?.fileId;
  if (!fileId) throw new Error("ControlStorage no devolvió fileId.");

  const docId = fbSafeDocId(nombre);
  await fsSetDoc(fsPatronDocPath(auth.uid, docId), {
    nombre,
    controlStorageRef: {
      fileId,
      fileName: uploaded?.fileName || fileName,
      fileSize: uploaded?.fileSize || null,
      downloadUrl: uploaded?.downloadUrl || null,
      shareUrl: uploaded?.shareUrl || null,
      updatedAtMs: Date.now()
    }
  }, auth.idToken);

  return {
    ok: true,
    fileId,
    downloadUrl: uploaded?.downloadUrl || null,
    shareUrl: uploaded?.shareUrl || null
  };
}

async function cfDescargarReferenciaPatronRemoto(nombrePatron) {
  const nombre = String(nombrePatron || "").trim();
  if (!nombre) throw new Error("Falta nombre de patrón.");
  const { baseUrl, auth } = await cfGetBackendBaseUrl();
  const docId = fbSafeDocId(nombre);
  const patron = await fsGetDoc(fsPatronDocPath(auth.uid, docId), auth.idToken);
  const fileId = patron?.controlStorageRef?.fileId;
  if (!fileId) return null;
  const res = await fetch(`${baseUrl}${CF_DOWNLOAD_MAPPING_PATH}?fileId=${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${auth.idToken}` }
  });
  if (!res.ok) throw new Error(`No se pudo descargar referencia remota (${res.status}).`);
  const data = await res.json();
  return {
    nombre: data?.nombre || nombre,
    imagenes: Array.isArray(data?.imagenes) ? data.imagenes : [],
    bloques: Array.isArray(data?.bloques) ? data.bloques : [],
    imagenesPorBloque: data?.imagenesPorBloque || null
  };
}

async function cfDebugUpload() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nombre = `debug-controlstorage-${stamp}`;
  const pixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Q6o0AAAAASUVORK5CYII=";
  return await cfSubirReferenciaPatronRemoto({
    nombre,
    imagenes: [{ pagina: 1, base64: `data:image/png;base64,${pixel}` }],
    bloques: [{
      nombre: "Debug",
      paginas: [1],
      requerimientos: [],
      destino: { modo: "uno", entidadesObjetivo: [] },
      meta: {}
    }]
  });
}

async function fbSyncConfigUp() {
  const auth = await fbGetValidAuth();
  if (!auth?.idToken || !auth.uid) throw new Error("No hay sesión Firebase activa.");

  const local = await chrome.storage.local.get([
    KEY_API_KEY, KEY_MODELO, KEY_AI_PROXY_URL, KEY_CD_USER, KEY_CD_PASS, KEY_TG_TOKEN, KEY_TG_CHATID,
    KEY_TG_DIAS_PERSONAL, KEY_TG_DIAS_VEHICULOS, KEY_TG_FRECUENCIA, KEY_TG_ACTIVO,
    KEY_TG_SILENCIO_DESDE, KEY_TG_SILENCIO_HASTA, KEY_MAPEOS, KEY_PATRONES_SABANA
  ]);

  await fsSetDoc(fsUserDocPath(auth.uid), {
    uid: auth.uid,
    email: auth.email || "",
    apiKey: local[KEY_API_KEY] || "",
    modelo: local[KEY_MODELO] || MODELO_DEFAULT,
    aiProxyUrl: local[KEY_AI_PROXY_URL] || "",
    cdUser: local[KEY_CD_USER] || "",
    cdPass: local[KEY_CD_PASS] || "",
    tgToken: local[KEY_TG_TOKEN] || "",
    tgChatId: local[KEY_TG_CHATID] || "",
    tgDiasPersonal: local[KEY_TG_DIAS_PERSONAL] || 7,
    tgDiasVehiculos: local[KEY_TG_DIAS_VEHICULOS] || 15,
    tgFrecuencia: local[KEY_TG_FRECUENCIA] || 180,
    tgActivo: !!local[KEY_TG_ACTIVO],
    tgSilencioDesde: local[KEY_TG_SILENCIO_DESDE] || "22:00",
    tgSilencioHasta: local[KEY_TG_SILENCIO_HASTA] || "08:00",
    mapeosAprendidos: local[KEY_MAPEOS] || {},
    updatedAtMs: Date.now()
  }, auth.idToken);

  const patrones = Array.isArray(local[KEY_PATRONES_SABANA]) ? local[KEY_PATRONES_SABANA] : [];
  await Promise.all(patrones.map(async (p) => {
    const docId = fbSafeDocId(p.nombre || `patron_${Date.now()}`);
    await fsSetDoc(fsPatronDocPath(auth.uid, docId), {
      nombre: p.nombre || "",
      bloquesModal: Array.isArray(p.bloquesModal) ? p.bloquesModal : [],
      firmaTipos: Array.isArray(p.firmaTipos) ? p.firmaTipos : [],
      bloques: Array.isArray(p.bloques) ? p.bloques : null,
      firma: Array.isArray(p.firma) ? p.firma : null,
      totalPaginas: p.totalPaginas || null,
      updatedAtMs: p.updatedAt || Date.now()
    }, auth.idToken);
  }));

  return { ok: true, uid: auth.uid, patrones: patrones.length };
}

async function fbSyncConfigDown() {
  const auth = await fbGetValidAuth();
  if (!auth?.idToken || !auth.uid) throw new Error("No hay sesión Firebase activa.");

  const config = await fsGetDoc(fsUserDocPath(auth.uid), auth.idToken);
  if (config) {
    await chrome.storage.local.set({
      [KEY_API_KEY]: config.apiKey || "",
      [KEY_MODELO]: config.modelo || MODELO_DEFAULT,
      [KEY_AI_PROXY_URL]: config.aiProxyUrl || "",
      [KEY_CD_USER]: config.cdUser || "",
      [KEY_CD_PASS]: config.cdPass || "",
      [KEY_TG_TOKEN]: config.tgToken || "",
      [KEY_TG_CHATID]: config.tgChatId || "",
      [KEY_TG_DIAS_PERSONAL]: config.tgDiasPersonal || 7,
      [KEY_TG_DIAS_VEHICULOS]: config.tgDiasVehiculos || 15,
      [KEY_TG_FRECUENCIA]: config.tgFrecuencia || 180,
      [KEY_TG_ACTIVO]: !!config.tgActivo,
      [KEY_TG_SILENCIO_DESDE]: config.tgSilencioDesde || "22:00",
      [KEY_TG_SILENCIO_HASTA]: config.tgSilencioHasta || "08:00",
      [KEY_MAPEOS]: config.mapeosAprendidos || {}
    });
  }

  const patrones = await fsListCollection(fsPatronesCollectionPath(auth.uid), auth.idToken);
  if (patrones.length) {
    await chrome.storage.local.set({
      [KEY_PATRONES_SABANA]: patrones.map((p) => ({
        nombre: p.nombre || p.id,
        bloquesModal: Array.isArray(p.bloquesModal) ? p.bloquesModal : [],
        firmaTipos: Array.isArray(p.firmaTipos) ? p.firmaTipos : [],
        bloques: Array.isArray(p.bloques) ? p.bloques : undefined,
        firma: Array.isArray(p.firma) ? p.firma : undefined,
        totalPaginas: p.totalPaginas || undefined,
        updatedAt: p.updatedAtMs || Date.now(),
        controlStorageRef: p.controlStorageRef || null
      }))
    });
  }

  try { await tgReprogramarAlarma(); } catch (_) {}
  return { ok: true, uid: auth.uid, patrones: patrones.length };
}

chrome.runtime.onMessage.addListener((mensaje, _sender, sendResponse) => {
  manejarMensaje(mensaje)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

async function manejarMensaje(mensaje) {
  const accion = mensaje?.action;
  if (!accion) throw new Error("Mensaje sin acción.");

  if (accion === "storage:getMemory") {
    const data = await chrome.storage.local.get(KEY_MAPEOS);
    return data[KEY_MAPEOS] || {};
  }

  if (accion === "storage:setMemory") {
    const memoria = mensaje?.payload || {};
    await chrome.storage.local.set({ [KEY_MAPEOS]: memoria });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }

  if (accion === "storage:learnPattern") {
    const nombreArchivo = mensaje?.payload?.nombreArchivo || "";
    const requerimiento = mensaje?.payload?.requerimiento || "";
    if (!nombreArchivo || !requerimiento) throw new Error("Faltan datos para aprender patrón.");
    const data = await chrome.storage.local.get(KEY_MAPEOS);
    const memoria = data[KEY_MAPEOS] || {};
    memoria[normalizar(nombreArchivo)] = requerimiento;
    await chrome.storage.local.set({ [KEY_MAPEOS]: memoria });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }

  if (accion === "storage:clearMemory") {
    await chrome.storage.local.set({ [KEY_MAPEOS]: {} });
    return { cleared: true };
  }

  if (accion === "storage:leerPatronesSabana") {
    const data = await chrome.storage.local.get(KEY_PATRONES_SABANA);
    return data[KEY_PATRONES_SABANA] || [];
  }

  if (accion === "storage:guardarPatronSabana") {
    const payload = mensaje?.payload || {};
    const nombre = String(payload.nombre || "").trim();
    const bloques = payload.bloques;
    const firma = payload.firma;
    const bloquesModal = payload.bloquesModal;
    const firmaTipos = payload.firmaTipos;
    if (!nombre) throw new Error("Falta el nombre del patrón.");
    const tieneViejo = Array.isArray(bloques) && Array.isArray(firma);
    const tieneNuevo = Array.isArray(bloquesModal) && Array.isArray(firmaTipos);
    if (!tieneViejo && !tieneNuevo) throw new Error("Patrón inválido.");
    const data = await chrome.storage.local.get(KEY_PATRONES_SABANA);
    const arr = data[KEY_PATRONES_SABANA] || [];
    const idx = arr.findIndex((p) => p.nombre === nombre);
    const entry = { nombre, updatedAt: Date.now() };
    if (tieneViejo) { entry.bloques = bloques; entry.firma = firma; }
    if (tieneNuevo) {
      entry.bloquesModal = bloquesModal;
      entry.firmaTipos = firmaTipos;
      if (payload.totalPaginas != null) entry.totalPaginas = payload.totalPaginas;
    }
    if (idx >= 0) arr[idx] = entry;
    else arr.push(entry);
    await chrome.storage.local.set({ [KEY_PATRONES_SABANA]: arr });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }

  if (accion === "storage:guardarImagenesPatronRemoto") {
    return await cfSubirReferenciaPatronRemoto(mensaje?.payload || {});
  }

  if (accion === "storage:descargarImagenesPatronRemoto") {
    return await cfDescargarReferenciaPatronRemoto(mensaje?.payload?.nombre || "");
  }

  if (accion === "storage:guardarPatronesSabana") {
    const lista = mensaje?.payload;
    if (!Array.isArray(lista)) throw new Error("Se esperaba un array de patrones.");
    await chrome.storage.local.set({ [KEY_PATRONES_SABANA]: lista });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }

  if (accion === "storage:limpiarPatronesSabana") {
    await chrome.storage.local.set({ [KEY_PATRONES_SABANA]: [] });
    return { cleared: true };
  }

  if (accion === "mapeos:getTabCD") {
    const { tabId } = await tgConseguirTabControldoc();
    return { tabId };
  }

  if (accion === "mapeos:renderThumbnails") {
    const base64 = mensaje?.payload?.base64;
    const escala = parseFloat(mensaje?.payload?.escala) || 0.5;
    const tabIdExterno = mensaje?.payload?.tabId || null;
    if (!base64) throw new Error("Falta el PDF (base64).");
    return await renderPdfParaMapeos(base64, escala, tabIdExterno);
  }

  if (accion === "mapeos:getSobres") {
    const { tabId } = await tgConseguirTabControldoc();
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const sel = document.getElementById("ctl00_ContentPlaceHolderMain_cmbSobre");
        if (!sel) return [];
        return [...sel.options]
          .map(o => o.text.trim())
          .filter(t => t && t !== "-" && t.toLowerCase() !== "todos");
      }
    });
    return Array.isArray(result) ? result : [];
  }

  if (accion === "storage:exportarMapeo") {
    const data = await chrome.storage.local.get([KEY_PATRONES_SABANA, KEY_MAPEOS]);
    return {
      version: 1,
      exportadoEl: new Date().toISOString(),
      patrones_sabana: data[KEY_PATRONES_SABANA] || [],
      mapeos_aprendidos: data[KEY_MAPEOS] || {}
    };
  }

  if (accion === "storage:importarMapeo") {
    const payload = mensaje?.payload || {};
    if (!payload.patrones_sabana && !payload.mapeos_aprendidos) throw new Error("Archivo inválido.");
    const toSave = {};
    if (Array.isArray(payload.patrones_sabana)) toSave[KEY_PATRONES_SABANA] = payload.patrones_sabana;
    if (payload.mapeos_aprendidos && typeof payload.mapeos_aprendidos === "object") toSave[KEY_MAPEOS] = payload.mapeos_aprendidos;
    await chrome.storage.local.set(toSave);
    return {
      patrones: (payload.patrones_sabana || []).length,
      mapeos: Object.keys(payload.mapeos_aprendidos || {}).length
    };
  }

  if (accion === "storage:getApiKey") {
    const data = await chrome.storage.local.get([KEY_API_KEY, KEY_MODELO, KEY_AI_PROXY_URL]);
    return {
      apiKey: data[KEY_API_KEY] || "",
      modelo: data[KEY_MODELO] || MODELO_DEFAULT,
      proxyUrl: data[KEY_AI_PROXY_URL] || ""
    };
  }

  if (accion === "storage:setApiKey") {
    const apiKey = String(mensaje?.payload?.apiKey || "").trim();
    const modelo = String(mensaje?.payload?.modelo || MODELO_DEFAULT).trim();
    const proxyUrl = String(mensaje?.payload?.proxyUrl || "").trim();
    await chrome.storage.local.set({ [KEY_API_KEY]: apiKey, [KEY_MODELO]: modelo, [KEY_AI_PROXY_URL]: proxyUrl });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }

  if (accion === "ai:extraerMetadataPagina") {
    const base64 = mensaje?.payload?.base64;
    const mediaType = mensaje?.payload?.mediaType || "image/jpeg";
    if (!base64) throw new Error("Falta imagen base64.");
    return await extraerMetadataPaginaConClaude(base64, mediaType);
  }

  if (accion === "ai:compararConReferencia") {
    const { nuevasPaginas, referencia } = mensaje?.payload || {};
    if (!Array.isArray(nuevasPaginas) || !referencia) throw new Error("Faltan datos para comparar.");
    return await compararPaginasConReferencia(nuevasPaginas, referencia);
  }

  if (accion === "ai:probarConexion") {
    return await probarConexionClaude();
  }

  if (accion === "ai:debugEstado") {
    return await debugEstadoIA();
  }

  if (accion === "auth:getCreds") {
    const data = await chrome.storage.local.get([KEY_CD_USER, KEY_CD_PASS]);
    return {
      user: data[KEY_CD_USER] || "",
      pass: data[KEY_CD_PASS] || ""
    };
  }

  if (accion === "auth:setCreds") {
    const user = String(mensaje?.payload?.user || "").trim();
    const pass = String(mensaje?.payload?.pass || "");
    await chrome.storage.local.set({ [KEY_CD_USER]: user, [KEY_CD_PASS]: pass });
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }

  if (accion === "controlfile:getBaseUrl") {
    const data = await chrome.storage.local.get([KEY_CONTROLFILE_BASE_URL]);
    return { baseUrl: data[KEY_CONTROLFILE_BASE_URL] || "" };
  }

  if (accion === "controlfile:setBaseUrl") {
    const baseUrl = String(mensaje?.payload?.baseUrl || "").trim();
    await chrome.storage.local.set({ [KEY_CONTROLFILE_BASE_URL]: baseUrl });
    fbSyncConfigUp().catch(() => {});
    return { saved: true, baseUrl };
  }

  if (accion === "controlfile:debugUpload") {
    return await cfDebugUpload();
  }

  if (accion === "auth:probarLogin") {
    const r = await cdReLogin({ visible: false });
    if (!r.ok) throw new Error(r.motivo || "No se pudo loguear.");
    return { ok: true };
  }

  if (accion === "tg:getConfig") {
    return await tgGetConfig();
  }

  if (accion === "tg:setConfig") {
    const p = mensaje?.payload || {};
    await tgSetConfig(p);
    await tgReprogramarAlarma();
    // Registrar comandos para que aparezcan con la barra en Telegram.
    try {
      const cfg = await tgGetConfig();
      if (cfg.token) await tgRegistrarComandos(cfg.token);
    } catch (e) {
      console.warn("[MAU] No se pudieron registrar los comandos:", e);
    }
    fbSyncConfigUp().catch(() => {});
    return { saved: true };
  }

  if (accion === "firebase:status") {
    const auth = await fbGetValidAuth().catch(() => null);
    if (!auth?.uid) return { user: null };
    return { user: { uid: auth.uid, email: auth.email || "", provider: auth.provider || "" } };
  }

  if (accion === "firebase:login") {
    const email = String(mensaje?.payload?.email || "").trim();
    const password = String(mensaje?.payload?.password || "");
    if (!email || !password) throw new Error("Falta email o contraseña.");
    const user = await fbLoginEmail(email, password);
    try { await fbSyncConfigDown(); } catch (_) {}
    return { user };
  }

  if (accion === "firebase:register") {
    throw new Error("El registro de nuevas cuentas está deshabilitado. Contactá al administrador.");
  }

  if (accion === "firebase:loginGoogle") {
    const user = await fbLoginGoogle();
    try { await fbSyncConfigDown(); } catch (_) {}
    return { user };
  }

  if (accion === "firebase:logout") {
    await fbClearAuth();
    return { ok: true };
  }

  if (accion === "firebase:syncUp") {
    return await fbSyncConfigUp();
  }

  if (accion === "firebase:syncDown") {
    return await fbSyncConfigDown();
  }

  if (accion === "tg:probar") {
    const cfg = await tgGetConfig();
    if (!cfg.token || !cfg.chatId) throw new Error("Falta token o Chat ID.");
    const texto = "✅ Prueba de DocAutomatización — el bot está conectado.";
    await tgEnviarMensaje(cfg.token, cfg.chatId, texto);
    return { enviado: true };
  }

  if (accion === "tg:chequearAhora") {
    const res = await tgChequearYAvisar({ forzarEnvio: true });
    return res;
  }

  if (accion === "tg:chequearVisible") {
    const res = await tgChequearYAvisar({ forzarEnvio: true, visible: true });
    return res;
  }

  throw new Error(`Acción no soportada: ${accion}`);
}

// ===================== LOGIN AUTO =====================

/**
 * Intenta iniciar sesión en controldocumentario.com/Login.aspx
 * usando el usuario y contraseña guardados en Opciones.
 *
 * Abre Login.aspx en pestaña (oculta por defecto), busca el primer
 * input de texto visible (usuario), el primer input tipo password
 * (contraseña) y el botón/submit con texto "INGRESAR", lo clickea y
 * espera a que el sitio redirija fuera de Login.aspx (= login OK).
 *
 * Devuelve { ok: true } si el login fue exitoso,
 * o { ok: false, motivo: "..." } si falló (sin credenciales, timeout,
 * credenciales incorrectas, etc.).
 */
async function cdReLogin({ visible = false } = {}) {
  const creds = await chrome.storage.local.get([KEY_CD_USER, KEY_CD_PASS]);
  const user = creds[KEY_CD_USER] || "";
  const pass = creds[KEY_CD_PASS] || "";
  if (!user || !pass) {
    return { ok: false, motivo: "No hay usuario/contraseña guardados en Opciones." };
  }

  const url = "https://controldocumentario.com/Login.aspx";
  const tab = await chrome.tabs.create({ url, active: !!visible });
  const tabId = tab.id;
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  const esperarCargaTab = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handler);
      reject(new Error("Timeout cargando login"));
    }, 30000);
    function handler(updId, info) {
      if (updId === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(handler);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(handler);
  });

  try {
    await esperarCargaTab();
    await dormir(1500);

    // 1) Rellenar campos y disparar el submit
    const [{ result: intentoLogin } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (usuario, clave) => {
        function esVisible(el) {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const cs = window.getComputedStyle(el);
          return cs.visibility !== "hidden" && cs.display !== "none";
        }
        function dispararEventos(el) {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // Buscar input de texto visible (primer text/email sin tipo password)
        const inputsTexto = Array.from(document.querySelectorAll('input'))
          .filter(i => {
            const t = (i.type || "text").toLowerCase();
            return (t === "text" || t === "email" || t === "" ) && esVisible(i);
          });
        const inputUser = inputsTexto[0];

        const inputPass = Array.from(document.querySelectorAll('input[type="password"]'))
          .find(esVisible);

        if (!inputUser || !inputPass) {
          return { rellenado: false, motivo: "No encontré los campos de usuario/contraseña." };
        }

        inputUser.focus();
        inputUser.value = usuario;
        dispararEventos(inputUser);

        inputPass.focus();
        inputPass.value = clave;
        dispararEventos(inputPass);

        // Buscar el botón INGRESAR (input submit, button o anchor con texto INGRESAR)
        const candidatos = [
          ...document.querySelectorAll('input[type="submit"]'),
          ...document.querySelectorAll('input[type="button"]'),
          ...document.querySelectorAll('button'),
          ...document.querySelectorAll('a')
        ].filter(esVisible);

        // Preferir el que diga "INGRESAR"; excluir los de Microsoft / Autogestión / Soy nuevo / Olvidó
        const malos = ["microsoft", "autogestion", "autogestión", "soy nuevo", "olvido", "olvidó"];
        const esMalo = (t) => malos.some(m => t.includes(m));

        let btn = candidatos.find(b => {
          const t = (b.value || b.textContent || "").toLowerCase().trim();
          return t.includes("ingresar") && !esMalo(t);
        });

        // Si no, cualquier submit que no sea malo
        if (!btn) {
          btn = candidatos.find(b => {
            const t = (b.value || b.textContent || "").toLowerCase().trim();
            return (b.type === "submit" || b.tagName === "BUTTON") && !esMalo(t);
          });
        }

        if (!btn) {
          // Último recurso: submit del form de los inputs
          const form = inputPass.form || inputUser.form;
          if (form) {
            try { form.submit(); return { rellenado: true, submitForm: true }; } catch (e) {}
          }
          return { rellenado: false, motivo: "No encontré el botón INGRESAR." };
        }

        btn.click();
        return { rellenado: true, botonTexto: (btn.value || btn.textContent || "").trim() };
      },
      args: [user, pass]
    });

    if (!intentoLogin?.rellenado) {
      return { ok: false, motivo: intentoLogin?.motivo || "No se pudo completar el formulario." };
    }

    // 2) Esperar la redirección. Login OK = la URL ya no contiene "login".
    const inicio = Date.now();
    while (Date.now() - inicio < 20000) {
      await dormir(1000);
      try {
        const t = await chrome.tabs.get(tabId);
        const urlActual = (t.url || "").toLowerCase();
        if (!urlActual.includes("login")) {
          // Login OK
          return { ok: true };
        }
        // Detectar mensaje de error en la pantalla (credenciales incorrectas, etc.)
        const [{ result: tieneError } = {}] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const texto = (document.body.innerText || "").toLowerCase();
            return /incorrect|inv[aá]lid|err[oó]r|usuario o contrase/.test(texto);
          }
        }).catch(() => [{}]);
        if (tieneError) {
          return { ok: false, motivo: "Usuario o contraseña incorrectos." };
        }
      } catch (e) {
        // La pestaña podría haberse cerrado — seguir intentando
      }
    }
    return { ok: false, motivo: "Timeout esperando respuesta del login." };
  } finally {
    if (!visible) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

// ===================== TELEGRAM =====================

async function tgGetConfig() {
  const data = await chrome.storage.local.get([
    KEY_TG_TOKEN, KEY_TG_CHATID, KEY_TG_DIAS, KEY_TG_DIAS_PERSONAL, KEY_TG_DIAS_VEHICULOS,
    KEY_TG_FRECUENCIA, KEY_TG_ACTIVO, KEY_TG_SILENCIO_DESDE, KEY_TG_SILENCIO_HASTA
  ]);
  const diasLegacy = typeof data[KEY_TG_DIAS] === "number" ? data[KEY_TG_DIAS] : 7;
  return {
    token: data[KEY_TG_TOKEN] || "",
    chatId: data[KEY_TG_CHATID] || "",
    dias: diasLegacy,
    diasPersonal: typeof data[KEY_TG_DIAS_PERSONAL] === "number" ? data[KEY_TG_DIAS_PERSONAL] : diasLegacy,
    diasVehiculos: typeof data[KEY_TG_DIAS_VEHICULOS] === "number" ? data[KEY_TG_DIAS_VEHICULOS] : 15,
    frecuencia: typeof data[KEY_TG_FRECUENCIA] === "number" ? data[KEY_TG_FRECUENCIA] : 180,
    activo: !!data[KEY_TG_ACTIVO],
    silencioDesde: data[KEY_TG_SILENCIO_DESDE] || "22:00",
    silencioHasta: data[KEY_TG_SILENCIO_HASTA] || "08:00"
  };
}

async function tgSetConfig(p) {
  const token = String(p.token || "").trim();
  const chatId = String(p.chatId || "").trim();
  const diasPersonal = Math.max(1, Math.min(60, parseInt(p.diasPersonal, 10) || 7));
  const diasVehiculos = Math.max(1, Math.min(60, parseInt(p.diasVehiculos, 10) || 15));
  const frecuencia = Math.max(30, parseInt(p.frecuencia, 10) || 180);
  const activo = !!p.activo;
  const silencioDesde = String(p.silencioDesde || "").trim();
  const silencioHasta = String(p.silencioHasta || "").trim();
  await chrome.storage.local.set({
    [KEY_TG_TOKEN]: token,
    [KEY_TG_CHATID]: chatId,
    [KEY_TG_DIAS_PERSONAL]: diasPersonal,
    [KEY_TG_DIAS_VEHICULOS]: diasVehiculos,
    [KEY_TG_FRECUENCIA]: frecuencia,
    [KEY_TG_ACTIVO]: activo,
    [KEY_TG_SILENCIO_DESDE]: silencioDesde,
    [KEY_TG_SILENCIO_HASTA]: silencioHasta
  });
}

/**
 * Devuelve true si la hora actual está dentro del rango de silencio.
 * Soporta rangos que cruzan medianoche (ej: 22:00 → 08:00).
 */
function tgEnSilencio(silencioDesde, silencioHasta, ahora) {
  if (!silencioDesde || !silencioHasta) return false;
  if (silencioDesde === silencioHasta) return false; // apagado
  const [hD, mD] = silencioDesde.split(":").map(n => parseInt(n, 10));
  const [hH, mH] = silencioHasta.split(":").map(n => parseInt(n, 10));
  if ([hD, mD, hH, mH].some(n => isNaN(n))) return false;
  const minDesde = hD * 60 + mD;
  const minHasta = hH * 60 + mH;
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  if (minDesde < minHasta) {
    // rango dentro del mismo día (ej: 12:00 → 14:00)
    return minAhora >= minDesde && minAhora < minHasta;
  } else {
    // rango cruza medianoche (ej: 22:00 → 08:00)
    return minAhora >= minDesde || minAhora < minHasta;
  }
}

async function tgRegistrarComandos(token) {
  const comandos = [
    { command: "chequear", description: "Resumen de vencimientos ahora" },
    { command: "ayuda", description: "Muestra los comandos disponibles" }
  ];
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/setMyCommands`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commands: comandos })
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`setMyCommands ${resp.status}: ${err.slice(0, 200)}`);
  }
  return await resp.json();
}

async function tgEnviarMensaje(token, chatId, texto) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  // Telegram limita a 4096 chars por mensaje. Partimos a 3800 para dejar margen.
  const trozos = tgPartirMensaje(String(texto || ""), 3800);
  let ultimo = null;
  for (const trozo of trozos) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: trozo,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`Telegram ${resp.status}: ${err.slice(0, 200)}`);
    }
    ultimo = await resp.json();
    // Pequeña pausa entre envíos para no pegarle al rate limit
    if (trozos.length > 1) await new Promise(r => setTimeout(r, 350));
  }
  return ultimo;
}

async function tgReprogramarAlarma() {
  const cfg = await tgGetConfig();
  try { await chrome.alarms.clear(ALARMA_TG); } catch {}
  try { await chrome.alarms.clear(ALARMA_TG_POLL); } catch {}
  if (cfg.activo && cfg.token && cfg.chatId) {
    chrome.alarms.create(ALARMA_TG, {
      delayInMinutes: 1,
      periodInMinutes: cfg.frecuencia
    });
    // Poll de comandos del usuario (cada 1 min)
    chrome.alarms.create(ALARMA_TG_POLL, {
      delayInMinutes: 0.2,
      periodInMinutes: 1
    });
    console.log(`[MAU] Alarma Telegram programada cada ${cfg.frecuencia} min. Poll de comandos cada 1 min.`);
  } else {
    console.log("[MAU] Alarma Telegram apagada.");
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMA_TG) {
    try {
      const cfg = await tgGetConfig();
      if (tgEnSilencio(cfg.silencioDesde, cfg.silencioHasta, new Date())) {
        console.log(`[MAU] Silencio activo (${cfg.silencioDesde}-${cfg.silencioHasta}). No mando alerta.`);
        return;
      }
      await tgChequearYAvisar({ forzarEnvio: false });
    } catch (e) {
      console.warn("[MAU] Error en chequeo automático:", e);
    }
  }
  if (alarm.name === ALARMA_TG_POLL) {
    try {
      await tgProcesarComandos();
    } catch (e) {
      console.warn("[MAU] Error leyendo comandos:", e);
    }
  }
});

/**
 * Lee los mensajes nuevos que te mandaron al bot y si hay un comando
 * reconocido lo ejecuta. Ignora mensajes de chats distintos al configurado.
 */
async function tgProcesarComandos() {
  const cfg = await tgGetConfig();
  if (!cfg.activo || !cfg.token || !cfg.chatId) return;

  const data = await chrome.storage.local.get(KEY_TG_UPDATE_OFFSET);
  const offset = typeof data[KEY_TG_UPDATE_OFFSET] === "number" ? data[KEY_TG_UPDATE_OFFSET] : 0;

  const url = `https://api.telegram.org/bot${encodeURIComponent(cfg.token)}/getUpdates?timeout=0&offset=${offset}&allowed_updates=${encodeURIComponent(JSON.stringify(["message"]))}`;
  const resp = await fetch(url);
  if (!resp.ok) return;
  const json = await resp.json();
  const updates = json?.result || [];
  if (!updates.length) return;

  // Si es la primera vez (offset 0), no procesar mensajes viejos — solo guardar el offset.
  if (offset === 0) {
    const ultimo = updates[updates.length - 1].update_id + 1;
    await chrome.storage.local.set({ [KEY_TG_UPDATE_OFFSET]: ultimo });
    return;
  }

  // Guardar el offset ANTES de procesar, así si el service worker muere a mitad
  // del chequeo, no re-procesamos el mismo comando dos veces.
  const nuevoOffset = updates[updates.length - 1].update_id + 1;
  await chrome.storage.local.set({ [KEY_TG_UPDATE_OFFSET]: nuevoOffset });

  for (const upd of updates) {
    const mensaje = upd.message;
    if (!mensaje || !mensaje.chat || String(mensaje.chat.id) !== String(cfg.chatId)) continue;

    // ¿Es un documento (PDF) adjunto?
    if (mensaje.document && /pdf/i.test(mensaje.document.mime_type || mensaje.document.file_name || "")) {
      try {
        await tgManejarDocumento(cfg, mensaje.document);
      } catch (e) {
        console.warn("[MAU] Error procesando documento:", e);
        try { await tgEnviarMensaje(cfg.token, cfg.chatId, `❌ Error procesando el PDF: ${e.message || e}`); } catch {}
      }
      continue;
    }

    // Si no, comando de texto
    const texto = String(mensaje.text || "").trim().toLowerCase();
    await tgManejarComando(cfg, texto);
  }
}

async function tgManejarComando(cfg, texto) {
  if (!texto) return;
  const limpio = texto.replace(/^\//, "").trim();

  // Confirmar / cancelar subida de sábana pendiente
  if (limpio === "si" || limpio === "sí" || limpio === "dale" || limpio === "ok") {
    try {
      // Primero intentar confirmar subida de documento; si no hay, intentar sábana
      const manejadoComoDoc = await tgConfirmarSubidaDoc(cfg);
      if (!manejadoComoDoc) {
        await tgConfirmarSubidaSabana(cfg);
      }
    } catch (e) {
      await tgEnviarMensaje(cfg.token, cfg.chatId, `❌ Error en la subida: ${escapeHtml(e.message || String(e))}`);
    }
    return;
  }
  if (limpio === "no" || limpio === "cancelar") {
    try {
      const data = await chrome.storage.local.get(KEY_TG_PENDIENTE_SABANA);
      if (data[KEY_TG_PENDIENTE_SABANA]) {
        await chrome.storage.local.remove(KEY_TG_PENDIENTE_SABANA);
        await tgEnviarMensaje(cfg.token, cfg.chatId, "❌ Subida cancelada. La sábana pendiente fue descartada.");
      } else {
        await tgEnviarMensaje(cfg.token, cfg.chatId, "ℹ️ No había ninguna sábana pendiente.");
      }
    } catch {}
    return;
  }

  if (limpio === "chequear" || limpio === "check" || limpio === "ahora" ||
      limpio === "vencimientos" || limpio === "vencer" || limpio === "revisar") {
    try {
      await tgEnviarMensaje(cfg.token, cfg.chatId, "🔎 Chequeando vencimientos, dame unos segundos…");
      const res = await tgChequearYAvisar({ forzarEnvio: true });
      // Sólo mostrar mensaje extra si NO se envió, NO se salteó por lock y hay algo que decir.
      if (!res.enviado && !res.skipped && res.mensaje) {
        await tgEnviarMensaje(cfg.token, cfg.chatId, `ℹ️ ${res.mensaje}`);
      } else if (res.skipped) {
        await tgEnviarMensaje(cfg.token, cfg.chatId, "⏳ Ya hay un chequeo corriendo, esperá unos segundos.");
      }
    } catch (e) {
      await tgEnviarMensaje(cfg.token, cfg.chatId, `❌ Error: ${e.message || e}`);
    }
    return;
  }
  if (limpio === "help" || limpio === "ayuda" || limpio === "start" || limpio === "comandos") {
    const ayuda = [
      "<b>Comandos disponibles:</b>",
      "• <b>/chequear</b> — te manda el resumen de vencimientos ahora.",
      "• <b>/ayuda</b> — muestra este mensaje.",
      "",
      "También podés escribir sin la barra: <i>chequear</i>, <i>ahora</i>, <i>vencimientos</i>."
    ].join("\n");
    await tgEnviarMensaje(cfg.token, cfg.chatId, ayuda);
    return;
  }
}

chrome.runtime.onStartup.addListener(() => { tgReprogramarAlarma().catch(() => {}); });
chrome.runtime.onInstalled.addListener(() => { tgReprogramarAlarma().catch(() => {}); });

/**
 * Abre Vencimientos.aspx, selecciona "Personal" en el dropdown, lee la tabla,
 * después selecciona "Máquinas" y lee otra vez. Devuelve los items de los dos.
 *
 * Cada item: { tipo: "personal"|"vehiculo", nombre, columna, fecha, diasFaltantes }.
 * Sólo se devuelven los que vencen en `umbralDias` o menos (incluye los ya vencidos).
 * Las filas con Estado = "Inhabilitado" se ignoran.
 */
async function tgExtraerVencimientosDesdeTab(umbralDias, _ignorado, visible = false) {
  const url = "https://controldocumentario.com/Vencimientos.aspx?menu=11";

  // 1) Si ya hay una pestaña abierta en Vencimientos.aspx (o cualquier pantalla del sitio),
  //    usarla y no abrir una nueva. Si no, crear una nueva.
  let tabId = null;
  let tabReusada = false;
  try {
    const candidatas = await chrome.tabs.query({ url: "*://controldocumentario.com/*" });
    // Preferimos una que ya esté en Vencimientos.aspx
    const enVenc = candidatas.find(t => /vencimientos\.aspx/i.test(t.url || ""));
    const elegida = enVenc || candidatas[0];
    if (elegida && elegida.id) {
      tabId = elegida.id;
      tabReusada = true;
    }
  } catch (_e) {}

  if (!tabId) {
    const tab = await chrome.tabs.create({ url, active: !!visible });
    tabId = tab.id;
  }

  const esperarCarga = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handler);
      reject(new Error("Timeout cargando la pestaña"));
    }, 30000);
    function handler(updId, info) {
      if (updId === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(handler);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(handler);
  });

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const ESPERA_MS = 10000; // 10 segundos pedidos por el usuario

  // Función inyectada: chequea si la página pidió login.
  async function ejecChequearLogin() {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!document.querySelector('input[type="password"]')
    });
    return !!result;
  }

  // Función inyectada: selecciona una opción ("Personal" o "Máquinas") en el dropdown
  // que tenga ambas opciones, y dispara el evento change.
  async function ejecSeleccionarTipo(textoOpcion) {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (texto) => {
        function norm(s) {
          return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        }
        const buscado = norm(texto);
        const selects = document.querySelectorAll("select");
        for (const sel of selects) {
          const opts = Array.from(sel.options || []);
          const tienePers = opts.some(o => norm(o.text) === "personal");
          const tieneMaq  = opts.some(o => norm(o.text) === "maquinas");
          if (!tienePers || !tieneMaq) continue;
          const objetivo = opts.find(o => norm(o.text) === buscado);
          if (!objetivo) continue;
          if (sel.value === objetivo.value) return { ok: true, yaEstaba: true };
          sel.value = objetivo.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          // Para ASP.NET algunos dropdowns tienen onchange con __doPostBack
          try {
            if (typeof sel.onchange === "function") sel.onchange();
          } catch (_e) {}
          return { ok: true, yaEstaba: false };
        }
        return { ok: false };
      },
      args: [textoOpcion]
    });
    return result || { ok: false };
  }

  // Función inyectada: clickea el botón "Buscar".
  async function ejecClickBuscar() {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const candidatos = [
          ...document.querySelectorAll('input[type="submit"]'),
          ...document.querySelectorAll('input[type="button"]'),
          ...document.querySelectorAll('button'),
          ...document.querySelectorAll('a')
        ];
        const btn = candidatos.find(b => {
          const t = (b.value || b.textContent || "").toLowerCase().trim();
          return t === "buscar" || t === "consultar" || t === "ver" || t === "mostrar";
        });
        if (btn) { btn.click(); return true; }
        return false;
      }
    });
    return !!result;
  }

  // Función inyectada: lee la tabla actual y devuelve los items con fecha.
  async function ejecLeerTabla(tipo, umbral) {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (tipoParam, umbralParam) => {
        function parsearFechaAR(texto) {
          const t = String(texto || "").trim();
          const m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
          if (!m) return null;
          let dd = parseInt(m[1], 10);
          let mm = parseInt(m[2], 10) - 1;
          let yy = parseInt(m[3], 10);
          if (yy < 100) yy += 2000;
          const f = new Date(yy, mm, dd);
          if (isNaN(f.getTime())) return null;
          return f;
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Buscar SOLO la tabla principal: tiene que tener un TH con texto "Nombre" o
        // "Descripción", y no debe contener otras tablas adentro (eso descarta los
        // contenedores que envuelven la tabla resumen del proveedor + la tabla principal).
        const tablas = Array.from(document.querySelectorAll("table"));
        let mejor = null;
        for (const t of tablas) {
          if (t.querySelector("table")) continue; // saltear tablas anidadas/contenedoras
          const ths = Array.from(t.querySelectorAll("th"));
          const headerTxts = ths.map(th => (th.textContent || "").trim().toLowerCase());
          const tieneNombre = headerTxts.some(h => /^(nombre|descripci[oó]n)$/.test(h));
          if (!tieneNombre) continue;
          mejor = t;
          break;
        }
        if (!mejor) {
          return { items: [], totalConFecha: 0, totalFilas: 0 };
        }

        // Encabezados de columna
        const ths2 = Array.from(mejor.querySelectorAll("th"));
        const headers = ths2.map(th => (th.textContent || "").trim());

        // Índices de columnas clave
        const idxEstado = headers.findIndex(h => /^estado/i.test(h.trim()));
        const idxNombre = headers.findIndex(h => /^(nombre|descripci[oó]n)/i.test(h.trim()));

        const filas = mejor.querySelectorAll("tr");
        let totalConFecha = 0;
        const items = [];

        for (const tr of filas) {
          const tds = Array.from(tr.querySelectorAll("td"));
          if (!tds.length) continue;

          // Saltar filas inhabilitadas
          if (idxEstado >= 0 && tds[idxEstado]) {
            const v = (tds[idxEstado].textContent || "").trim().toLowerCase();
            if (v.includes("inhabilit")) continue;
          }

          // Nombre de la fila — sólo desde la columna "Nombre"/"Descripción". Si no hay, saltar fila.
          let nombre = "";
          if (idxNombre >= 0 && tds[idxNombre]) nombre = (tds[idxNombre].textContent || "").trim();
          if (!nombre) continue;

          // Para cada celda con fecha, registrar un item
          for (let i = 0; i < tds.length; i++) {
            const td = tds[i];
            const f = parsearFechaAR(td.textContent);
            if (!f) continue;
            totalConFecha++;
            const columna = (headers[i] || "").trim();
            // Saltar la columna "Estado" (no es un requerimiento de documento real)
            if (/^estado/i.test(columna)) continue;
            const dias = Math.round((f - hoy) / (1000 * 60 * 60 * 24));
            if (dias > umbralParam) continue;
            items.push({
              tipo: tipoParam,
              nombre,
              columna,
              fecha: (td.textContent || "").trim(),
              diasFaltantes: dias
            });
          }
        }

        return { items, totalConFecha, totalFilas: filas.length };
      },
      args: [tipo, umbral]
    });
    return result || { items: [], totalConFecha: 0, totalFilas: 0 };
  }

  // Funcion inyectada: lee la tablita resumen del proveedor.
  // — la que NO tiene columna "Nombre" / "Descripción" pero sí tiene fechas.
  async function ejecLeerResumenProveedor(umbral) {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (umbralParam) => {
        function parsearFechaAR(texto) {
          const t = String(texto || "").trim();
          const m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
          if (!m) return null;
          let dd = parseInt(m[1], 10);
          let mm = parseInt(m[2], 10) - 1;
          let yy = parseInt(m[3], 10);
          if (yy < 100) yy += 2000;
          const f = new Date(yy, mm, dd);
          if (isNaN(f.getTime())) return null;
          return f;
        }
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Buscar la tabla "resumen": tiene fechas, NO tiene columna Nombre/Descripción,
        // no tiene tablas anidadas, y tiene THs (encabezados de doc types).
        const tablas = Array.from(document.querySelectorAll("table"));
        let mejor = null, maxFechas = 0;
        for (const t of tablas) {
          if (t.querySelector("table")) continue;
          const ths = Array.from(t.querySelectorAll("th"));
          if (!ths.length) continue;
          const headerTxts = ths.map(th => (th.textContent || "").trim().toLowerCase());
          const tieneNombre = headerTxts.some(h => /^(nombre|descripci[oó]n)$/.test(h));
          if (tieneNombre) continue; // esa es la principal, no resumen
          let n = 0;
          for (const td of t.querySelectorAll("td")) {
            if (parsearFechaAR(td.textContent)) n++;
          }
          if (n > maxFechas) { maxFechas = n; mejor = t; }
        }
        if (!mejor) return { items: [], totalConFecha: 0 };

        const headers = Array.from(mejor.querySelectorAll("th")).map(th => (th.textContent || "").trim());
        const items = [];
        let totalConFecha = 0;
        for (const tr of mejor.querySelectorAll("tr")) {
          const tds = Array.from(tr.querySelectorAll("td"));
          if (!tds.length) continue;
          for (let i = 0; i < tds.length; i++) {
            const f = parsearFechaAR(tds[i].textContent);
            if (!f) continue;
            totalConFecha++;
            const columna = (headers[i] || "").trim();
            const dias = Math.round((f - hoy) / (1000 * 60 * 60 * 24));
            if (dias > umbralParam) continue;
            items.push({
              tipo: "general",
              nombre: "Proveedor",
              columna,
              fecha: (tds[i].textContent || "").trim(),
              diasFaltantes: dias
            });
          }
        }
        return { items, totalConFecha };
      },
      args: [umbral]
    });
    return result || { items: [], totalConFecha: 0 };
  }

  try {
    // 1) Si la pestaña la abrimos nosotros, esperar la carga inicial + 10 s extra.
    //    Si reusamos una pestaña ya abierta, no hace falta esperar la carga, sólo el delay.
    if (!tabReusada) {
      await esperarCarga();
      await dormir(ESPERA_MS);
    } else {
      await dormir(1000); // pequeño respiro
    }

    // 2) Chequear que no hayamos caído al login
    let tabActual = await chrome.tabs.get(tabId);
    let urlActual = (tabActual.url || "").toLowerCase();
    if (urlActual.includes("login") || await ejecChequearLogin()) {
      return { items: [], totalConFecha: 0, totalFilas: 0, url: tabActual.url, loginRequerido: true };
    }

    // Si no estamos en Vencimientos, forzar navegación manual
    if (!urlActual.includes("vencimientos.aspx")) {
      await chrome.tabs.update(tabId, { url });
      await esperarCarga();
      await dormir(ESPERA_MS);
      tabActual = await chrome.tabs.get(tabId);
      urlActual = (tabActual.url || "").toLowerCase();
      if (urlActual.includes("login") || await ejecChequearLogin()) {
        return { items: [], totalConFecha: 0, totalFilas: 0, url: tabActual.url, loginRequerido: true };
      }
      if (!urlActual.includes("vencimientos.aspx")) {
        return { items: [], totalConFecha: 0, totalFilas: 0, url: tabActual.url, loginRequerido: false };
      }
    }

    let totalConFechaTotal = 0;
    const itemsCombinados = [];

    // 3) PERSONAL
    const selPers = await ejecSeleccionarTipo("personal");
    if (!selPers.ok) {
      console.warn("[MAU] No se encontró el dropdown Personal/Máquinas. Sigo igual.");
    }
    // Si recién cambiamos el dropdown, esperar el postback dependiente
    if (selPers.ok && !selPers.yaEstaba) await dormir(ESPERA_MS);
    await ejecClickBuscar();
    await dormir(ESPERA_MS);
    const resPers = await ejecLeerTabla("personal", umbralDias);
    totalConFechaTotal += resPers.totalConFecha;
    itemsCombinados.push(...resPers.items);

    // 3.b) Documentos GENERALES del proveedor (la tablita chica de arriba),
    //      que es la misma para Personal y Máquinas — la leemos una sola vez.
    const resGen = await ejecLeerResumenProveedor(umbralDias);
    totalConFechaTotal += resGen.totalConFecha;
    itemsCombinados.push(...resGen.items);

    // 4) MÁQUINAS / VEHÍCULOS
    const selMaq = await ejecSeleccionarTipo("maquinas");
    if (selMaq.ok) {
      if (!selMaq.yaEstaba) await dormir(ESPERA_MS);
      await ejecClickBuscar();
      await dormir(ESPERA_MS);
      const resMaq = await ejecLeerTabla("vehiculo", umbralDias);
      totalConFechaTotal += resMaq.totalConFecha;
      itemsCombinados.push(...resMaq.items);
    } else {
      console.warn("[MAU] No se pudo seleccionar Máquinas en el dropdown.");
    }

    return {
      items: itemsCombinados,
      totalConFecha: totalConFechaTotal,
      totalFilas: 0,
      url: tabActual.url,
      loginRequerido: false
    };
  } finally {
    // Sólo cerrar la pestaña si la creamos nosotros y no era visible.
    // Si reusamos una pestaña que el usuario ya tenía abierta, no la tocamos.
    if (!tabReusada && !visible) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

function tgFormatearFechaHora(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tgPieVerificacion(totalLeidos) {
  const ahora = tgFormatearFechaHora(new Date());
  return `\n\n<i>— Leí ${totalLeidos} fechas en total (Personal + Vehículos). Detalle en <a href="https://controldocumentario.com/Vencimientos.aspx?menu=11">Vencimientos</a>. Último chequeo: ${ahora}.</i>`;
}

function tgFraseDias(dias) {
  if (dias < 0) {
    const n = Math.abs(dias);
    return n === 1 ? "VENCIDO hace 1 día" : `VENCIDO hace ${n} días`;
  }
  if (dias === 0) return "vence HOY";
  if (dias === 1) return "vence MAÑANA";
  return `vence en ${dias} días`;
}

// Agrupa items que tengan el mismo nombre + misma fecha en una sola línea con varias columnas.
function tgAgruparItems(lista) {
  const mapa = new Map();
  for (const it of lista) {
    const k = `${it.nombre}||${it.fecha}||${it.diasFaltantes}`;
    if (!mapa.has(k)) {
      mapa.set(k, { nombre: it.nombre, fecha: it.fecha, diasFaltantes: it.diasFaltantes, columnas: [] });
    }
    mapa.get(k).columnas.push(it.columna);
  }
  return Array.from(mapa.values()).sort((a, b) => a.diasFaltantes - b.diasFaltantes);
}

function tgIconoUrgencia(dias) {
  if (dias < 0) return "🔴"; // vencido
  if (dias <= 3) return "🟠"; // hoy / 1-3 días
  return "🟡"; // 4-10 días
}

function tgConstruirMensaje(items, umbralDias, _x, _totalLeidos = 0) {
  const generales = items.filter(i => i.tipo === "general");
  const personal = items.filter(i => i.tipo === "personal");
  const vehiculos = items.filter(i => i.tipo === "vehiculo");

  if (!generales.length && !personal.length && !vehiculos.length) {
    return [
      `✅ <b>Todo OK</b> — sin vencimientos en los próximos ${umbralDias} días.`,
      `📋 General (proveedor): sin vencimientos`,
      `👷 Personal: sin vencimientos`,
      `🚗 Vehículos: sin vencimientos`
    ].join("\n");
  }

  const partes = [
    `🔔 <b>Vencimientos próximos (${umbralDias} días)</b>`,
    `<i>🔴 vencido · 🟠 hoy / 1-3 días · 🟡 4-${umbralDias} días</i>`
  ];

  function bloque(titulo, lista, sinNombre = false) {
    // Ordenar por días ascendente (más vencidos primero, después los más cercanos)
    const ordenada = [...lista].sort((a, b) => a.diasFaltantes - b.diasFaltantes);
    partes.push(`\n${titulo}`);
    if (!ordenada.length) {
      partes.push(`✅ sin vencimientos`);
      return;
    }
    for (const it of ordenada.slice(0, 60)) {
      const ico = tgIconoUrgencia(it.diasFaltantes);
      const linea = sinNombre
        ? `${ico} ${escapeHtml(it.columna)} — ${it.fecha} (${tgFraseDias(it.diasFaltantes)})`
        : `${ico} ${escapeHtml(it.columna)} — ${escapeHtml(it.nombre)} — ${it.fecha} (${tgFraseDias(it.diasFaltantes)})`;
      partes.push(linea);
    }
    if (ordenada.length > 60) partes.push(`…y ${ordenada.length - 60} más.`);
  }

  bloque("📋 <b>GENERAL (proveedor)</b>", generales, true);
  bloque("👷 <b>PERSONAL</b>", personal);
  bloque("🚗 <b>VEHÍCULOS</b>", vehiculos);

  return partes.join("\n");
}

// Parte un mensaje largo en pedazos respetando saltos de línea.
function tgPartirMensaje(texto, max = 3800) {
  if (!texto || texto.length <= max) return [texto];
  const lineas = texto.split("\n");
  const trozos = [];
  let actual = "";
  for (const ln of lineas) {
    if ((actual.length + ln.length + 1) > max) {
      if (actual) trozos.push(actual);
      actual = ln;
    } else {
      actual = actual ? actual + "\n" + ln : ln;
    }
    // Si una sola línea ya es más larga que max, partirla a la fuerza
    while (actual.length > max) {
      trozos.push(actual.slice(0, max));
      actual = actual.slice(max);
    }
  }
  if (actual) trozos.push(actual);
  return trozos;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hashRapido(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

// ===================== TELEGRAM: SUBIDA DE SÁBANA POR PDF =====================

/**
 * Busca una pestaña abierta de controldocumentario.com (cualquier pantalla).
 * Si no hay, abre una en blanco. Devuelve { tabId, abrimosNosotros }.
 */
async function tgConseguirTabControldoc() {
  const candidatas = await chrome.tabs.query({ url: "*://controldocumentario.com/*" });
  if (candidatas.length && candidatas[0].id) {
    return { tabId: candidatas[0].id, abrimosNosotros: false };
  }
  const tab = await chrome.tabs.create({ url: "https://controldocumentario.com/", active: false });
  // Esperar a que cargue
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handler);
      reject(new Error("Timeout abriendo controldocumentario.com"));
    }, 30000);
    function handler(updId, info) {
      if (updId === tab.id && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(handler);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(handler);
  });
  return { tabId: tab.id, abrimosNosotros: true };
}

/**
 * Renderiza cada página del PDF como JPEG usando pdf.js cargado en una pestaña
 * abierta de controldocumentario.com. Devuelve array de base64 JPEG, una por página.
 */
async function tgRenderPdfEnImagenes(base64Pdf, tabIdExterno) {
  const { tabId, abrimosNosotros } = tabIdExterno
    ? { tabId: tabIdExterno, abrimosNosotros: false }
    : await tgConseguirTabControldoc();
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (b64) => {
        // Cargar pdf.js si no está
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload = resolve;
            s.onerror = () => reject(new Error("No pude cargar pdf.js"));
            document.head.appendChild(s);
          });
          if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
        }
        // base64 → bytes
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
        const out = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
          out.push({ pagina: i, base64 });
        }
        return out;
      },
      args: [base64Pdf]
    });
    return Array.isArray(result) ? result : [];
  } finally {
    if (abrimosNosotros) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

/**
 * Renderiza páginas de un PDF a JPEG en un tab de controldocumentario.com.
 * Usada por mapeos.html para mostrar thumbnails y guardar imágenes de referencia.
 * @param {string} base64Pdf - PDF codificado en base64
 * @param {number} escala - Escala de renderizado (default 1.0)
 * @returns {Promise<Array<{pagina:number, base64:string}>>}
 */
async function renderPdfParaMapeos(base64Pdf, escala = 0.5, tabIdExterno = null) {
  const { tabId, abrimosNosotros } = tabIdExterno
    ? { tabId: tabIdExterno, abrimosNosotros: false }
    : await tgConseguirTabControldoc();
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (b64, scale) => {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload = resolve;
            s.onerror = () => reject(new Error("No pude cargar pdf.js"));
            document.head.appendChild(s);
          });
          if (window.pdfjsLib?.GlobalWorkerOptions) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
        }
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
        const out = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          out.push({ pagina: i, base64: canvas.toDataURL("image/jpeg", 0.82).split(",")[1] });
        }
        try { pdf.destroy(); } catch {}
        return out;
      },
      args: [base64Pdf, escala]
    });
    return Array.isArray(result) ? result : [];
  } finally {
    if (abrimosNosotros) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

/**
 * Comparacion directa imagen vs imagen entre paginas nuevas y paginas de referencia del mapeo.
 * Este es el metodo principal de matching.
 */
async function compararPaginasConReferencia(nuevasPaginas, referencia) {
  const tieneImagenes = (referencia?.imagenesPorBloque && Object.keys(referencia.imagenesPorBloque).length > 0)
    || (referencia?.imagenes?.length > 0);
  if (!nuevasPaginas?.length || !referencia?.bloques?.length || !tieneImagenes) return null;

  const { modelo } = await obtenerIAConfig();

  // Obtener TODAS las imágenes de referencia por bloque (una por cada página del bloque)
  const bloquesRef = referencia.bloques.map((b) => {
    let imagenesRef = [];
    if (Array.isArray(referencia.imagenes) && referencia.imagenes.length > 0) {
      // Buscamos la imagen de cada página asignada a este bloque en el mapeo
      imagenesRef = (b.paginas || []).map(pNum => {
        const img = referencia.imagenes.find((i) => i.pagina === pNum);
        return img ? img.base64 : null;
      }).filter(Boolean);
    }
    // Fallback: imagenesPorBloque (formato legacy, 1 sola imagen por bloque)
    if (imagenesRef.length === 0 && referencia.imagenesPorBloque && referencia.imagenesPorBloque[b.nombre]) {
      imagenesRef = [referencia.imagenesPorBloque[b.nombre]];
    }
    return imagenesRef.length > 0 ? { ...b, imagenesRef } : null;
  }).filter(Boolean);

  if (!bloquesRef.length) return null;

  // Log diagnóstico: cuántas imágenes de referencia tiene cada bloque
  bloquesRef.forEach((b, idx) => {
    console.log(`[MAU] Ref ${idx+1} "${b.nombre}": ${b.imagenesRef.length} imagen(es) de referencia, páginas del mapeo: [${(b.paginas||[]).join(",")}]`);
  });
  console.log(`[MAU] Páginas nuevas a comparar: ${nuevasPaginas.length}`);

  // ── 1 sola llamada: Claude extrae tipo + CUIL de cada página, el código hace el match ──
  const content = [];

  // Mostrar referencias con TODAS sus páginas para que Claude reconozca cada tipo de formulario del bloque
  content.push({ type: "text", text: "BLOQUES DE REFERENCIA (todas las páginas del bloque):\n" });
  bloquesRef.forEach((b, idx) => {
    content.push({ type: "text", text: `\nRef ${idx + 1}: ${b.nombre || "Bloque"} (${b.imagenesRef.length} tipo(s) de formulario en este bloque)` });
    b.imagenesRef.forEach((imgBase64, pIdx) => {
      content.push({ type: "text", text: `  Formulario ${pIdx + 1} de Ref ${idx + 1}:` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgBase64 } });
    });
  });

  // Páginas nuevas
  content.push({ type: "text", text: "\n\nPÁGINAS NUEVAS:\n" });
  nuevasPaginas.forEach((p) => {
    content.push({ type: "text", text: `\nPágina ${p.pagina}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.base64 } });
  });

  content.push({
    type: "text",
    text: `

TAREA: para cada página nueva, determiná a qué Ref pertenece.

CÓMO HACER EL MATCH:
Cada Ref representa un empleado y tiene uno o más tipos de formulario (Formulario 1, Formulario 2, etc.).
Una página nueva pertenece a un Ref si es del MISMO TIPO de formulario que alguno de sus formularios:
  - Mismo nombre o título del formulario
  - Misma empresa o institución que lo emite
  - Misma estructura general del documento

No importa el orden en que vienen las páginas, la calidad del scan, ni pequeñas diferencias de contenido.
Lo que importa es si es el MISMO TIPO de formulario.

Además, extraé de cada página nueva (si es legible):
- apellido (si podés, apellido + nombre completo del empleado en el campo apellido)
- nombre
- CUIL del empleado
- entidades_mencionadas: array con nombres completos y/o patentes que aparezcan en la página

Si una página definitivamente no es ningún tipo de formulario de ningún Ref → bloque: null.

IMPORTANTE: reportá TODAS las páginas nuevas en el JSON, incluso las que no coinciden (bloque: null). Leé e informá el CUIL cuando sea legible.

Respondé SOLO JSON válido, sin texto extra:
{
  "paginas": [
    { "pagina_nueva": 1, "apellido": "APELLIDO NOMBRE", "nombre": "", "cuil_leido": "20-12345678-9", "entidades_mencionadas": ["APELLIDO NOMBRE"], "bloque": "Ref 1" },
    { "pagina_nueva": 2, "apellido": "", "nombre": "", "cuil_leido": "", "entidades_mencionadas": [], "bloque": null }
  ]
}`
  });

  const json = await llamarClaudeMessages({ model: modelo, max_tokens: 2500, messages: [{ role: "user", content }] }, "Claude (comparar imagenes)");
  const textoResp = (json?.content?.[0]?.text || "").trim();
  console.log(`[MAU] Respuesta Claude (${textoResp.length} chars):`, textoResp.slice(0, 800));

  let parsed = null;
  // Claude ahora razona primero y pone el JSON al final en un bloque ```json ... ```
  // Intentamos extraer ese bloque primero; si no, caemos en el JSON crudo
  try {
    const bloqueJson = textoResp.match(/```json\s*([\s\S]*?)```/i);
    if (bloqueJson) {
      parsed = JSON.parse(bloqueJson[1].trim());
    } else {
      parsed = JSON.parse(textoResp);
    }
  } catch {
    const m = textoResp.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
  }

  if (!parsed?.paginas?.length) return null;

  try {
    const nombresLeidos = Array.from(new Set(
      parsed.paginas
        .map((p) => String(p?.apellido || "").trim())
        .filter(Boolean)
    ));
    const entidadesLeidas = Array.from(new Set(
      parsed.paginas
        .flatMap((p) => Array.isArray(p?.entidades_mencionadas) ? p.entidades_mencionadas : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
    ));
    console.log("[MAU][DEBUG][IA] Nombres leidos en documento:", nombresLeidos);
    console.log("[MAU][DEBUG][IA] Entidades mencionadas en documento:", entidadesLeidas);
  } catch (_) {}

  // El código hace el match fino: CUIL leído por Claude vs CUIL almacenado en cada bloque de referencia
  const normCuil = (s) => String(s || "").replace(/\D/g, "");

  // Usamos el ÍNDICE en bloquesRef como clave única, porque todos los bloques pueden
  // tener el mismo nombre (ej: "Bloque") cuando el usuario no los renombra en el modal.
  // Indexar por nombre colapsaría bloques distintos en uno solo.
  const bloquesMapIdx = new Map(); // key: índice en bloquesRef → { refBloque, paginas }

  for (const item of parsed.paginas) {
    if (!item.pagina_nueva) continue;
    if (!item.bloque) {
      console.log(`[MAU] Pág ${item.pagina_nueva} → sin asignar (CUIL=${normCuil(item.cuil_leido) || "no leído"})`);
      continue;
    }

    // Resolver el bloque que indicó Claude → primero por nombre exacto, luego por "Ref N"
    let refIdx = bloquesRef.findIndex((b) => b.nombre === item.bloque);
    if (refIdx === -1) {
      const mm = String(item.bloque).match(/^Ref\s*(\d+)$/i);
      if (mm) {
        const i = parseInt(mm[1]) - 1;
        if (i >= 0 && i < bloquesRef.length) refIdx = i;
      }
    }
    if (refIdx === -1) continue;
    let refBloque = bloquesRef[refIdx];

    // No usamos CUIL/CUIT para reasignar empleados.
    // El criterio principal es match visual del formulario + nombre completo detectado luego.
    const cuilLeido = normCuil(item.cuil_leido);

    console.log(`[MAU] Pág ${item.pagina_nueva} → Ref ${refIdx+1} "${refBloque.nombre || "Bloque"}" CUIL=${cuilLeido || "(sin cuil)"}`);
    if (!bloquesMapIdx.has(refIdx)) {
      bloquesMapIdx.set(refIdx, {
        nombre: refBloque.nombre,
        paginas: [],
        paginasMapeo: (refBloque.paginas || []).length, // cuántas páginas tiene este bloque en el mapeo
        requerimientos: refBloque.requerimientos || [],
        destino: refBloque.destino || { modo: "uno", entidadesObjetivo: [] },
        meta: {}
      });
    }
    const metaActual = bloquesMapIdx.get(refIdx).meta || {};
    const metaNuevo = {
      ...metaActual,
      apellido: metaActual.apellido || String(item.apellido || "").trim(),
      nombre: metaActual.nombre || String(item.nombre || "").trim()
    };
    const entidadesPag = Array.isArray(item.entidades_mencionadas)
      ? item.entidades_mencionadas.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    if (entidadesPag.length) {
      const prev = Array.isArray(metaActual.entidades_mencionadas) ? metaActual.entidades_mencionadas : [];
      metaNuevo.entidades_mencionadas = Array.from(new Set([...prev, ...entidadesPag]));
    }
    if (cuilLeido) metaNuevo.cuil = item.cuil_leido;
    bloquesMapIdx.get(refIdx).meta = metaNuevo;
    bloquesMapIdx.get(refIdx).paginas.push(item.pagina_nueva);
  }

  // Validar que cada bloque encontrado tiene TODAS las páginas que dice el mapeo.
  // Si falta alguna página, el bloque se descarta (el mapeo manda).
  // Bloques de otras personas que sí están completos se suben igual (listas cortas son válidas).
  const descartados = [];
  const resultado = Array.from(bloquesMapIdx.values()).filter((b) => {
    if (!b.paginas.length || !b.requerimientos.length) return false;
    if (b.paginasMapeo > 0 && b.paginas.length < b.paginasMapeo) {
      console.log(`[MAU] Bloque "${b.nombre}" descartado: encontradas ${b.paginas.length}/${b.paginasMapeo} páginas del mapeo`);
      descartados.push(b);
      return false;
    }
    return true;
  });

  // Adjuntamos los descartados al array resultado para que los callers puedan informar al usuario
  if (resultado.length) resultado.descartados = descartados;
  return resultado.length ? resultado : null;
}


/**
 * Manda una foto (base64 JPEG) al chat de Telegram con caption opcional.
 */
async function tgEnviarFoto(token, chatId, base64Jpeg, fileName, caption) {
  const bin = atob(base64Jpeg);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/jpeg" });

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", blob, fileName);
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendPhoto`;
  const resp = await fetch(url, { method: "POST", body: form });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`sendPhoto ${resp.status}: ${err.slice(0, 200)}`);
  }
  return await resp.json();
}

/**
 * Baja un archivo de Telegram (file_id) y devuelve { base64, mediaType, sizeBytes }.
 * Usa el endpoint getFile + descarga del file_path.
 */
async function tgBajarArchivo(token, fileId) {
  const u1 = `https://api.telegram.org/bot${encodeURIComponent(token)}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const r1 = await fetch(u1);
  if (!r1.ok) throw new Error(`getFile ${r1.status}`);
  const j1 = await r1.json();
  if (!j1.ok || !j1.result || !j1.result.file_path) throw new Error("getFile: respuesta sin file_path");
  const filePath = j1.result.file_path;
  const sizeBytes = j1.result.file_size || 0;
  if (sizeBytes && sizeBytes > TG_MAX_PDF_BYTES) {
    throw new Error(`El archivo pesa ${(sizeBytes / 1024 / 1024).toFixed(1)} MB, máximo permitido 20 MB.`);
  }
  const u2 = `https://api.telegram.org/file/bot${encodeURIComponent(token)}/${filePath}`;
  const r2 = await fetch(u2);
  if (!r2.ok) throw new Error(`Descarga ${r2.status}`);
  const buf = await r2.arrayBuffer();
  // Convertir ArrayBuffer a base64 (en chunks para no estallar el call stack)
  const bytes = new Uint8Array(buf);
  let binario = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  const base64 = btoa(binario);
  return { base64, mediaType: "application/pdf", sizeBytes: bytes.length };
}

/**
 * Busca o abre Bandeja.aspx (donde corre el panel manual).
 * Devuelve { tabId, abrimosNosotros }.
 */
async function tgConseguirTabBandeja() {
  const candidatas = await chrome.tabs.query({ url: "*://controldocumentario.com/Bandeja.aspx*" });
  if (candidatas.length && candidatas[0].id) {
    // Activarla para que el usuario vea lo que hace
    try { await chrome.tabs.update(candidatas[0].id, { active: true }); } catch {}
    return { tabId: candidatas[0].id, abrimosNosotros: false };
  }
  const tab = await chrome.tabs.create({
    url: "https://controldocumentario.com/Bandeja.aspx?menu=1",
    active: true
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handler);
      reject(new Error("Timeout abriendo Bandeja.aspx"));
    }, 30000);
    function handler(updId, info) {
      if (updId === tab.id && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(handler);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(handler);
  });
  // Esperar 5 s extra para que panel.js se inyecte y arme la UI
  await new Promise(r => setTimeout(r, 5000));
  return { tabId: tab.id, abrimosNosotros: true };
}

/**
 * Inyecta el PDF + plan de bloques DIRECTAMENTE en el panel via window.MAUPanel,
 * sin pasar por la UI ni re-pagar Claude. Devuelve un resumen.
 */
async function tgDispararSubidaEnPanel(tabId, base64Pdf, fileName, bloquesPlan) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (b64, name, bloques) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const log = (s) => { try { console.log("[MAU TG-Etapa2]", s); } catch {} };

      // 1) Esperar a que el panel esté montado y que window.MAUPanel exista
      log("Esperando window.MAUPanel…");
      const t0 = Date.now();
      while (!window.MAUPanel && Date.now() - t0 < 30000) {
        await wait(500);
      }
      if (!window.MAUPanel) {
        return { ok: false, error: "El panel no expone window.MAUPanel. Recargá la extensión." };
      }
      const P = window.MAUPanel;

      // 2) Detectar requerimientos si están vacíos
      try {
        if (!P.estado.requerimientos || !P.estado.requerimientos.length) {
          log("Detectando requerimientos pendientes…");
          await P.detectarRequerimientosPendientes();
        }
      } catch (e) {
        return { ok: false, error: "Falló detectarRequerimientosPendientes: " + (e.message || e) };
      }

      if (!P.estado.requerimientos || !P.estado.requerimientos.length) {
        return { ok: false, error: "No se detectaron requerimientos pendientes en la página." };
      }
      log(`Requerimientos detectados: ${P.estado.requerimientos.length}`);

      // 3) Convertir base64 → File
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], name, { type: "application/pdf" });

      // 4) Aplicar los bloques pre-calculados por el match visual.
      //    Los bloques ya incluyen metadata generica cuando fue posible leerla.
      log("Aplicando bloques del match visual...");
      try {
        await P.aplicarBloquesModal(file, bloques);
      } catch (e) {
        return { ok: false, error: "Falló aplicarBloquesModal: " + (e.message || e) };
      }

      // 5) Verificar que se asignaron archivos
      const filas = P.estado.filas || [];
      const totalConArchivo = filas.filter(f => f.archivo).length;
      log(`Filas con archivo asignado: ${totalConArchivo}/${filas.length}`);
      if (totalConArchivo === 0) {
        return { ok: false, error: "Después de aplicar los bloques, ninguna fila quedó con archivo." };
      }

      // 6) Procesar todo (esto sí hace clicks en la página de controldoc)
      log("Llamando a procesarTodo()…");
      try {
        // procesarTodo no se await porque puede tardar mucho y bloquearía el sw.
        // En su lugar, lo lanzamos y polleamos el estado.filas.
        const promesaProc = P.procesarTodo();

        // Espera inicial: darle tiempo a procesarTodo para arrancar y poner
        // la primera fila en "procesando" antes de que empecemos a verificar.
        // Sin esto, el primer poll ve 0 filas procesando y sale prematuramente.
        await wait(12000);

        // Esperar máximo 15 minutos hasta que todas las filas lleguen a un estado terminal
        const tSub = Date.now();
        while (Date.now() - tSub < 900000) {
          await wait(4000);
          const filasAhora = (P.estado.filas || []).filter(f => f.archivo);
          // "en proceso" = todavía hay filas activas o sin empezar
          const enProceso = filasAhora.some(f => {
            const est = String(f.estado || "").toLowerCase();
            return est === "procesando" || est === "subiendo" || est === "enviando" || est === "pendiente" || est === "";
          });
          // Salir solo cuando haya al menos un resultado terminal Y nadie en proceso
          const hayTerminal = filasAhora.some(f => {
            const est = String(f.estado || "").toLowerCase();
            return est === "ok" || est === "enviado" || est === "subido" || est === "completo" || est.startsWith("error");
          });
          if (!enProceso && hayTerminal) {
            await wait(4000); // pausa extra para borradores finales
            break;
          }
        }

        // Esperar a que la promesa termine (con timeout)
        await Promise.race([
          promesaProc.catch(() => {}),
          new Promise(r => setTimeout(r, 15000))
        ]);
      } catch (e) {
        return { ok: false, error: "Falló procesarTodo: " + (e.message || e) };
      }

      // 7) Recolectar resultados desde estado.filas
      const filasFinal = P.estado.filas || [];
      let okCount = 0, errCount = 0, totalCount = 0;
      const errores = [];
      for (const f of filasFinal) {
        if (!f.archivo) continue;
        totalCount++;
        const est = String(f.estado || "").toLowerCase();
        if (est === "ok" || est === "enviado" || est === "subido" || est === "completo") {
          okCount++;
        } else if (est === "error" || est.startsWith("error")) {
          errCount++;
          errores.push(`${f.nombre || f.requerimiento || "?"}: ${f.estado}${f.error ? " — " + f.error : ""}`);
        } else {
          // Estado raro/desconocido — lo cuento como error para no engañar
          errCount++;
          errores.push(`${f.nombre || f.requerimiento || "?"}: ${f.estado || "estado desconocido"}`);
        }
      }

      return { ok: true, okCount, errCount, totalCount, errores };
    },
    args: [base64Pdf, fileName, bloquesPlan]
  });
  return result || { ok: false, error: "executeScript no devolvió resultado" };
}

/**
 * Handler cuando el usuario manda "SI" después del preview de un documento.
 * Devuelve true si había un doc pendiente (lo manejó), false si no había nada.
 */
async function tgConfirmarSubidaDoc(cfg) {
  const data = await chrome.storage.local.get(KEY_TG_PENDIENTE_DOC);
  const pendiente = data[KEY_TG_PENDIENTE_DOC];
  if (!pendiente?.fileId || !pendiente?.bloques?.length) return false;

  const log = (txt) => tgEnviarMensaje(cfg.token, cfg.chatId, txt).catch(e => console.warn("[MAU] log fail", e));
  const t0 = Date.now();

  await log(`🚀 Subiendo <b>${escapeHtml(pendiente.nombreArchivo)}</b>…\n⏳ Re-bajando el PDF de Telegram…`);

  let base64;
  try {
    const r = await tgBajarArchivo(cfg.token, pendiente.fileId);
    base64 = r.base64;
  } catch (e) {
    await log(`❌ No pude re-bajar el archivo: ${escapeHtml(e.message || String(e))}`);
    return true;
  }

  let tabId;
  try {
    const tab = await tgConseguirTabBandeja();
    tabId = tab.tabId;
  } catch (e) {
    await log(`❌ Necesitás una pestaña de controldocumentario.com abierta.`);
    return true;
  }

  await log(`✅ Bandeja abierta.\n⏳ Subiendo archivos…`);

  let res;
  try {
    res = await tgDispararSubidaEnPanel(tabId, base64, pendiente.nombreArchivo, pendiente.bloques);
  } catch (e) {
    await log(`❌ Falló al subir: ${escapeHtml(e.message || String(e))}`);
    return true;
  }

  // Limpiar pendiente
  try { await chrome.storage.local.remove(KEY_TG_PENDIENTE_DOC); } catch {}

  const tTotal = Math.round((Date.now() - t0) / 1000);

  if (!res.ok) {
    await log(`⚠️ La subida no se pudo completar:\n<i>${escapeHtml(res.error || "Razón desconocida")}</i>`);
    return true;
  }

  // Armar lista de personas de los bloques subidos
  const personas = (pendiente.bloques || []).map(b => b.meta?.apellido || "").filter(Boolean);

  if (res.errCount === 0) {
    const lineasOk = personas.map(p => `✅ Requerimiento encontrado y subido para <b>${escapeHtml(p)}</b>`);
    await log(
      `✅ <b>Todos los archivos fueron subidos correctamente</b> en ${tTotal}s.\n\n` +
      lineasOk.join("\n")
    );
  } else {
    const partes = [
      `⚠️ <b>Subida completada con errores</b> en ${tTotal}s.`,
      `📊 ${res.okCount} OK · ${res.errCount} con error · ${res.totalCount} total`,
      ""
    ];
    for (const e of (res.errores || []).slice(0, 10)) {
      partes.push(`❌ ${escapeHtml(e)}`);
    }
    await log(partes.join("\n"));
  }

  return true;
}

/**
 * Handler cuando el usuario manda "SI" después de un preview de sábana.
 */
async function tgConfirmarSubidaSabana(cfg) {
  const data = await chrome.storage.local.get(KEY_TG_PENDIENTE_SABANA);
  const pendiente = data[KEY_TG_PENDIENTE_SABANA];
  if (!pendiente || !pendiente.fileId) {
    await tgEnviarMensaje(cfg.token, cfg.chatId, "ℹ️ No tengo ninguna sábana pendiente. Mandame primero el PDF.");
    return;
  }

  const log = (txt) => tgEnviarMensaje(cfg.token, cfg.chatId, txt).catch(e => console.warn("[MAU] log fail", e));
  const t0 = Date.now();

  await log(`🚀 Arrancando subida de <b>${escapeHtml(pendiente.nombreArchivo)}</b>…\n⏳ Paso 1/4: re-bajando el PDF de Telegram…`);

  // Re-bajar el PDF original (no lo guardamos para no llenar la memoria)
  const { base64 } = await tgBajarArchivo(cfg.token, pendiente.fileId);
  await log(`✅ Bajado.\n⏳ Paso 2/4: abriendo Bandeja.aspx en el navegador…`);

  // Abrir/encontrar Bandeja
  const { tabId } = await tgConseguirTabBandeja();
  await log(`✅ Bandeja abierta.\n⏳ Paso 3/4: inyectando el PDF en el panel y disparando OCR + asignación…\n💡 Esto tarda 1-3 min según el tamaño.`);

  // Disparar el flujo en el panel — usa los bloques YA armados en Etapa 1 (sin Claude extra)
  const bloques = (pendiente.plan && Array.isArray(pendiente.plan.bloques)) ? pendiente.plan.bloques : [];
  if (!bloques.length) {
    await log(`❌ No hay bloques en el plan guardado. Mandá el PDF de nuevo.`);
    return;
  }
  let res;
  try {
    res = await tgDispararSubidaEnPanel(tabId, base64, pendiente.nombreArchivo, bloques);
  } catch (e) {
    await log(`❌ Falló al ejecutar en el panel: ${escapeHtml(e.message || String(e))}`);
    throw e;
  }

  if (!res.ok) {
    await log(`⚠️ La subida no se pudo completar:\n<i>${escapeHtml(res.error || "Razón desconocida")}</i>\n\nProbá a mano desde el panel de Bandeja.aspx.`);
    return;
  }

  const tTotal = Math.round((Date.now() - t0) / 1000);
  const partes = [
    `✅ <b>Subida terminada</b> en ${tTotal}s.`,
    `📊 ${res.okCount} OK · ${res.errCount} con error · ${res.totalCount} total`
  ];
  if (res.errores && res.errores.length) {
    partes.push("");
    partes.push("<b>Errores:</b>");
    for (const e of res.errores.slice(0, 10)) partes.push(`❌ ${escapeHtml(e)}`);
    if (res.errores.length > 10) partes.push(`…y ${res.errores.length - 10} más.`);
  }
  await log(partes.join("\n"));

  // Limpiar pendiente
  try { await chrome.storage.local.remove(KEY_TG_PENDIENTE_SABANA); } catch {}
}

/**
 * Handler principal cuando el usuario manda un PDF al bot.
 * Manda mensajes intermedios para que se vea en qué paso va.
 */
/**
 * Lee todas las referencias de imágenes desde el IndexedDB del tab.
 * Soporta formato nuevo (imagenesPorBloque) y viejo (imagenes).
 */
async function tgLeerReferenciasConImagenes(tabId, nombresPatrones) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (nombres) => {
      function abrirDB() {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open("mau_imagedb", 1);
          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = (e) => reject(e.target.error);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("patron_imagenes")) {
              db.createObjectStore("patron_imagenes", { keyPath: "nombre" });
            }
          };
        });
      }
      async function leer(db, nombre) {
        return new Promise((resolve) => {
          const tx = db.transaction("patron_imagenes", "readonly");
          const req = tx.objectStore("patron_imagenes").get(nombre);
          req.onsuccess = (e) => resolve(e.target.result || null);
          req.onerror = () => resolve(null);
        });
      }
      try {
        const db = await abrirDB();
        const refs = [];
        for (const nombre of nombres) {
          const r = await leer(db, nombre);
          if (!r) continue;
          const tieneImagenes = (r.imagenesPorBloque && Object.keys(r.imagenesPorBloque).length > 0)
            || (Array.isArray(r.imagenes) && r.imagenes.length > 0);
          if (tieneImagenes && Array.isArray(r.bloques) && r.bloques.length) {
            refs.push({
              nombre: r.nombre,
              imagenes: r.imagenes || [],
              imagenesPorBloque: r.imagenesPorBloque || null,
              bloques: r.bloques
            });
          }
        }
        db.close();
        return refs;
      } catch (e) {
        return [];
      }
    },
    args: [nombresPatrones]
  });
  return Array.isArray(result) ? result : [];
}

async function tgManejarDocumento(cfg, doc) {
  const nombreArchivo = doc.file_name || "archivo.pdf";
  const fileId = doc.file_id;
  const sizeBytes = doc.file_size || 0;
  const t0 = Date.now();
  const log = (txt) => tgEnviarMensaje(cfg.token, cfg.chatId, txt).catch(e => console.warn("[MAU] log fail", e));

  await log(`📩 <b>Documento recibido</b>: ${escapeHtml(nombreArchivo)} (${(sizeBytes / 1024).toFixed(0)} KB)\n⏳ Bajando de Telegram…`);

  // 1) Bajar el PDF
  let base64, realSize;
  try {
    const baseInfo = await tgBajarArchivo(cfg.token, fileId);
    base64 = baseInfo.base64;
    realSize = baseInfo.sizeBytes;
  } catch (e) {
    await log(`❌ No pude bajar el archivo: ${escapeHtml(e.message || String(e))}`);
    return;
  }

  // 2) Conseguir tab de Bandeja (necesaria para renderizar y luego subir)
  await log(`✅ Bajado (${(realSize / 1024).toFixed(0)} KB).\n⏳ Abriendo controldocumentario.com…`);
  let tabId, abrimosNosotros;
  try {
    const tab = await tgConseguirTabBandeja();
    tabId = tab.tabId;
    abrimosNosotros = tab.abrimosNosotros;
  } catch (e) {
    await log(`❌ Necesitás una pestaña de controldocumentario.com abierta.`);
    return;
  }

  try {
    // 3) Renderizar páginas como imágenes
    await log(`✅ Listo.\n⏳ Renderizando páginas como imágenes…`);
    let nuevasPaginas;
    try {
      nuevasPaginas = await tgRenderPdfEnImagenes(base64, tabId);
      if (!nuevasPaginas.length) throw new Error("No se renderizó ninguna página.");
    } catch (e) {
      await log(`❌ Necesitás una pestaña de controldocumentario.com abierta.\n${escapeHtml(e.message || String(e))}`);
      return;
    }

    // 4) Cargar referencias del mapeo desde IndexedDB del tab
    await log(`✅ ${nuevasPaginas.length} página(s) renderizada(s).\n⏳ Cargando mapeo guardado…`);
    const dataPatrones = await chrome.storage.local.get(KEY_PATRONES_SABANA);
    const patrones = (dataPatrones[KEY_PATRONES_SABANA] || []).filter(p => p.nombre);
    if (!patrones.length) {
      await log(`❌ No tenés ningún mapeo guardado. Hacé un mapeo primero desde "Aprender" en la extensión.`);
      return;
    }
    const referenciasDisponibles = await tgLeerReferenciasConImagenes(tabId, patrones.map(p => p.nombre));
    if (!referenciasDisponibles.length) {
      await log(`❌ Hacé un mapeo primero desde "Aprender" en la extensión.`);
      return;
    }

    // 5) Claude machea imagen vs imagen — 1 sola llamada por mapeo hasta encontrar
    await log(`⏳ Claude macheando el documento con el mapeo (${referenciasDisponibles.length} mapeo(s))…`);
    let bloquesFinales = null;
    let bloquesDescartados = [];
    for (const ref of referenciasDisponibles) {
      try {
        const resultado = await compararPaginasConReferencia(nuevasPaginas, ref);
        if (resultado?.length) {
          bloquesFinales = resultado;
          bloquesDescartados = resultado.descartados || [];
          console.log(`[MAU][TG] ✅ Macheó con "${ref.nombre}": ${resultado.length} bloque(s), ${bloquesDescartados.length} descartado(s)`);
          break;
        }
      } catch (e) {
        console.warn(`[MAU][TG] Error macheando con "${ref.nombre}":`, e);
      }
    }
    if (!bloquesFinales?.length) {
      await log(`❌ El archivo es muy distinto al mapeado, revisá que sea el correcto.`);
      return;
    }

    // 6) Guardar pendiente y pedir confirmación al usuario
    await chrome.storage.local.set({
      [KEY_TG_PENDIENTE_DOC]: {
        fileId,
        nombreArchivo,
        bloques: bloquesFinales,
        guardadoEn: Date.now()
      }
    });

    // Armar resumen de coincidencias para mostrar al usuario
    const lineasResumen = bloquesFinales.map(b => {
      const persona = b.meta?.apellido || "Sin nombre";
      const nPagsDoc = (b.paginas || []).length;
      const nPagsMapeo = b.paginasMapeo || nPagsDoc;
      return (
        `👤 <b>${escapeHtml(persona)}</b>\n` +
        `   Bloque original: ${nPagsMapeo} pág${nPagsMapeo !== 1 ? "s" : ""}. · Tu documento: ${nPagsDoc} pág${nPagsDoc !== 1 ? "s" : ""}. ✅ Macheado correctamente`
      );
    });

    // Mostrar también los bloques descartados por páginas incompletas
    const lineasDescartadas = bloquesDescartados.map(b => {
      const persona = b.meta?.apellido || "Sin nombre";
      const nPagsDoc = (b.paginas || []).length;
      const nPagsMapeo = b.paginasMapeo || 0;
      return (
        `👤 <b>${escapeHtml(persona)}</b>\n` +
        `   Bloque original: ${nPagsMapeo} pág${nPagsMapeo !== 1 ? "s" : ""}. · Tu documento: ${nPagsDoc} pág${nPagsDoc !== 1 ? "s" : ""}. ⚠️ Páginas incompletas — NO se sube`
      );
    });

    const parteDescartados = lineasDescartadas.length
      ? `\n\n<b>No se van a subir (páginas incompletas):</b>\n\n` + lineasDescartadas.join("\n\n")
      : "";

    await log(
      `✅ Coincidencia${bloquesFinales.length > 1 ? "s" : ""} encontrada${bloquesFinales.length > 1 ? "s" : ""}:\n\n` +
      lineasResumen.join("\n\n") +
      parteDescartados +
      `\n\n¿Lo subimos? Respondé <b>SI</b> para confirmar.`
    );

  } finally {
    if (abrimosNosotros) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

// ============================== TELEGRAM: VENCIMIENTOS =================================

// Umbral fijo: alertar siempre con vencimientos a 10 días o menos.
const TG_UMBRAL_DIAS = 10;

// Lock para que dos chequeos no corran a la vez (manual + automático, etc.)
let tgChequeoEnCurso = false;

async function tgChequearYAvisar({ forzarEnvio, visible }) {
  if (tgChequeoEnCurso) {
    console.log("[MAU] Ya hay un chequeo en curso, este se saltea.");
    return { enviado: false, skipped: true, mensaje: "Ya hay un chequeo en curso." };
  }
  tgChequeoEnCurso = true;
  try {
    return await tgChequearYAvisarInterno({ forzarEnvio, visible });
  } finally {
    tgChequeoEnCurso = false;
  }
}

async function tgChequearYAvisarInterno({ forzarEnvio, visible }) {
  const cfg = await tgGetConfig();
  if (!cfg.token || !cfg.chatId) {
    throw new Error("Falta token o Chat ID. Configuralos en Opciones.");
  }

  let extraido = await tgExtraerVencimientosDesdeTab(TG_UMBRAL_DIAS, TG_UMBRAL_DIAS, !!visible);

  // Si el sitio nos mandó al login, intentar re-loguearse con las credenciales guardadas.
  if (extraido.loginRequerido) {
    console.log("[MAU] Sesión cerrada. Intentando re-login automático…");
    const rLogin = await cdReLogin({ visible: false });

    if (rLogin.ok) {
      console.log("[MAU] Re-login OK. Reintentando extracción de vencimientos…");
      extraido = await tgExtraerVencimientosDesdeTab(TG_UMBRAL_DIAS, TG_UMBRAL_DIAS, !!visible);
    }

    // Si aún así quedó loginRequerido, o el re-login falló → avisar por Telegram.
    if (!rLogin.ok || extraido.loginRequerido) {
      const motivo = rLogin.motivo || "El sitio siguió pidiendo login después del intento.";
      const tieneCreds = !!(await chrome.storage.local.get([KEY_CD_USER, KEY_CD_PASS]))[KEY_CD_USER];
      const mensajeLogin = tieneCreds
        ? [
            "\u26a0\ufe0f <b>DocAutomatizaci\u00f3n \u2014 No pude reconectar</b>",
            "",
            `Intent\u00e9 ingresar a controldocumentario.com con los datos guardados pero fall\u00f3:`,
            `<i>${escapeHtml(motivo)}</i>`,
            "",
            "\ud83d\udc49 Revis\u00e1 el usuario/contrase\u00f1a en las Opciones de la extensi\u00f3n o logueate manualmente una vez.",
          ].join("\n")
        : [
            "\u26a0\ufe0f <b>DocAutomatizaci\u00f3n \u2014 Sesi\u00f3n cerrada</b>",
            "",
            "No pude leer los vencimientos porque controldocumentario.com pide usuario y contrase\u00f1a, y todav\u00eda no guardaste las credenciales en la extensi\u00f3n.",
            "",
            "\ud83d\udc49 Abr\u00ed las <b>Opciones</b> de la extensi\u00f3n y carg\u00e1 tu usuario y contrase\u00f1a \u2014 as\u00ed la pr\u00f3xima vez me reconecto solo.",
          ].join("\n");
      await tgEnviarMensaje(cfg.token, cfg.chatId, mensajeLogin);
      return { enviado: true, loginRequerido: true, mensaje: "Sesi\u00f3n cerrada \u2014 te avis\u00e9 por Telegram." };
    }
  }

  const items = extraido.items || [];
  const totalLeidos = extraido.totalConFecha || 0;
  // Quitar el pie (que cambia con la hora) para el dedupe
  const mensaje = tgConstruirMensaje(items, TG_UMBRAL_DIAS, TG_UMBRAL_DIAS, totalLeidos);
  const cuerpoParaHash = mensaje.split("\n\n<i>—")[0];

  const prev = await chrome.storage.local.get(KEY_TG_ULTIMO_HASH);
  const hashActual = hashRapido(cuerpoParaHash);
  const iguales = prev[KEY_TG_ULTIMO_HASH] === hashActual;

  // Si no hay cambios respecto al último aviso, no reenviar (ni cuando todo OK ni cuando hay alertas iguales).
  if (!forzarEnvio && iguales) {
    return { enviado: false, mensaje: "Sin cambios desde el \u00faltimo aviso. No se reenvi\u00f3." };
  }

  await tgEnviarMensaje(cfg.token, cfg.chatId, mensaje);
  await chrome.storage.local.set({ [KEY_TG_ULTIMO_HASH]: hashActual });
  const nP = items.filter(i => i.tipo === "personal").length;
  const nV = items.filter(i => i.tipo === "vehiculo").length;
  return {
    enviado: true,
    mensaje: nP + nV === 0
      ? "Enviado. Todo OK, no hay vencimientos pr\u00f3ximos."
      : `Enviado. Personal: ${nP} \u00b7 Veh\u00edculos: ${nV}.`
  };
}

async function obtenerIAConfig() {
  return {
    apiKey: "",
    modelo: MODELO_DEFAULT,
    proxyUrl: IA_PROXY_URL_HARDCODED
  };
}

async function llamarClaudeMessages(body, etiquetaError) {
  const { apiKey, proxyUrl } = await obtenerIAConfig();

  if (proxyUrl) {
    const resp = await fetch(proxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`${etiquetaError} proxy ${resp.status}: ${errText.slice(0, 300)}`);
    }
    return await resp.json();
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`${etiquetaError} ${resp.status}: ${errText.slice(0, 300)}`);
  }
  return await resp.json();
}

async function extraerMetadataPaginaConClaude(base64, mediaType) {
  const { modelo } = await obtenerIAConfig();
  const prompt = `Lee esta pagina de un documento laboral o vehicular.

Extrae solo datos visibles y genericos. No clasifiques el tipo de documento, no infieras el destino y no uses nombres de entidades como criterio.

Reglas:
- Si hay una persona trabajadora claramente identificada, devuelve su apellido y nombre. No pongas como persona al empleador, empresa, titular, banco, organismo, aseguradora, sindicato ni prestador.
- Si hay CUIL/CUIT de la persona trabajadora, devuelvelo. Si solo se ve el CUIT/CUIL del empleador o de una entidad, dejalo vacio.
- Si hay patente de vehiculo, devuelvela.
- Si hay periodo o mes/anio, devuelvelo en formato YYYY-MM cuando sea posible.
- textoEstable debe ser una lista breve de palabras visibles utiles para reconocer la pagina despues, sin datos sensibles innecesarios.

Responde SOLO JSON valido:
{"cuil":"","apellido":"","nombre":"","patente":"","periodo":"","textoEstable":""}`;

  const body = {
    model: modelo,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: prompt }
        ]
      }
    ]
  };

  const json = await llamarClaudeMessages(body, "Claude API");
  const textoRespuesta = (json?.content?.[0]?.text || "").trim();

  let parsed = null;
  try {
    parsed = JSON.parse(textoRespuesta);
  } catch (_e) {
    const m = textoRespuesta.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch (_e2) { parsed = null; }
    }
  }

  return {
    id: "pagina",
    etiqueta: "",
    cuil: String(parsed?.cuil || "").trim(),
    apellido: String(parsed?.apellido || "").trim(),
    nombre: String(parsed?.nombre || "").trim(),
    patente: String(parsed?.patente || "").trim(),
    periodo: String(parsed?.periodo || "").trim(),
    textoEstable: String(parsed?.textoEstable || "").trim(),
    raw: textoRespuesta
  };
}

async function probarConexionClaude() {
  const { modelo } = await obtenerIAConfig();
  const body = {
    model: modelo,
    max_tokens: 10,
    messages: [{ role: "user", content: "Responde solo con la palabra OK" }]
  };
  const json = await llamarClaudeMessages(body, "Claude API");
  const texto = (json?.content?.[0]?.text || "").trim();
  return { ok: true, respuesta: texto, modelo };
}

async function debugEstadoIA() {
  const data = await chrome.storage.local.get([KEY_API_KEY, KEY_MODELO, KEY_AI_PROXY_URL]);
  const proxyUrl = String(data[KEY_AI_PROXY_URL] || "").trim();
  const apiKey = String(data[KEY_API_KEY] || "").trim();
  const modelo = String(data[KEY_MODELO] || MODELO_DEFAULT);
  const modo = proxyUrl ? "proxy" : (apiKey ? "directo" : "sin_config");

  let prueba = { ok: false, error: "Sin prueba" };
  try {
    const r = await probarConexionClaude();
    prueba = { ok: true, respuesta: r?.respuesta || "", modelo: r?.modelo || modelo };
  } catch (e) {
    prueba = { ok: false, error: e?.message || String(e) };
  }

  return {
    modo,
    modelo,
    proxyUrl,
    proxyConfigurado: !!proxyUrl,
    apiKeyConfigurada: !!apiKey,
    prueba
  };
}
